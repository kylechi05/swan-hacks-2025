var socket = io();

// Join the room with eid when socket connects
socket.on('connect', function() {
  if (typeof eid !== 'undefined') {
    console.log('Joining room with eid:', eid);
    socket.emit('join', eid);
  }
});

// Listen for incoming offers from other peers
socket.on('offer', async function(data) {
  console.log('Received offer from remote peer');
  
  // If we don't have our stream yet, start it first
  if (!localStream) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      localVideo.srcObject = stream;
      localStream = stream;
      console.log('Activated camera for incoming call');
      startButton.disabled = true;
      hangupButton.disabled = false;
    } catch (e) {
      console.error('Failed to get user media:', e);
      return;
    }
  }
  
  if (!pc2) {
    // Create pc2 when we receive an offer from remote peer
    const configuration = {};
    pc2 = new RTCPeerConnection(configuration);
    console.log('Created remote peer connection object pc2');
    pc2.addEventListener('icecandidate', e => onIceCandidate(pc2, e));
    pc2.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc2, e));
    pc2.addEventListener('track', gotRemoteStream);
    
    // Add local stream to pc2
    if (localStream) {
      localStream.getTracks().forEach(track => pc2.addTrack(track, localStream));
      console.log('Added local stream to pc2');
    }
  }
  
  try {
    const offer = new RTCSessionDescription({
      sdp: data.sdp,
      type: data.type
    });
    await pc2.setRemoteDescription(offer);
    console.log('pc2 setRemoteDescription complete');
    
    // Create and send answer
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    console.log('pc2 setLocalDescription complete');
    
    socket.emit('answer', {
      sdp: pc2.localDescription.sdp,
      type: pc2.localDescription.type
    });
    console.log('Sent answer to remote peer');
  } catch (e) {
    console.error('Error handling offer:', e);
  }
});

// Listen for answers from other peers
socket.on('answer', async function(data) {
  console.log('Received answer from remote peer');
  try {
    const answer = new RTCSessionDescription({
      sdp: data.sdp,
      type: data.type
    });
    await pc1.setRemoteDescription(answer);
    console.log('pc1 setRemoteDescription complete');
  } catch (e) {
    console.error('Error handling answer:', e);
  }
});

// Listen for ICE candidates from other peers
socket.on('ice-candidate', async function(data) {
  console.log('Received ICE candidate from remote peer');
  try {
    const candidate = new RTCIceCandidate({
      candidate: data.candidate,
      sdpMLineIndex: data.sdpMLineIndex,
      sdpMid: data.sdpMid
    });
    
    // Add to the appropriate peer connection
    if (pc1 && pc1.remoteDescription) {
      await pc1.addIceCandidate(candidate);
      console.log('Added ICE candidate to pc1');
    } else if (pc2 && pc2.remoteDescription) {
      await pc2.addIceCandidate(candidate);
      console.log('Added ICE candidate to pc2');
    }
  } catch (e) {
    console.error('Error adding ICE candidate:', e);
  }
});

// Listen for peer-ready event (when second peer joins)
socket.on('peer-ready', function() {
  console.log('Another peer is ready in the room');
  // Automatically start if we haven't started yet
  if (!localStream && !pc1) {
    start();
  }
});

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
hangupButton.disabled = true;
startButton.addEventListener('click', start);
hangupButton.addEventListener('click', hangup);

let startTime;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');


localVideo.addEventListener('loadedmetadata', function() {
  console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function() {
  console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('resize', () => {
  console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
});

let localStream;
let pc1;
let pc2;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}


async function start() {
  console.log('Requesting local stream');
  startButton.disabled = true;
  try {
    // Step 1: Activate camera
    const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
    console.log('Received local stream');
    localVideo.srcObject = stream;
    localStream = stream;
    
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    
    // Step 2: Create peer connection and start call
    hangupButton.disabled = false;
    console.log('Starting call');
    startTime = window.performance.now();
    
    const configuration = {};
    console.log('RTCPeerConnection configuration:', configuration);
    pc1 = new RTCPeerConnection(configuration);
    console.log('Created local peer connection object pc1');
    
    pc1.addEventListener('icecandidate', e => {
      if (e.candidate) {
        socket.emit('ice-candidate', {
          candidate: e.candidate.candidate,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
          sdpMid: e.candidate.sdpMid
        });
      }
    });
    pc1.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc1, e));
    pc1.addEventListener('track', gotRemoteStream);

    localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
    console.log('Added local stream to pc1');

    // Step 3: Create and emit offer
    try {
      console.log('pc1 createOffer start');
      const offer = await pc1.createOffer(offerOptions);
      await onCreateOfferSuccess(offer);
      console.log('Waiting for remote peer to connect...');
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
    startButton.disabled = false;
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc1\n${desc.sdp}`);
  console.log('pc1 setLocalDescription start');
  try {
    await pc1.setLocalDescription(desc);
    onSetLocalSuccess(pc1);
    
    // Emit the offer to the server via socket
    console.log('Emitting offer to socket');
    socket.emit('offer', {
      sdp: pc1.localDescription.sdp,
      type: pc1.localDescription.type
    });
  } catch (e) {
    onSetSessionDescriptionError();
  }
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('pc2 received remote stream');
  }
}

async function onIceCandidate(pc, event) {
  if (event.candidate) {
    console.log(`${getName(pc)} ICE candidate:\n${event.candidate.candidate}`);
    socket.emit('ice-candidate', {
      candidate: event.candidate.candidate,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
      sdpMid: event.candidate.sdpMid
    });
  } else {
    console.log(`${getName(pc)} ICE candidate: (null)`);
  }
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  console.log('Ending call');
  if (pc1) {
    pc1.close();
    pc1 = null;
  }
  if (pc2) {
    pc2.close();
    pc2 = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  hangupButton.disabled = true;
  startButton.disabled = false;
}
