from flask import Flask, render_template, Response, request, jsonify
import src.videochat
from src.login import login
from src.signup import signup


# Create a Flask app instance
app = Flask(__name__, static_url_path='/static')
camera = src.videochat.VideoCamera()

# Set to keep track of RTCPeerConnection instances
pcs = set()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/offer', methods=['POST'])
def offer():
    return src.videochat.offer()

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
    app.run(debug=True, host='0.0.0.0', port=6969)


