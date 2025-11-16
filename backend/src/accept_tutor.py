from src.models import RequestedEvent
from src.database import get_db
import json

def accept_tutor(eventid, userid_tutor):
    with get_db() as db:
        event = db.query(RequestedEvent).filter(RequestedEvent.eventid == eventid).first()

        if not event:
            raise ValueError(f"Event {eventid} not found")

        if event.possible_tutors:
            possible_tutors_list = json.loads(event.possible_tutors)
        else:
            raise ValueError(f"No possible tutors for event {eventid}")

        # Find the tutor info
        tutor_info = next((t for t in possible_tutors_list if t['userid_tutor'] == userid_tutor), None)

        if not tutor_info:
            raise ValueError(f"Tutor {userid_tutor} not found in possible tutors for event {eventid}")
        # Set the accepted tutor
        event.userid_tutor = json.dumps(tutor_info)
        event.is_accepted = True

        db.flush()
        return tutor_info

  
