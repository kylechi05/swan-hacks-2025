from src.models import Subject
from src.database import get_db


def subjects():
    """
    Get all available subjects.
    
    Returns:
        List of subject names
    """
    with get_db() as db:
        all_subjects = db.query(Subject.subject).all()
        return [subject[0] for subject in all_subjects]


if __name__ == "__main__":
    print(subjects())
