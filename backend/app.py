import logging
import asyncio
import os
import json
from datetime import datetime
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask import Flask, render_template, Response, request, send_from_directory
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
from src.recording import meeting_recorder

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

# Create persistent event loop for async operations
import threading
_loop = None
_loop_thread = None

def get_event_loop():
    """Get or create the persistent event loop."""
    global _loop, _loop_thread
    if _loop is None:
        _loop = asyncio.new_event_loop()
        _loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
        _loop_thread.start()
    return _loop

# Helper function to run async code in sync context
def run_async(coro):
    """Run async coroutine in sync context using persistent event loop."""
    loop = get_event_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result(timeout=30)
# Chat room management for events
# Structure: {event_id: {'tutor_sid': sid, 'tutee_sid': sid, 'users': {sid: userid}}}
chat_rooms = {}
# Map session IDs to user info for chat
chat_sid_to_user = {}  # {sid: {'userid': int, 'eventid': int}}

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
        
        # If this is the second person, signal both peers are ready and start recording
        if member_count == 2:
            emit('peer-ready', room=eid, include_self=True)
            # Signal to start recording now that both participants are present
            emit('start-recording', room=eid, include_self=True)
            logger.info(f"Room {eid} now has 2 peers, signaling peer-ready and start-recording")
            
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
    """Handle user disconnecting from meeting and chat"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        # Handle meeting room disconnect
        if room_id:
            logger.info(f"User {sid} disconnecting from room {room_id}")
            
            # Stop ALL recordings for this meeting when anyone leaves
            if room_id in meeting_rooms:
                member_count = len(meeting_rooms[room_id]['members'])
                
                # If there were 2 people and someone is leaving, stop all recordings
                if member_count == 2:
                    logger.info(f"Participant leaving room {room_id}, stopping all recordings")
                    try:
                        run_async(meeting_recorder.stop_meeting_recording(room_id))
                        # Notify remaining participant to stop their recording too
                        emit('stop-recording', room=room_id)
                    except Exception as e:
                        logger.error(f"Error stopping meeting recording: {e}")
                
                # Remove user from room
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
        
        # Handle chat room disconnect
        if sid in chat_sid_to_user:
            user_info = chat_sid_to_user[sid]
            eventid = user_info['eventid']
            userid = user_info['userid']
            user_role = user_info['role']
            
            logger.info(f"User {userid} disconnecting from chat for event {eventid}")
            
            chat_room_name = f"chat_{eventid}"
            
            # Remove user from chat room
            if eventid in chat_rooms:
                if sid in chat_rooms[eventid]['users']:
                    del chat_rooms[eventid]['users'][sid]
                
                # Clear tutor or tutee sid
                if chat_rooms[eventid]['tutor_sid'] == sid:
                    chat_rooms[eventid]['tutor_sid'] = None
                elif chat_rooms[eventid]['tutee_sid'] == sid:
                    chat_rooms[eventid]['tutee_sid'] = None
                
                member_count = len(chat_rooms[eventid]['users'])
                
                # Notify remaining members
                emit('user-left-chat', {
                    'userid': userid,
                    'role': user_role,
                    'member_count': member_count
                }, room=chat_room_name)
                
                # Clean up empty chat rooms
                if member_count == 0:
                    del chat_rooms[eventid]
                    logger.info(f"Chat room for event {eventid} is empty, removing it")
            
            # Remove sid mapping
            del chat_sid_to_user[sid]
            leave_room(chat_room_name)
            
        logger.info(f"User {sid} disconnected")
        
    except Exception as e:
        logger.error(f"Error in handle_disconnect: {e}", exc_info=True)


@socketio.on('recorder-offer')
def handle_recorder_offer(data):
    """Handle WebRTC offer from client for server-side recording"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        if not room_id:
            emit('error', {'message': 'Not in a meeting room'})
            return
        
        logger.info(f"Received recorder offer from {sid} in room {room_id}")
        
        async def process_offer():
            # Create or get recording session
            session = meeting_recorder.get_session(room_id, sid)
            if not session:
                session = await meeting_recorder.start_recording(room_id, sid)
            
            # Handle the offer and get answer
            answer = await session.handle_offer(data)
            return answer
        
        # Process offer and send answer
        answer = run_async(process_offer())
        emit('recorder-answer', answer)
        logger.info(f"Sent recorder answer to {sid}")
        
    except Exception as e:
        logger.error(f"Error in handle_recorder_offer: {e}", exc_info=True)
        emit('error', {'message': 'Failed to process recorder offer'})


