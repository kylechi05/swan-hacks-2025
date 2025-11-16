
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

# Initialize database
with app.app_context():
    init_db()

socketio = SocketIO(app)

# Cleanup database session after each request
@app.teardown_appcontext
def shutdown_session(exception=None):
    close_db_session()

socketio = SocketIO(app)

# TODO: Move users to DB, or find better way to handle what users are in what rooms
users = {}

# Set to keep track of RTCPeerConnection instances
pcs = set()

@app.route('/')
def index():
    return render_template('index.html')

# Handle new user joining
@socketio.on('join')
def handle_join(username):
    users[request.sid] = username  # Store username by session ID
    join_room(username)  # Each user gets their own "room"
    emit("message", f"{username} joined the chat", room=username)

# Handle user messages
@socketio.on('message')
def handle_message(data):
    username = users.get(request.sid, "Anonymous")  # Get the user's name
    emit("message", f"{username}: {data}", broadcast=True)  # Send to everyone

# Handle disconnects
@socketio.on('disconnect')
def handle_disconnect():
    username = users.pop(request.sid, "Anonymous")
    emit("message", f"{username} left the chat", broadcast=True)


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


