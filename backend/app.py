import logging
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask import Flask, render_template, Response, request
from flask_cors import CORS
from src.login import login
from src.signup import signup
from src.subjects import subjects
from flask_jwt_extended import create_access_token, JWTManager, get_jwt_identity, jwt_required
from src.create_event import create_event
from src.database import init_db, close_db_session
from src.add_possible_tutor import add_possible_tutor
from src.accept_tutor import accept_tutor
from src.add_meeting import add_meeting
from src.list_offers import list_offers
from src.list_events import list_events, list_tutee_events, list_tutor_events

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a Flask app instance
app = Flask(__name__, static_url_path='/static')
app.config['SECRET_KEY'] = 'secret!'
app.config['JWT_SECRET_KEY'] = 'password'
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_CSRF_CHECK_FORM'] = False

# Enable CORS
CORS(app)

# Initialize JWT
jwt = JWTManager(app)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize database
with app.app_context():
    init_db()

# Cleanup database session after each request
@app.teardown_appcontext
def shutdown_session(exception=None):
    close_db_session()

# Meeting room management
# Structure: {room_id: {'members': [sid1, sid2], 'event_id': eid}}
meeting_rooms = {}
# Map session IDs to room IDs
sid_to_room = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/meeting/<eid>') 
def meeting(eid):
    return render_template('meeting.html', eid=eid)

# ============= Socket.IO Event Handlers =============

@socketio.on('join')
def handle_join(data):
    """Handle user joining a meeting room"""
    try:
        eid = data.get('eid') if isinstance(data, dict) else data
        sid = request.sid
        
        logger.info(f"User {sid} attempting to join room {eid}")
        
        # Initialize room if it doesn't exist
        if eid not in meeting_rooms:
            meeting_rooms[eid] = {
                'members': [],
                'event_id': eid
            }
        
        # Check if room is full (max 2 participants for 1-on-1 tutoring)
        if len(meeting_rooms[eid]['members']) >= 2:
            emit('error', {'message': 'Meeting room is full'})
            logger.warning(f"Room {eid} is full, rejecting user {sid}")
            return
        
        # Add user to room
        join_room(eid)
        meeting_rooms[eid]['members'].append(sid)
        sid_to_room[sid] = eid
        
        member_count = len(meeting_rooms[eid]['members'])
        logger.info(f"User {sid} joined room {eid}. Room now has {member_count} member(s)")
        
        # Notify user they successfully joined
        emit('joined', {'room': eid, 'member_count': member_count})
        
        # Notify other members someone joined
        emit('user-joined', {'member_count': member_count}, room=eid, skip_sid=sid)
        
        # If this is the second person, signal both peers are ready
        if member_count == 2:
            emit('peer-ready', room=eid, include_self=True)
            logger.info(f"Room {eid} now has 2 peers, signaling peer-ready")
            
    except Exception as e:
        logger.error(f"Error in handle_join: {e}", exc_info=True)
        emit('error', {'message': 'Failed to join meeting'})

@socketio.on('offer')
def handle_offer(data):
    """Forward WebRTC offer to other peer in room"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        if not room_id:
            logger.warning(f"User {sid} not in any room, cannot forward offer")
            return
        
        logger.info(f"Forwarding offer from {sid} in room {room_id}")
        emit('offer', data, room=room_id, skip_sid=sid)
        
    except Exception as e:
        logger.error(f"Error in handle_offer: {e}", exc_info=True)

@socketio.on('answer')
def handle_answer(data):
    """Forward WebRTC answer to other peer in room"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        if not room_id:
            logger.warning(f"User {sid} not in any room, cannot forward answer")
            return
        
        logger.info(f"Forwarding answer from {sid} in room {room_id}")
        emit('answer', data, room=room_id, skip_sid=sid)
        
    except Exception as e:
        logger.error(f"Error in handle_answer: {e}", exc_info=True)