@socketio.on('recorder-ice-candidate')
def handle_recorder_ice_candidate(data):
    """Handle ICE candidate from client for server-side recording"""
    try:
        sid = request.sid
        room_id = sid_to_room.get(sid)
        
        if not room_id:
            return
        
        logger.info(f"Received recorder ICE candidate from {sid}")
        
        session = meeting_recorder.get_session(room_id, sid)
        if session:
            run_async(session.add_ice_candidate(data))
        
    except Exception as e:
        logger.error(f"Error in handle_recorder_ice_candidate: {e}", exc_info=True)
# ============= Chat Socket.IO Event Handlers =============

@socketio.on('join-chat')
def handle_join_chat(data):
    """Handle user joining a chat room for an event"""
    try:
        eventid = data.get('eventid')
        userid = data.get('userid')
        user_role = data.get('role')  # 'tutor' or 'tutee'
        sid = request.sid
        
        if not eventid or not userid:
            emit('chat-error', {'message': 'Missing eventid or userid'})
            logger.warning(f"join-chat called without required data: {data}")
            return
        
        logger.info(f"User {userid} ({user_role}) attempting to join chat for event {eventid}")
        
        # Verify the user is authorized for this event (tutor or tutee)
        from src.database import get_db_session
        from src.models import RequestedEvent
        
        session = get_db_session()
        try:
            event = session.query(RequestedEvent).filter_by(eventid=eventid).first()
            
            if not event:
                emit('chat-error', {'message': 'Event not found'})
                logger.warning(f"Event {eventid} not found")
                return
            
            # Check if user is the tutor or tutee
            is_authorized = (event.userid_tutee == userid or event.userid_tutor.userid_tutor == userid)
            
            if not is_authorized:
                emit('chat-error', {'message': 'Unauthorized: You are not part of this event'})
                logger.warning(f"User {userid} not authorized for event {eventid}")
                return
            
            # Initialize chat room if it doesn't exist
            if eventid not in chat_rooms:
                chat_rooms[eventid] = {
                    'tutor_sid': None,
                    'tutee_sid': None,
                    'users': {}
                }
            
            # Add user to chat room
            chat_room_name = f"chat_{eventid}"
            join_room(chat_room_name)
            
            # Track user info
            chat_sid_to_user[sid] = {
                'userid': userid,
                'eventid': eventid,
                'role': user_role
            }
            chat_rooms[eventid]['users'][sid] = userid
            
            # Set tutor or tutee sid
            if event.userid_tutor.userid_tutor == userid:
                chat_rooms[eventid]['tutor_sid'] = sid
            elif event.userid_tutee == userid:
                chat_rooms[eventid]['tutee_sid'] = sid
            
            member_count = len(chat_rooms[eventid]['users'])
            logger.info(f"User {userid} joined chat for event {eventid}. Chat now has {member_count} member(s)")
            
            # Notify user they successfully joined
            emit('chat-joined', {
                'eventid': eventid,
                'member_count': member_count,
                'role': user_role
            })
            
            # Notify other members someone joined
            emit('user-joined-chat', {
                'userid': userid,
                'role': user_role,
                'member_count': member_count
            }, room=chat_room_name, skip_sid=sid)
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Error in handle_join_chat: {e}", exc_info=True)
        emit('chat-error', {'message': 'Failed to join chat'})


