"""
Server-side media recording for meeting sessions.
Uses aiortc to create a silent listener that records both audio and video streams.
Automatically transcribes recordings when complete.
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
            logger.info(f"[Recording] Received track {track.kind} for participant {self.participant_id}")
            logger.info(f"[Recording] Track ID: {track.id}")
            
            if track.kind == "video":
                self.video_track = track
                logger.info(f"[Recording] Set video track for {self.participant_id}")
            elif track.kind == "audio":
                self.audio_track = track
                logger.info(f"[Recording] Set audio track for {self.participant_id}")
            
            # Log current state
            logger.info(f"[Recording] Current state for {self.participant_id}: video={bool(self.video_track)}, audio={bool(self.audio_track)}, is_recording={self.is_recording}")
            
            # Start recording immediately when we have both tracks
            # Since we only start recording when both participants are present,
            # both audio and video tracks should arrive together
            if not self.is_recording and self.video_track and self.audio_track:
                logger.info(f"[Recording] Both tracks received, starting recording for {self.participant_id}")
                await self._start_recording()
            elif not self.is_recording:
                logger.info(f"[Recording] Waiting for more tracks for {self.participant_id}. video={bool(self.video_track)}, audio={bool(self.audio_track)}")
                # Schedule a delayed start in case tracks arrive slowly
                asyncio.create_task(self._delayed_start_check())
            
            @track.on("ended")
            async def on_ended():
                logger.info(f"Track {track.kind} ended for participant {self.participant_id}")
                await self.stop()
        
        @self.pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Connection state for {self.participant_id}: {self.pc.connectionState}")
            if self.pc.connectionState in ["failed", "closed"]:
                await self.stop()
        
        @self.pc.on("iceconnectionstatechange")
        async def on_iceconnectionstatechange():
            logger.info(f"ICE connection state for {self.participant_id}: {self.pc.iceConnectionState}")
        
        @self.pc.on("icegatheringstatechange")
        async def on_icegatheringstatechange():
            logger.info(f"ICE gathering state for {self.participant_id}: {self.pc.iceGatheringState}")
        
        logger.info(f"Recording session initialized for participant {self.participant_id}")
    
    async def _delayed_start_check(self):
        """Check if we can start recording after a delay, in case tracks arrive slowly."""
        await asyncio.sleep(2.0)  # Wait 2 seconds
        if not self.is_recording and self.video_track and self.audio_track:
            logger.info(f"[Recording] Delayed check: Both tracks now available for {self.participant_id}, starting recording")
            await self._start_recording()
        elif not self.is_recording:
            logger.warning(f"[Recording] Delayed check: Still missing tracks for {self.participant_id}. video={bool(self.video_track)}, audio={bool(self.audio_track)}")
    
    async def _start_recording(self):
        """Start the media recorder with available tracks."""
        if self.is_recording:
            return
        
        try:
            logger.info(f"[Recording] _start_recording called for {self.participant_id}")
            logger.info(f"[Recording] video_track={self.video_track}, audio_track={self.audio_track}")
            
            # Create recorder with the output file and format options
            # Use mp4 container with h264 video codec
            self.recorder = MediaRecorder(
                self.output_file,
                format="mp4"
            )
            
            # Add tracks to recorder
            if self.video_track:
                self.recorder.addTrack(self.video_track)
                logger.info(f"[Recording] Added video track to recorder for {self.participant_id}")
            else:
                logger.warning(f"[Recording] No video track available for {self.participant_id}")
            
            if self.audio_track:
                self.recorder.addTrack(self.audio_track)
                logger.info(f"[Recording] Added audio track to recorder for {self.participant_id}")
            else:
                logger.warning(f"[Recording] No audio track available for {self.participant_id}")
            
            await self.recorder.start()
            self.is_recording = True
            logger.info(f"[Recording] Started recording to {self.output_file}")
            
        except Exception as e:
            logger.error(f"[Recording] Error starting recorder: {e}", exc_info=True)
    
    async def handle_offer(self, offer: dict) -> dict:
        """
        Handle WebRTC offer from client and return answer.
        
        Args:
            offer: Dictionary with 'sdp' and 'type' keys
            
        Returns:
            Dictionary with answer SDP
        """
        try:
            # Set remote description from client's offer
            offer_desc = RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
            await self.pc.setRemoteDescription(offer_desc)
            
            logger.info(f"Set remote description for {self.participant_id}")
            logger.info(f"Remote transceivers count: {len(self.pc.getTransceivers())}")
            
            # Log what tracks we're expecting
            for transceiver in self.pc.getTransceivers():
                logger.info(f"Transceiver: {transceiver.kind}, direction: {transceiver.direction}")
            
            # Create answer
            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)
            
            logger.info(f"Created answer with {len(self.pc.getTransceivers())} transceivers")
            
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
            from aiortc.sdp import candidate_from_sdp
            candidate_str = candidate.get("candidate")
            if candidate_str and self.pc:
                ice_candidate = candidate_from_sdp(candidate_str)
                ice_candidate.sdpMid = candidate.get("sdpMid")
                ice_candidate.sdpMLineIndex = candidate.get("sdpMLineIndex")
                await self.pc.addIceCandidate(ice_candidate)
        except Exception as e:
            logger.error(f"Error adding ICE candidate: {e}", exc_info=True)
    
    async def stop(self):
        """Stop recording and cleanup resources."""
        logger.info(f"Stopping recording session for participant {self.participant_id}")
        
        output_file = self.output_file  # Save reference before cleanup
        meeting_id = self.meeting_id
        participant_id = self.participant_id
        
        if self.recorder and self.is_recording:
            try:
                await self.recorder.stop()
                self.is_recording = False
                logger.info(f"Recording saved to {output_file}")
                
                # Check if file was actually created and has content
                if output_file and os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                    # Trigger transcription in background (non-blocking)
                    asyncio.create_task(self._transcribe_recording(output_file, meeting_id, participant_id))
                else:
                    logger.warning(f"Recording file is empty or doesn't exist: {output_file}")
                
            except Exception as e:
                logger.error(f"Error stopping recorder: {e}", exc_info=True)
                # Try to delete corrupted file
                try:
                    if output_file and os.path.exists(output_file):
                        os.remove(output_file)
                        logger.info(f"Removed corrupted recording file: {output_file}")
                except Exception as cleanup_error:
                    logger.error(f"Error cleaning up corrupted file: {cleanup_error}")
        
        if self.pc:
            try:
                # Check if we're in an active event loop
                try:
                    asyncio.get_running_loop()
                    await self.pc.close()
                except RuntimeError:
                    # Event loop is closed, best effort cleanup
                    logger.warning(f"Event loop closed while stopping peer connection for {self.participant_id}")
            except Exception as e:
                logger.error(f"Error closing peer connection: {e}", exc_info=True)
    
    async def _transcribe_recording(self, video_path: str, meeting_id: str, participant_id: str):
        """
        Transcribe the recording in the background.
        
        Args:
            video_path: Path to the video file
            meeting_id: Meeting ID
            participant_id: Participant ID
        """
        try:
            # Import here to avoid circular dependencies
            from src.transcription import transcription_service
            
            logger.info(f"Starting background transcription for {video_path}")
            
            # Run transcription in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            transcript_path = await loop.run_in_executor(
                None,
                transcription_service.process_recording,
                video_path,
                meeting_id,
                participant_id
            )
            
            if transcript_path:
                logger.info(f"Transcription completed: {transcript_path}")
            else:
                logger.warning(f"Transcription failed for {video_path}")
                
        except Exception as e:
            logger.error(f"Error in background transcription: {e}", exc_info=True)


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
