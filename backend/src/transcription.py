"""
Audio transcription service using Google Cloud Speech-to-Text API.
Extracts audio from video files and transcribes them.
"""

import os
import logging
import subprocess
import json
from pathlib import Path
from typing import Optional, Dict, List
from google.cloud import speech_v1p1beta1 as speech
from google.cloud import storage

logger = logging.getLogger(__name__)

# Directory to store audio files and transcriptions
AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'audio')
TRANSCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'transcripts')
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)


class TranscriptionService:
    """
    Service for extracting audio from videos and transcribing with Google Cloud Speech-to-Text.
    """
    
    def __init__(self):
        """Initialize the transcription service."""
        self.client: Optional[speech.SpeechClient] = None
        self._init_client()
    
    def _init_client(self):
        """Initialize Google Cloud Speech client."""
        try:
            # Check if credentials are set
            if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
                self.client = speech.SpeechClient()
                logger.info("Google Cloud Speech client initialized successfully")
            else:
                logger.warning("GOOGLE_APPLICATION_CREDENTIALS not set. Transcription will be disabled.")
        except Exception as e:
            logger.error(f"Error initializing Google Cloud Speech client: {e}", exc_info=True)
            self.client = None
    
    def extract_audio(self, video_path: str) -> Optional[str]:
        """
        Extract audio from video file as MP3.
        
        Args:
            video_path: Path to the video file
            
        Returns:
            Path to the extracted audio file, or None if extraction failed
        """
        try:
            # Generate output path
            video_name = Path(video_path).stem
            audio_path = os.path.join(AUDIO_DIR, f"{video_name}.mp3")
            
            # Check if video file exists
            if not os.path.exists(video_path):
                logger.error(f"Video file not found: {video_path}")
                return None
            
            # Extract audio using ffmpeg
            # Convert to mono, 16kHz sample rate (optimal for speech recognition)
            command = [
                'ffmpeg',
                '-i', video_path,
                '-vn',  # No video
                '-acodec', 'libmp3lame',
                '-ac', '1',  # Mono
                '-ar', '16000',  # 16kHz sample rate
                '-ab', '64k',  # 64kbps bitrate
                '-y',  # Overwrite output file
                audio_path
            ]
            
            logger.info(f"Extracting audio from {video_path} to {audio_path}")
            result = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                logger.info(f"Audio extracted successfully: {audio_path}")
                return audio_path
            else:
                logger.error(f"FFmpeg error: {result.stderr.decode()}")
                return None
                
        except subprocess.TimeoutExpired:
            logger.error(f"Audio extraction timed out for {video_path}")
            return None
        except Exception as e:
            logger.error(f"Error extracting audio from {video_path}: {e}", exc_info=True)
            return None
    
    def transcribe_audio_local(self, audio_path: str, language_code: str = "en-US") -> Optional[Dict]:
        """
        Transcribe audio file using Google Cloud Speech-to-Text (local file).
        For files under 60 seconds.
        
        Args:
            audio_path: Path to the audio file
            language_code: Language code (e.g., 'en-US', 'es-ES')
            
        Returns:
            Transcription result dictionary or None if transcription failed
        """
        if not self.client:
            logger.error("Google Cloud Speech client not initialized")
            return None
        
        try:
            # Read audio file
            with open(audio_path, 'rb') as audio_file:
                content = audio_file.read()
            
            audio = speech.RecognitionAudio(content=content)
            
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.MP3,
                sample_rate_hertz=16000,
                language_code=language_code,
                enable_automatic_punctuation=True,
                enable_word_time_offsets=True,
                model='video',  # Optimized for video
            )
            
            logger.info(f"Transcribing audio file: {audio_path}")
            response = self.client.recognize(config=config, audio=audio)
            
            # Process results
            transcript_text = ""
            words = []
            
            for result in response.results:
                alternative = result.alternatives[0]
                transcript_text += alternative.transcript + " "
                
                # Extract word-level timestamps
                for word_info in alternative.words:
                    words.append({
                        'word': word_info.word,
                        'start_time': word_info.start_time.total_seconds(),
                        'end_time': word_info.end_time.total_seconds(),
                        'confidence': alternative.confidence
                    })
            
            result_dict = {
                'transcript': transcript_text.strip(),
                'words': words,
                'language': language_code
            }
            
            logger.info(f"Transcription completed: {len(transcript_text)} characters")
            return result_dict
            
        except Exception as e:
            logger.error(f"Error transcribing audio {audio_path}: {e}", exc_info=True)
            return None
    
    def transcribe_audio_long(self, audio_path: str, gcs_uri: Optional[str] = None, 
                            language_code: str = "en-US") -> Optional[Dict]:
        """
        Transcribe long audio file using Google Cloud Speech-to-Text (async).
        For files over 60 seconds, requires Google Cloud Storage.
        
        Args:
            audio_path: Path to the audio file
            gcs_uri: Google Cloud Storage URI (gs://bucket/path), optional
            language_code: Language code
            
        Returns:
            Transcription result dictionary or None if transcription failed
        """
        if not self.client:
            logger.error("Google Cloud Speech client not initialized")
            return None
        
        try:
            # If no GCS URI provided, use local file (will fail for files > 10MB)
            if gcs_uri:
                audio = speech.RecognitionAudio(uri=gcs_uri)
            else:
                with open(audio_path, 'rb') as audio_file:
                    content = audio_file.read()
                audio = speech.RecognitionAudio(content=content)
            
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.MP3,
                sample_rate_hertz=16000,
                language_code=language_code,
                enable_automatic_punctuation=True,
                enable_word_time_offsets=True,
                model='video',
            )
            
            logger.info(f"Starting long audio transcription: {audio_path}")
            operation = self.client.long_running_recognize(config=config, audio=audio)
            
            logger.info("Waiting for transcription to complete...")
            response = operation.result(timeout=600)  # 10 minute timeout
            
            # Process results
            transcript_text = ""
            words = []
            
            for result in response.results:
                alternative = result.alternatives[0]
                transcript_text += alternative.transcript + " "
                
                for word_info in alternative.words:
                    words.append({
                        'word': word_info.word,
                        'start_time': word_info.start_time.total_seconds(),
                        'end_time': word_info.end_time.total_seconds(),
                        'confidence': alternative.confidence
                    })
            
            result_dict = {
                'transcript': transcript_text.strip(),
                'words': words,
                'language': language_code
            }
            
            logger.info(f"Long transcription completed: {len(transcript_text)} characters")
            return result_dict
            
        except Exception as e:
            logger.error(f"Error transcribing long audio {audio_path}: {e}", exc_info=True)
            return None
    
    def save_transcript(self, meeting_id: str, participant_id: str, 
                       transcript_data: Dict) -> str:
        """
        Save transcript to JSON file.
        
        Args:
            meeting_id: Meeting ID
            participant_id: Participant ID
            transcript_data: Transcription result dictionary
            
        Returns:
            Path to the saved transcript file
        """
        try:
            filename = f"{meeting_id}_{participant_id}_transcript.json"
            filepath = os.path.join(TRANSCRIPTS_DIR, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(transcript_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Transcript saved to {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Error saving transcript: {e}", exc_info=True)
            return ""
    
    def process_recording(self, video_path: str, meeting_id: str, 
                         participant_id: str, language_code: str = "en-US") -> Optional[str]:
        """
        Complete pipeline: extract audio, transcribe, and save.
        
        Args:
            video_path: Path to the video file
            meeting_id: Meeting ID
            participant_id: Participant ID
            language_code: Language code for transcription
            
        Returns:
            Path to the transcript file, or None if processing failed
        """
        try:
            logger.info(f"Starting transcription pipeline for {video_path}")
            
            # Step 1: Extract audio
            audio_path = self.extract_audio(video_path)
            if not audio_path:
                logger.error("Audio extraction failed")
                return None
            
            # Step 2: Get audio duration to decide which method to use
            audio_size = os.path.getsize(audio_path)
            
            # Use long_running_recognize for files > 10MB (roughly > 1 minute)
            if audio_size > 10 * 1024 * 1024:
                logger.info("Using long-running transcription for large file")
                transcript_data = self.transcribe_audio_long(audio_path, language_code=language_code)
            else:
                logger.info("Using synchronous transcription for small file")
                transcript_data = self.transcribe_audio_local(audio_path, language_code=language_code)
            
            if not transcript_data:
                logger.error("Transcription failed")
                return None
            
            # Step 3: Save transcript
            transcript_path = self.save_transcript(meeting_id, participant_id, transcript_data)
            
            logger.info(f"Transcription pipeline completed: {transcript_path}")
            return transcript_path
            
        except Exception as e:
            logger.error(f"Error in transcription pipeline: {e}", exc_info=True)
            return None
    
    def get_transcripts_dir(self) -> str:
        """Get the directory where transcripts are stored."""
        return TRANSCRIPTS_DIR
    
    def get_audio_dir(self) -> str:
        """Get the directory where audio files are stored."""
        return AUDIO_DIR


# Global transcription service instance
transcription_service = TranscriptionService()
