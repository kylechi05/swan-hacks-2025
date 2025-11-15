
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask import Flask, render_template, Response, request
import src.videochat


# Create a Flask app instance
app = Flask(__name__, static_url_path='/static')
app.config['SECRET_KEY'] = 'secret!'

socketio = SocketIO(app)

# TODO: move camera init to meeting
camera = src.videochat.VideoCamera()

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


@app.route('/offer', methods=['POST'])
def offer():
    return src.videochat.offer()

@app.route('/video_feed')
def video_feed():
    return Response(src.videochat.gen(camera),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":

    socketio.run(app, debug=True, host='0.0.0.0', port=6969)