@socketio.on('ice-candidate')
def handle_ice_candidate(data):
    """Forward ICE candidate to other peer in room"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        if not room_id:
            logger.warning(f"User {sid} not in any room, cannot forward ICE candidate")
            return
        
        logger.info(f"Forwarding ICE candidate from {sid} in room {room_id}")
        emit('ice-candidate', data, room=room_id, skip_sid=sid)
        
    except Exception as e:
        logger.error(f"Error in handle_ice_candidate: {e}", exc_info=True)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle user disconnecting from meeting"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        if room_id:
            logger.info(f"User {sid} disconnecting from room {room_id}")
            
            # Remove user from room
            if room_id in meeting_rooms:
                if sid in meeting_rooms[room_id]['members']:
                    meeting_rooms[room_id]['members'].remove(sid)
                
                member_count = len(meeting_rooms[room_id]['members'])
                
                # Notify remaining members
                emit('user-left', {'member_count': member_count}, room=room_id)
                
                # Clean up empty rooms
                if member_count == 0:
                    del meeting_rooms[room_id]
                    logger.info(f"Room {room_id} is empty, removing it")
            
            # Remove sid mapping
            del sid_to_room[sid]
            leave_room(room_id)
            
        logger.info(f"User {sid} disconnected")
        
    except Exception as e:
        logger.error(f"Error in handle_disconnect: {e}", exc_info=True)



@app.route('/signup', methods=['POST'])
def post_signup():
    name = request.json.get('name')
    email= request.json.get('email')
    password = request.json.get('password')
    try:
        signup(name, email, password)
        return {"status": 200}
    except Exception as e:
        return {'error': f'Something went wrong - {e}'}, 500

@app.route('/login', methods=['POST'])
def post_login():
    email= request.json.get('email')
    password = request.json.get('password')
    token = login(email, password)
    if token is None:
        return {'error': 'Incorrect username or password'}, 401
    return {'token': token}, 200

@app.route('/subjects', methods=['GET'])
def get_subjects():
    try:
        return {'subjects': subjects()}, 200
    except Exception as e:
        return {'error': f'Error: {e}'}, 500


@app.route('/event/create', methods=['POST'])
@jwt_required()
def post_create_event():
    try:
        userid_tutee = int(get_jwt_identity())  # Get userid from JWT token and convert to int
        available_start = request.json.get('available_start')
        available_end = request.json.get('available_end')
        category = request.json.get('category')
        title = request.json.get('title')
        description = request.json.get('description')

        print(f"Received data: userid={userid_tutee}, start={available_start}, end={available_end}, category={category}, title={title}")

        eid = create_event(
            userid_tutee,
            available_start,
            available_end,
            category,
            title,
            description
        )
        return {'event_id': eid}, 200
    except Exception as e:
        print(f"Error in post_create_event: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}, 500
 
# Add a possible tutor to an event
@app.route('/event/<int:event_id>/offer', methods=['POST'])
@jwt_required()
def get_event_offer(event_id):
    try:
        add_possible_tutor(
            eventid=event_id,  # Use event_id from URL
            userid_tutor=int(get_jwt_identity()),
            start=request.json.get('start'),
            end=request.json.get('end')
        )
        return {'status': 200}, 200
    except Exception as e:
        print(f"Error in get_event_offer: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}, 500


# Accept a tutor for an event
@app.route('/event/<int:event_id>/accept', methods=['POST'])
@jwt_required()
def accept_event_offer(event_id):
    accepted_tutor = accept_tutor(
        eventid=event_id,
        userid_tutor=request.json.get('userid_tutor')
    )
    if accepted_tutor:
        start = accepted_tutor.get('start')
        end = accepted_tutor.get('end')
        add_meeting(event_id, start, end)
        return {'accepted_tutor': accepted_tutor}, 200
    return {'error': 'Could not accept tutor'}, 500


# List offers for an event
@app.route('/event/<int:event_id>/offers', methods=['GET'])
@jwt_required()
def list_event_offers(event_id):
    try:
        offers = list_offers(event_id)
        return {'offers': offers}, 200
    except Exception as e:
        return {'error': str(e)}, 500

# Get all events
@app.route('/events', methods=['GET'])
@jwt_required()
def get_all_events():
    try:
        events = list_events()
        return {'events': events}, 200
    except Exception as e:
        return {'error': str(e)}, 500

# Get events for a specific tutee
@app.route('/events/tutee', methods=['GET'])
@jwt_required()
def get_tutee_events():
    try:
        userid_tutee = int(get_jwt_identity())
        events = list_tutee_events(userid_tutee)
        return {'events': events}, 200
    except Exception as e:
        print(f"Error in get_tutee_events: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}, 500

# Get events where user is a tutor
@app.route('/events/tutor', methods=['GET'])
@jwt_required()
def get_tutor_events():
    try:
        userid_tutor = int(get_jwt_identity())
        events = list_tutor_events(userid_tutor)
        return {'events': events}, 200
    except Exception as e:
        print(f"Error in get_tutor_events: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}, 500

if __name__ == "__main__":
    socketio.run(app, debug=True, host='0.0.0.0', port=6969)