@socketio.on('send-message')
def handle_send_message(data):
    """Handle sending a chat message in an event"""
    try:
        sid = request.sid
        message = data.get('message')
        eventid = data.get('eventid')
        
        if sid not in chat_sid_to_user:
            emit('chat-error', {'message': 'Not in any chat room'})
            logger.warning(f"User {sid} not in any chat room")
            return
        
        user_info = chat_sid_to_user[sid]
        stored_eventid = user_info['eventid']
        userid = user_info['userid']
        user_role = user_info['role']
        
        # Verify eventid matches
        if eventid and eventid != stored_eventid:
            emit('chat-error', {'message': 'Event ID mismatch'})
            logger.warning(f"Event ID mismatch for user {sid}: {eventid} vs {stored_eventid}")
            return
        
        if not message:
            emit('chat-error', {'message': 'Empty message'})
            return
        
        # Get sender name from database
        from src.database import get_db_session
        from src.models import User
        
        session = get_db_session()
        try:
            user = session.query(User).filter_by(userid=userid).first()
            sender_name = user.name if user else f"User {userid}"
            
            chat_room_name = f"chat_{stored_eventid}"
            timestamp = datetime.now().isoformat()
            
            message_data = {
                'message': message,
                'userid': userid,
                'sender_name': sender_name,
                'role': user_role,
                'timestamp': timestamp,
                'eventid': stored_eventid
            }
            
            logger.info(f"User {userid} sent message to chat {stored_eventid}: {message[:50]}...")
            
            # Broadcast message to all users in the chat room (including sender)
            emit('receive-message', message_data, room=chat_room_name, include_self=True)
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Error in handle_send_message: {e}", exc_info=True)
        emit('chat-error', {'message': 'Failed to send message'})


@socketio.on('leave-chat')
def handle_leave_chat(data):
    """Handle user leaving a chat room"""
    try:
        sid = request.sid
        eventid = data.get('eventid') if isinstance(data, dict) else None
        
        if sid not in chat_sid_to_user:
            logger.warning(f"User {sid} not in any chat room")
            return
        
        user_info = chat_sid_to_user[sid]
        stored_eventid = user_info['eventid']
        userid = user_info['userid']
        user_role = user_info['role']
        
        # Use provided eventid or stored eventid
        event_to_leave = eventid if eventid else stored_eventid
        
        logger.info(f"User {userid} leaving chat for event {event_to_leave}")
        
        chat_room_name = f"chat_{event_to_leave}"
        
        # Remove user from chat room
        if event_to_leave in chat_rooms:
            if sid in chat_rooms[event_to_leave]['users']:
                del chat_rooms[event_to_leave]['users'][sid]
            
            # Clear tutor or tutee sid
            if chat_rooms[event_to_leave]['tutor_sid'] == sid:
                chat_rooms[event_to_leave]['tutor_sid'] = None
            elif chat_rooms[event_to_leave]['tutee_sid'] == sid:
                chat_rooms[event_to_leave]['tutee_sid'] = None
            
            member_count = len(chat_rooms[event_to_leave]['users'])
            
            # Notify remaining members
            emit('user-left-chat', {
                'userid': userid,
                'role': user_role,
                'member_count': member_count
            }, room=chat_room_name)
            
            # Clean up empty chat rooms
            if member_count == 0:
                del chat_rooms[event_to_leave]
                logger.info(f"Chat room for event {event_to_leave} is empty, removing it")
        
        # Remove sid mapping
        del chat_sid_to_user[sid]
        leave_room(chat_room_name)
        
        # Notify user they left
        emit('chat-left', {'eventid': event_to_leave})
        
    except Exception as e:
        logger.error(f"Error in handle_leave_chat: {e}", exc_info=True)
        emit('chat-error', {'message': 'Failed to leave chat'})


