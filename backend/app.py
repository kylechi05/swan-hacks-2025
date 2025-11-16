
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask import Flask, render_template, Response, request
from flask_cors import CORS
from src.login import login
from src.signup import signup
from src.subjects import subjects
from flask_jwt_extended import create_access_token, JWTManager, get_jwt_identity, jwt_required
from src.create_event import create_event


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

@app.route('/event/<int:event_id>/offer', methods=['POST'])
@jwt_required()
def get_event_offer():
    def generate():
        request.json.get('eid')
    return Response(generate(), mimetype='text/plain')

#@app.route('/get_events', methods=['POST'])


if __name__ == "__main__":
    socketio.run(app, debug=True, host='0.0.0.0', port=6969)

