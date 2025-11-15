from flask import Flask, render_template, Response, request, jsonify
import src.videochat


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

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=6969)