@socketio.on('typing')
def handle_typing(data):
    """Handle typing indicator"""
    try:
        sid = request.sid
        is_typing = data.get('is_typing', False)
        
        if sid not in chat_sid_to_user:
            return
        
        user_info = chat_sid_to_user[sid]
        eventid = user_info['eventid']
        userid = user_info['userid']
        user_role = user_info['role']
        
        chat_room_name = f"chat_{eventid}"
        
        # Broadcast typing indicator to other users (not self)
        emit('user-typing', {
            'userid': userid,
            'role': user_role,
            'is_typing': is_typing
        }, room=chat_room_name, skip_sid=sid)
        
    except Exception as e:
        logger.error(f"Error in handle_typing: {e}", exc_info=True)



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


@app.route('/recordings')
def recordings_list():
    """Display list of all recordings grouped by meeting"""
    try:
        recordings_dir = meeting_recorder.get_recordings_dir()
        recordings = []
        meetings = {}  # Group by meeting_id
        
        if os.path.exists(recordings_dir):
            for filename in sorted(os.listdir(recordings_dir), reverse=True):
                if filename.endswith('.mp4'):
                    filepath = os.path.join(recordings_dir, filename)
                    stat = os.stat(filepath)
                    
                    # Parse filename: meeting_id_participant_id_timestamp.mp4
                    parts = filename.replace('.mp4', '').split('_')
                    meeting_id = parts[0] if len(parts) > 0 else 'Unknown'
                    participant_id = parts[1] if len(parts) > 1 else 'Unknown'
                    timestamp = '_'.join(parts[2:]) if len(parts) > 2 else 'Unknown'
                    
                    recording_data = {
                        'filename': filename,
                        'meeting_id': meeting_id,
                        'participant_id': participant_id,
                        'timestamp': timestamp,
                        'size': f"{stat.st_size / (1024*1024):.2f} MB",
                        'size_mb': stat.st_size / (1024*1024),
                        'created': datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S')
                    }
                    recordings.append(recording_data)
                    
                    # Group by meeting
                    if meeting_id not in meetings:
                        meetings[meeting_id] = []
                    meetings[meeting_id].append(recording_data)
        
        return render_template('recordings.html', recordings=recordings, meetings=meetings)
    except Exception as e:
        logger.error(f"Error listing recordings: {e}", exc_info=True)
        return f"Error listing recordings: {e}", 500


@app.route('/recordings/meeting/<meeting_id>')
def meeting_recordings(meeting_id):
    """Display synced playback for a specific meeting"""
    try:
        recordings_dir = meeting_recorder.get_recordings_dir()
        meeting_recordings = []
        
        if os.path.exists(recordings_dir):
            for filename in os.listdir(recordings_dir):
                if filename.endswith('.mp4') and filename.startswith(meeting_id + '_'):
                    filepath = os.path.join(recordings_dir, filename)
                    stat = os.stat(filepath)
                    
                    # Parse filename
                    parts = filename.replace('.mp4', '').split('_')
                    participant_id = parts[1] if len(parts) > 1 else 'Unknown'
                    timestamp = '_'.join(parts[2:]) if len(parts) > 2 else 'Unknown'
                    
                    meeting_recordings.append({
                        'filename': filename,
                        'participant_id': participant_id,
                        'timestamp': timestamp,
                        'size': f"{stat.st_size / (1024*1024):.2f} MB",
                        'created': datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S')
                    })
        
        if not meeting_recordings:
            return "No recordings found for this meeting", 404
            
        return render_template('meeting_playback.html', 
                             meeting_id=meeting_id, 
                             recordings=meeting_recordings)
    except Exception as e:
        logger.error(f"Error loading meeting recordings: {e}", exc_info=True)
        return f"Error loading meeting recordings: {e}", 500


