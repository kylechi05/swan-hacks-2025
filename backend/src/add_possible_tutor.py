from src.models import RequestedEvent
from src.database import get_db
import json


def add_possible_tutor(eventid, userid_tutor, start, end):
    """
    Add a possible tutor to an event's list of candidates.
    
    Args:
        eventid: ID of the requested event
        userid_tutor: ID of the tutor
        start: Start time for the tutoring session
        end: End time for the tutoring session
        
    Returns:
        Updated list of possible tutors
    """
    with get_db() as db:
        event = db.query(RequestedEvent).filter(RequestedEvent.eventid == eventid).first()
        
        if not event:
            raise ValueError(f"Event {eventid} not found")
        
        # Parse existing possible tutors or create new list
        if event.possible_tutors:
            possible_tutors_list = json.loads(event.possible_tutors)
        else:
            possible_tutors_list = []
        
        # Add new tutor info
        tutor_info = {
            'userid_tutor': userid_tutor,
            'start': start,
            'end': end
        }
        
        # Check if tutor already in list
        if not any(t['userid_tutor'] == userid_tutor for t in possible_tutors_list):
            possible_tutors_list.append(tutor_info)
        
        # Update event
        event.possible_tutors = json.dumps(possible_tutors_list)
        db.flush()

        
        
        return possible_tutors_list



        
