from src.models import RequestedEvent
from src.database import get_db
from datetime import datetime


def create_event(
    userid_tutee,
    available_start,
    available_end,
    category,
    title,
    description
):
    """
    Create a new tutoring event request.
    
    Args:
        userid_tutee: ID of the student requesting tutoring
        available_start: Unix timestamp for start time
        available_end: Unix timestamp for end time
        category: Subject category
        title: Event title
        description: Event description
        
    Returns:
        Event ID of the created event
    """
    print(f"create_event called with: userid={userid_tutee}, start={available_start}, end={available_end}")
    
    with get_db() as db:
        # Convert Unix timestamps to datetime objects
        available_start_time = datetime.fromtimestamp(available_start)
        available_end_time = datetime.fromtimestamp(available_end)
        
        print(f"Converted times: start={available_start_time}, end={available_end_time}")
        
        # Create new event
        new_event = RequestedEvent(
            userid_tutee=userid_tutee,
            available_start_time=available_start_time,
            available_end_time=available_end_time,
            category=category,
            title=title,
            description=description,
            is_accepted=False,
            is_deleted=False
        )
        
        db.add(new_event)
        db.flush()  # Flush to get the eventid
        
        eid = new_event.eventid
        print(f"Event created with id: {eid}")
        
        return eid


if __name__ == "__main__":
    # Test the function
    from datetime import datetime
    import time
    
    # Create a test event
    start = int(time.time()) + 3600  # 1 hour from now
    end = start + 7200  # 2 hours duration
    
    eid = create_event(
        userid_tutee=1,
        available_start=start,
        available_end=end,
        category="Mathematics",
        title="Need help with calculus",
        description="Having trouble with integration"
    )
    print(f"Created event with ID: {eid}")
