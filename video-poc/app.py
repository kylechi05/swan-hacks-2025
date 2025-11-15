import logging
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask import Flask, render_template, Response, request
import src.videochat
from src.login import login
from src.signup import signup


# Create a Flask app instance
app = Flask(__name__, static_url_path='/static')
app.config['SECRET_KEY'] = 'secret!'

socketio = SocketIO(app)

# TODO: move camera init to meeting
camera = src.videochat.VideoCamera()

# TODO: Move users to DB, or find better way to handle what users are in what rooms
users = {}

# Track rooms and their members
rooms = {}

# Set to keep track of RTCPeerConnection instances
pcs = set()


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/meeting/<eid>') 
def meeting(eid):
    return render_template('meeting.html', eid=eid)

# Handle new user joining
@socketio.on('join')
def handle_join(eid):
    users[request.sid] = eid  # Store eid by session ID
    join_room(eid)
    
    # Track room members
    if eid not in rooms:
        rooms[eid] = []
    rooms[eid].append(request.sid)
    
    logging.info(f"User {request.sid} joined room {eid}. Room has {len(rooms[eid])} members.")
    
    # If this is the second person joining, notify both peers they can start
    if len(rooms[eid]) == 2:
        emit('peer-ready', room=eid, include_self=True)
        logging.info(f"Two peers in room {eid}, signaling peer-ready")

# Handle user messages
@socketio.on('message')
def handle_message(data):
    username = users.get(request.sid, "Anonymous")  # Get the user's name
    emit("message", f"{username}: {data}", broadcast=True)  # Send to everyone

# Handle disconnects
@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    eid = users.pop(sid, None)
    
    if eid and eid in rooms:
        if sid in rooms[eid]:
            rooms[eid].remove(sid)
        if len(rooms[eid]) == 0:
            del rooms[eid]
    
    emit("message", f"User left the chat", room=eid)



@socketio.on('offer')
def handle_offer(data):
    emit('offer', data, room=users[request.sid], skip_sid=request.sid)

@socketio.on('answer')
def handle_answer(data):
    emit('answer', data, room=users[request.sid], skip_sid=request.sid)

@socketio.on('ice-candidate')
def handle_ice_candidate(data):
    emit('ice-candidate', data, room=users[request.sid], skip_sid=request.sid)


@app.route('/video_feed')
def video_feed():
    return Response(src.videochat.gen(camera),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/signup', methods=['POST'])
def post_signup():
    name = request.json.get('name')
    email= request.json.get('email')
    password = request.json.get('password')
    try:
        signup(name, email, password)
        return 200
    except Exception as e:
        return {'error': f'Something went wrong - {e}'}, 500

@app.route('/login', methods=['POST'])
def post_login():
    email= request.json.get('email')
    password = request.json.get('password')
    user_id = login(email, password)
    if user_id is None:
        return {'error': 'Incorrect username or password'}, 401
    return {'user_id': user_id}, 200

if __name__ == "__main__":
    # For HTTPS (required for getUserMedia on non-localhost)
    # Generate with: openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
    # For development, use 'adhoc' to auto-generate self-signed cert
    socketio.run(app, debug=True, host='0.0.0.0', port=6969, 
                 ssl_context='adhoc')  # Remove ssl_context for HTTP-only

