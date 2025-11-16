from src.models import RequestedEvent
from src.database import get_db
import json

def list_events():
    """
    List all requested events in the database.
    
    Returns:
        A list of all requested events with their details.
    """
    with get_db() as db:
        events = db.query(RequestedEvent).all()
        event_list = []
        
        for event in events:
            event_data = {
                'eventid': event.eventid,
                'userid_tutee': event.userid_tutee,
                'title': event.title,
                'category': event.category,
                'description': event.description,
                'possible_tutors': json.loads(event.possible_tutors) if event.possible_tutors else [],
                'userid_tutor': json.loads(event.userid_tutor) if event.userid_tutor else None,
                'is_accepted': event.is_accepted,
                'available_start_time': event.available_start_time,
                'available_end_time': event.available_end_time
            }
            event_list.append(event_data)
        
        return event_list

def list_tutee_events(userid_tutee):
    """
    Lists the events requested by a specific tutee.
    """
    with get_db() as db:
        events = db.query(RequestedEvent).filter(RequestedEvent.userid_tutee == userid_tutee).all()
        event_list = []
        
        for event in events:
            event_data = {
                'eventid': event.eventid,
                'userid_tutee': event.userid_tutee,
                'title': event.title,
                'category': event.category,
                'description': event.description,
                'possible_tutors': json.loads(event.possible_tutors) if event.possible_tutors else [],
                'userid_tutor': json.loads(event.userid_tutor) if event.userid_tutor else None,
                'is_accepted': event.is_accepted,
                'available_start_time': event.available_start_time,
                'available_end_time': event.available_end_time
            }
            event_list.append(event_data)
        
        return event_list

def list_tutor_events(userid_tutor):
    """
    Lists the events where a specific tutor has made offers.
    """
    with get_db() as db:
        events = db.query(RequestedEvent).all()
        tutor_event_list = []
        
        for event in events:
            if event.possible_tutors:
                possible_tutors_list = json.loads(event.possible_tutors)
                if any(t['userid_tutor'] == userid_tutor for t in possible_tutors_list):
                    event_data = {
                        'eventid': event.eventid,
                        'userid_tutee': event.userid_tutee,
                        'title': event.title,
                        'category': event.category,
                        'description': event.description,
                        'possible_tutors': possible_tutors_list,
                        'userid_tutor': json.loads(event.userid_tutor) if event.userid_tutor else None,
                        'is_accepted': event.is_accepted,
                        'available_start_time': event.available_start_time,
                        'available_end_time': event.available_end_time
                    }
                    tutor_event_list.append(event_data)
        
        return tutor_event_list