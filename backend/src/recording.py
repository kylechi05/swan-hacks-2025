"""
Client-side media recording for meeting sessions.
Records video/audio on the client using MediaRecorder API and uploads as blobs.
Automatically transcribes recordings when complete.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Directory to store recordings
RECORDINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'recordings')
os.makedirs(RECORDINGS_DIR, exist_ok=True)


def save_recording_blob(meeting_id: str, participant_id: str, blob_data: bytes, file_extension: str = 'webm') -> str:
    """
    Save uploaded recording blob to disk.
    
    Args:
        meeting_id: The meeting ID
        participant_id: The participant ID
        blob_data: The video blob bytes
        file_extension: File extension (webm, mp4, etc.)
        
    Returns:
        Path to saved file
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{meeting_id}_{participant_id}_{timestamp}.{file_extension}"
    filepath = os.path.join(RECORDINGS_DIR, filename)
    
    with open(filepath, 'wb') as f:
        f.write(blob_data)
    
    logger.info(f"Saved recording to {filepath}, size: {len(blob_data) / (1024*1024):.2f} MB")
    return filepath


async def process_uploaded_recording(meeting_id: str, participant_id: str, filepath: str):
    """
    Process an uploaded recording (transcribe, etc).
    
    Args:
        meeting_id: The meeting ID
        participant_id: The participant ID  
        filepath: Path to the saved recording file
    """
    try:
        # Import here to avoid circular dependencies
        from src.transcription import transcription_service
        
        logger.info(f"Starting background transcription for {filepath}")
        
        # Run transcription in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        transcript_path = await loop.run_in_executor(
            None,
            transcription_service.process_recording,
            filepath,
            meeting_id,
            participant_id
        )
        
        if transcript_path:
            logger.info(f"Transcription completed: {transcript_path}")
        else:
            logger.warning(f"Transcription failed for {filepath}")
            
    except Exception as e:
        logger.error(f"Error in background transcription: {e}", exc_info=True)


class MeetingRecorder:
    """
    Manages recording metadata for meetings.
    Actual recording happens client-side and is uploaded.
    """
    
    def __init__(self):
        self.active_meetings: Dict[str, Dict[str, bool]] = {}
        # meeting_id -> {participant_id -> is_recording}
    
    def start_recording(self, meeting_id: str, participant_id: str):
        """Mark a participant as actively recording."""
        if meeting_id not in self.active_meetings:
            self.active_meetings[meeting_id] = {}
        
        self.active_meetings[meeting_id][participant_id] = True
        logger.info(f"Marked recording active for meeting {meeting_id}, participant {participant_id}")
    
    def stop_recording(self, meeting_id: str, participant_id: str):
        """Mark a participant's recording as stopped."""
        if meeting_id in self.active_meetings:
            if participant_id in self.active_meetings[meeting_id]:
                del self.active_meetings[meeting_id][participant_id]
            
            # Clean up empty meetings
            if not self.active_meetings[meeting_id]:
                del self.active_meetings[meeting_id]
            
            logger.info(f"Stopped recording for meeting {meeting_id}, participant {participant_id}")
    
    def is_recording(self, meeting_id: str, participant_id: str) -> bool:
        """Check if a participant is currently recording."""
        return self.active_meetings.get(meeting_id, {}).get(participant_id, False)
    
    def get_recordings_dir(self) -> str:
        """Get the directory where recordings are stored."""
        return RECORDINGS_DIR


# Global recorder instance
meeting_recorder = MeetingRecorder()