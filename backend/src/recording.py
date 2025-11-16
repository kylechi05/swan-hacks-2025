"""
Server-side media recording for meeting sessions.
Uses aiortc to create a silent listener that records both audio and video streams.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, Optional
import av
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRecorder, MediaPlayer
from av import VideoFrame, AudioFrame

logger = logging.getLogger(__name__)

# Directory to store recordings
RECORDINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'recordings')
os.makedirs(RECORDINGS_DIR, exist_ok=True)


class MediaRecorderSession:
    """
    Manages recording of a single participant's audio and video streams.
    """
    
    def __init__(self, meeting_id: str, participant_id: str):
        self.meeting_id = meeting_id
        self.participant_id = participant_id
        self.pc: Optional[RTCPeerConnection] = None
        self.recorder: Optional[MediaRecorder] = None
        self.video_track: Optional[MediaStreamTrack] = None
        self.audio_track: Optional[MediaStreamTrack] = None
        self.output_file: Optional[str] = None
        self.is_recording = False
        
    async def start(self):
        """Initialize the peer connection for recording."""
        self.pc = RTCPeerConnection()
        
        # Generate unique filename for this recording
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.output_file = os.path.join(
            RECORDINGS_DIR,
            f"{self.meeting_id}_{self.participant_id}_{timestamp}.mp4"
        )
        
        @self.pc.on("track")
        async def on_track(track):
            logger.info(f"Recording track {track.kind} for participant {self.participant_id}")
            
            if track.kind == "video":
                self.video_track = track
            elif track.kind == "audio":
                self.audio_track = track
            
            # Start recording when we have at least one track
            if not self.is_recording and (self.video_track or self.audio_track):
                await self._start_recording()
            
            @track.on("ended")
            async def on_ended():
                logger.info(f"Track {track.kind} ended for participant {self.participant_id}")
                await self.stop()
        
        @self.pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Connection state for {self.participant_id}: {self.pc.connectionState}")
            if self.pc.connectionState in ["failed", "closed"]:
                await self.stop()
        
        logger.info(f"Recording session initialized for participant {self.participant_id}")
    
    async def _start_recording(self):
        """Start the media recorder with available tracks."""
        if self.is_recording:
            return
        
        try:
            # Create recorder with the output file
            self.recorder = MediaRecorder(self.output_file)
            
            # Add tracks to recorder
            if self.video_track:
                self.recorder.addTrack(self.video_track)
                logger.info(f"Added video track to recorder for {self.participant_id}")
            
            if self.audio_track:
                self.recorder.addTrack(self.audio_track)
                logger.info(f"Added audio track to recorder for {self.participant_id}")
            
            await self.recorder.start()
            self.is_recording = True
            logger.info(f"Started recording to {self.output_file}")
            
        except Exception as e:
            logger.error(f"Error starting recorder: {e}", exc_info=True)
    
    async def handle_offer(self, offer: dict) -> dict:
        """
        Handle WebRTC offer from client and return answer.
        
        Args:
            offer: Dictionary with 'sdp' and 'type' keys
            
        Returns:
            Dictionary with answer SDP
        """
        try:
            # Set remote description
            await self.pc.setRemoteDescription(
                RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
            )
            
            # Create answer
            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)
            
            return {
                "sdp": self.pc.localDescription.sdp,
                "type": self.pc.localDescription.type
            }
        except Exception as e:
            logger.error(f"Error handling offer: {e}", exc_info=True)
            raise
    
    async def add_ice_candidate(self, candidate: dict):
        """Add ICE candidate from client."""
        try:
            from aiortc import RTCIceCandidate
            ice_candidate = RTCIceCandidate(
                sdpMid=candidate.get("sdpMid"),
                sdpMLineIndex=candidate.get("sdpMLineIndex"),
                candidate=candidate.get("candidate")
            )
            await self.pc.addIceCandidate(ice_candidate)
        except Exception as e:
            logger.error(f"Error adding ICE candidate: {e}", exc_info=True)
    
    async def stop(self):
        """Stop recording and cleanup resources."""
        logger.info(f"Stopping recording session for participant {self.participant_id}")
        
        if self.recorder and self.is_recording:
            try:
                await self.recorder.stop()
                self.is_recording = False
                logger.info(f"Recording saved to {self.output_file}")
            except Exception as e:
                logger.error(f"Error stopping recorder: {e}", exc_info=True)
        
        if self.pc:
            try:
                await self.pc.close()
            except Exception as e:
                logger.error(f"Error closing peer connection: {e}", exc_info=True)


class MeetingRecorder:
    """
    Manages recording sessions for all participants in a meeting.
    """
    
    def __init__(self):
        self.sessions: Dict[str, Dict[str, MediaRecorderSession]] = {}
        # meeting_id -> {participant_id -> MediaRecorderSession}
    
    async def start_recording(self, meeting_id: str, participant_id: str) -> MediaRecorderSession:
        """
        Start a new recording session for a participant.
        
        Args:
            meeting_id: The meeting room ID
            participant_id: Unique identifier for the participant
            
        Returns:
            MediaRecorderSession instance
        """
        if meeting_id not in self.sessions:
            self.sessions[meeting_id] = {}
        
        # Create new session
        session = MediaRecorderSession(meeting_id, participant_id)
        await session.start()
        
        self.sessions[meeting_id][participant_id] = session
        logger.info(f"Started recording session for meeting {meeting_id}, participant {participant_id}")
        
        return session
    
    def get_session(self, meeting_id: str, participant_id: str) -> Optional[MediaRecorderSession]:
        """Get an existing recording session."""
        return self.sessions.get(meeting_id, {}).get(participant_id)
    
    async def stop_recording(self, meeting_id: str, participant_id: str):
        """Stop recording for a specific participant."""
        session = self.get_session(meeting_id, participant_id)
        if session:
            await session.stop()
            del self.sessions[meeting_id][participant_id]
            
            # Clean up meeting if no more participants
            if not self.sessions[meeting_id]:
                del self.sessions[meeting_id]
            
            logger.info(f"Stopped recording for meeting {meeting_id}, participant {participant_id}")
    
    async def stop_meeting_recording(self, meeting_id: str):
        """Stop all recording sessions for a meeting."""
        if meeting_id in self.sessions:
            participants = list(self.sessions[meeting_id].keys())
            for participant_id in participants:
                await self.stop_recording(meeting_id, participant_id)
            logger.info(f"Stopped all recordings for meeting {meeting_id}")
    
    def get_recordings_dir(self) -> str:
        """Get the directory where recordings are stored."""
        return RECORDINGS_DIR


# Global recorder instance
meeting_recorder = MeetingRecorder()
