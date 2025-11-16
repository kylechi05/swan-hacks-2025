from src.models import RequestedEvent, User, Meeting
from src.database import get_db
from datetime import datetime
from sqlalchemy import and_, or_


def get_event_by_id(eventid):
    """Get an event by its ID with related user information"""
    with get_db() as db:
        event = db.query(RequestedEvent).filter(
            RequestedEvent.eventid == eventid,
            RequestedEvent.is_deleted == False
        ).first()
        return event


def get_events_by_tutee(userid_tutee, include_deleted=False):
    """Get all events requested by a specific tutee"""
    with get_db() as db:
        query = db.query(RequestedEvent).filter(
            RequestedEvent.userid_tutee == userid_tutee
        )
        
        if not include_deleted:
            query = query.filter(RequestedEvent.is_deleted == False)
        
        events = query.order_by(RequestedEvent.available_start_time.desc()).all()
        return events


def get_events_by_tutor(userid_tutor, include_deleted=False):
    """Get all events assigned to a specific tutor"""
    with get_db() as db:
        query = db.query(RequestedEvent).filter(
            RequestedEvent.userid_tutor == userid_tutor
        )
        
        if not include_deleted:
            query = query.filter(RequestedEvent.is_deleted == False)
        
        events = query.order_by(RequestedEvent.available_start_time.desc()).all()
        return events


def get_available_events(category=None):
    """Get all available events (not yet accepted)"""
    with get_db() as db:
        query = db.query(RequestedEvent).filter(
            RequestedEvent.is_accepted == False,
            RequestedEvent.is_deleted == False
        )
        
        if category:
            query = query.filter(RequestedEvent.category == category)
        
        events = query.order_by(RequestedEvent.available_start_time.asc()).all()
        return events


def accept_event(eventid, userid_tutor):
    """Accept an event as a tutor"""
    with get_db() as db:
        event = db.query(RequestedEvent).filter(
            RequestedEvent.eventid == eventid
        ).first()
        
        if not event:
            raise ValueError(f"Event {eventid} not found")
        
        if event.is_accepted:
            raise ValueError(f"Event {eventid} is already accepted")
        
        event.userid_tutor = userid_tutor
        event.is_accepted = True
        db.flush()
        
        return event


def delete_event(eventid):
    """Soft delete an event"""
    with get_db() as db:
        event = db.query(RequestedEvent).filter(
            RequestedEvent.eventid == eventid
        ).first()
        
        if not event:
            raise ValueError(f"Event {eventid} not found")
        
        event.is_deleted = True
        db.flush()
        
        return event


def create_meeting_from_event(eventid, start_time, end_time):
    """Create a meeting from an accepted event"""
    with get_db() as db:
        event = db.query(RequestedEvent).filter(
            RequestedEvent.eventid == eventid
        ).first()
        
        if not event:
            raise ValueError(f"Event {eventid} not found")
        
        if not event.is_accepted:
            raise ValueError(f"Event {eventid} must be accepted before creating a meeting")
        
        meeting = Meeting(
            eventid=eventid,
            start_time=start_time,
            end_time=end_time
        )
        
        db.add(meeting)
        db.flush()
        
        return meeting


if __name__ == "__main__":
    # Test queries
    print("Testing event queries...")
    
    # Get available events
    available = get_available_events()
    print(f"Available events: {len(available)}")
    
    # Get events by category
    math_events = get_available_events(category="Mathematics")
    print(f"Mathematics events: {len(math_events)}")
