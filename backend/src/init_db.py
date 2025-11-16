"""
Database initialization and migration script for SQLAlchemy.
Run this to set up the database with initial data.
"""

from database import init_db, get_db
from models import User, Subject, RequestedEvent, Meeting

# List of subjects to populate
INITIAL_SUBJECTS = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
    'History',
    'Geography',
    'Computer Science',
    'Economics',
    'Art',
    'Music',
    'Philosophy',
    'Psychology',
    'Spanish',
    'French',
    'Data Science',
    'Engineering',
    'Astronomy'
]


def populate_subjects():
    """Populate the subjects table with initial data"""
    with get_db() as db:
        # Check if subjects already exist
        existing_count = db.query(Subject).count()
        
        if existing_count > 0:
            print(f"Subjects already populated ({existing_count} subjects found)")
            return
        
        # Add all subjects
        for subject_name in INITIAL_SUBJECTS:
            subject = Subject(subject=subject_name)
            db.add(subject)
        
        print(f"Added {len(INITIAL_SUBJECTS)} subjects to the database")


def create_sample_users():
    """Create some sample users for testing (optional)"""
    with get_db() as db:
        # Check if users already exist
        existing_users = db.query(User).count()
        
        if existing_users > 0:
            print(f"Users already exist ({existing_users} users found)")
            return
        
        sample_users = [
            User(name="Carlo Tran", email="carlotran4@gmail.com", password="1234"),
            User(name="Kyle Chi", email="kyle@uiowa.edu", password="t"),
            User(name="John Doe", email="john@example.com", password="password123"),
        ]
        
        for user in sample_users:
            db.add(user)

        print(f"Added {len(sample_users)} sample users")


def main():
    """Main initialization function"""
    print("Initializing database...")
    
    # Create all tables
    init_db()
    print("Database tables created successfully")
    
    # Populate subjects
    populate_subjects()


    
    # Optionally create sample users
    # Uncomment the line below to create sample users
    create_sample_users()
    
    print("\nDatabase initialization complete!")


if __name__ == "__main__":
    main()
