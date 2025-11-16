from src.models import Meeting
from src.database import get_db
import datetime

def add_meeting(eventid, start, end):
    """
    Add a meeting record to the database.
    
    Args:
        eventid: ID of the requested event
        start: Start time of the meeting
        end: End time of the meeting
    """
    with get_db() as db:
        meeting = Meeting(
            eventid=eventid,
            start_time=datetime.fromtimestamp(start),
            end_time=datetime.fromtimestamp(end)
        )
        db.add(meeting)
        db.flush()
        
        return meeting.eventid