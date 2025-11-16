from src.models import RequestedEvent
from src.database import get_db
import json

def list_offers(eventid):
    """
    List all offers made by tutors for a specific event.
    
    Args:
        eventid: ID of the requested event
    """
    with get_db() as db:
        event = db.query(RequestedEvent).filter(RequestedEvent.eventid == eventid).first()
        
        if not event:
            raise ValueError(f"Event {eventid} not found")
        
        if event.possible_tutors:
            possible_tutors_list = json.loads(event.possible_tutors)
        else:
            possible_tutors_list = []
        
        return possible_tutors_list