@app.route('/recordings/<filename>')
def serve_recording(filename):
    """Serve a recording file"""
    try:
        recordings_dir = meeting_recorder.get_recordings_dir()
        return send_from_directory(recordings_dir, filename)
    except Exception as e:
        logger.error(f"Error serving recording: {e}", exc_info=True)
        return f"Recording not found: {e}", 404


@app.route('/api/recordings/meeting/<meeting_id>')
def api_meeting_recordings(meeting_id):
    """API endpoint to get recordings for a specific meeting"""
    try:
        recordings_dir = meeting_recorder.get_recordings_dir()
        meeting_recordings = []
        
        if os.path.exists(recordings_dir):
            for filename in os.listdir(recordings_dir):
                if filename.endswith('.mp4') and filename.startswith(meeting_id + '_'):
                    filepath = os.path.join(recordings_dir, filename)
                    stat = os.stat(filepath)
                    
                    # Parse filename
                    parts = filename.replace('.mp4', '').split('_')
                    participant_id = parts[1] if len(parts) > 1 else 'Unknown'
                    timestamp = '_'.join(parts[2:]) if len(parts) > 2 else 'Unknown'
                    
                    meeting_recordings.append({
                        'filename': filename,
                        'url': f'/recordings/{filename}',
                        'participant_id': participant_id,
                        'timestamp': timestamp,
                        'size': stat.st_size,
                        'size_mb': f"{stat.st_size / (1024*1024):.2f}",
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
        
        return {'meeting_id': meeting_id, 'recordings': meeting_recordings}, 200
    except Exception as e:
        logger.error(f"Error fetching meeting recordings: {e}", exc_info=True)
        return {'error': str(e)}, 500


@app.route('/api/transcripts/meeting/<meeting_id>')
def api_meeting_transcripts(meeting_id):
    """API endpoint to get transcripts for a specific meeting"""
    try:
        from src.transcription import transcription_service
        transcripts_dir = transcription_service.get_transcripts_dir()
        meeting_transcripts = []
        
        if os.path.exists(transcripts_dir):
            for filename in os.listdir(transcripts_dir):
                if filename.endswith('_transcript.json') and filename.startswith(meeting_id + '_'):
                    filepath = os.path.join(transcripts_dir, filename)
                    
                    # Parse filename
                    parts = filename.replace('_transcript.json', '').split('_')
                    participant_id = parts[1] if len(parts) > 1 else 'Unknown'
                    
                    # Read transcript data
                    with open(filepath, 'r', encoding='utf-8') as f:
                        transcript_data = json.load(f)
                    
                    stat = os.stat(filepath)
                    meeting_transcripts.append({
                        'filename': filename,
                        'participant_id': participant_id,
                        'transcript': transcript_data.get('transcript', ''),
                        'words': transcript_data.get('words', []),
                        'language': transcript_data.get('language', 'en-US'),
                        'word_count': len(transcript_data.get('transcript', '').split()),
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
        
        return {'meeting_id': meeting_id, 'transcripts': meeting_transcripts}, 200
    except Exception as e:
        logger.error(f"Error fetching meeting transcripts: {e}", exc_info=True)
        return {'error': str(e)}, 500


@app.route('/transcripts/<meeting_id>/<participant_id>')
def get_transcript(meeting_id, participant_id):
    """Get transcript for a specific participant"""
    try:
        from src.transcription import transcription_service
        transcripts_dir = transcription_service.get_transcripts_dir()
        
        filename = f"{meeting_id}_{participant_id}_transcript.json"
        filepath = os.path.join(transcripts_dir, filename)
        
        if not os.path.exists(filepath):
            return {'error': 'Transcript not found'}, 404
        
        with open(filepath, 'r', encoding='utf-8') as f:
            transcript_data = json.load(f)
        
        return transcript_data, 200
    except Exception as e:
        logger.error(f"Error fetching transcript: {e}", exc_info=True)
        return {'error': str(e)}, 500


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


