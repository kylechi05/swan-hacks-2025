# SQLAlchemy Migration Guide

## Overview

The backend has been migrated from raw SQLite3 queries to SQLAlchemy ORM. This provides:

- **Type safety**: Models define the schema explicitly
- **Better maintainability**: Changes to schema are centralized in models
- **Easier queries**: No more writing raw SQL
- **Relationships**: Automatic handling of foreign keys and joins
- **Session management**: Automatic transaction handling

## Installation

Install the new dependency:

```bash
pip install -r requirements.txt
```

This will install SQLAlchemy along with the existing dependencies.

## Database Initialization

### First Time Setup

Run the initialization script to create tables and populate initial data:

```bash
cd backend
python -m src.init_db
```

This will:
1. Create all database tables
2. Populate the `subjects` table with default subjects
3. (Optional) Create sample users

### Migrating Existing Database

If you have an existing `database.db` file with data:

**Option 1: Keep existing database**
- SQLAlchemy will work with your existing SQLite database
- Just run the init script to ensure all tables exist
- Existing data will be preserved

**Option 2: Fresh start**
```bash
# Backup old database
mv src/database.db src/database.db.backup

# Initialize new database
python -m src.init_db
```

## Architecture Changes

### File Structure

```
backend/
├── src/
│   ├── models.py           # SQLAlchemy models (NEW)
│   ├── database.py         # Database configuration and session management (NEW)
│   ├── init_db.py          # Database initialization script (NEW)
│   ├── queries.py          # Common query functions (NEW)
│   ├── login.py            # Updated to use SQLAlchemy
│   ├── signup.py           # Updated to use SQLAlchemy
│   ├── subjects.py         # Updated to use SQLAlchemy
│   ├── create_event.py     # Updated to use SQLAlchemy
│   └── add_possible_tutor.py # Updated to use SQLAlchemy
└── app.py                  # Updated with DB initialization
```

### Models (src/models.py)

Defines the database schema:

- **User**: User accounts with authentication
- **Subject**: Available tutoring subjects
- **RequestedEvent**: Tutoring requests
- **Meeting**: Scheduled meetings

### Database Configuration (src/database.py)

- `init_db()`: Create all tables
- `get_db()`: Context manager for database sessions
- `close_db_session()`: Cleanup sessions

### Usage Examples

#### Creating a User

```python
from src.models import User
from src.database import get_db

with get_db() as db:
    new_user = User(
        name="John Doe",
        email="john@example.com",
        password="secure_password"
    )
    db.add(new_user)
    # Automatically committed when exiting context
```

#### Querying Users

```python
from src.models import User
from src.database import get_db

with get_db() as db:
    # Find by email
    user = db.query(User).filter(User.email == "john@example.com").first()
    
    # Get all users
    all_users = db.query(User).all()
    
    # Filter and order
    users = db.query(User).filter(
        User.name.like('%John%')
    ).order_by(User.userid.desc()).all()
```

#### Creating an Event

```python
from src.create_event import create_event
from datetime import datetime
import time

# Unix timestamps
start = int(time.time()) + 3600
end = start + 7200

event_id = create_event(
    userid_tutee=1,
    available_start=start,
    available_end=end,
    category="Mathematics",
    title="Need help with calculus",
    description="Integration problems"
)
```

#### Using Relationships

```python
from src.models import RequestedEvent, User
from src.database import get_db

with get_db() as db:
    # Get event with related user
    event = db.query(RequestedEvent).filter(
        RequestedEvent.eventid == 1
    ).first()
    
    # Access related objects
    print(f"Student: {event.tutee.name}")
    if event.tutor:
        print(f"Tutor: {event.tutor.name}")
```

## Common Queries

See `src/queries.py` for pre-built query functions:

- `get_event_by_id(eventid)`: Get event details
- `get_events_by_tutee(userid)`: Get events for a student
- `get_events_by_tutor(userid)`: Get events for a tutor
- `get_available_events(category=None)`: Get unaccepted events
- `accept_event(eventid, userid_tutor)`: Accept an event
- `delete_event(eventid)`: Soft delete an event

## Key Differences from SQLite3

### Before (SQLite3)
```python
conn = sqlite3.connect('./src/database.db')
cursor = conn.cursor()
try:
    cursor.execute("SELECT * FROM user WHERE email = ?", (email,))
    result = cursor.fetchone()
    # Process result...
    conn.commit()
finally:
    conn.close()
```

### After (SQLAlchemy)
```python
with get_db() as db:
    user = db.query(User).filter(User.email == email).first()
    # Process user object...
    # Auto-commit on context exit
```

## Benefits

1. **No more manual connection management**: Context manager handles it
2. **Type safety**: Models provide autocomplete and type checking
3. **Easier joins**: Relationships handle foreign keys automatically
4. **Transaction management**: Automatic commit/rollback
5. **Protection from SQL injection**: Parameterized queries by default
6. **Easier testing**: Can mock database sessions

## Testing

All existing functionality has been preserved. Test with:

```bash
# Test login
python -m src.login

# Test signup
python -m src.signup

# Test subjects
python -m src.subjects

# Test create event
python -m src.create_event
```

## Troubleshooting

### Import Errors
Make sure you're running from the `backend` directory:
```bash
cd backend
python -m src.init_db
```

### Database Locked
If you get "database is locked" errors:
- Make sure no other processes are using the database
- Check that old SQLite connections are closed

### Table Already Exists
SQLAlchemy uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

## Next Steps

Consider implementing:
1. Password hashing (bcrypt/argon2)
2. Database migrations (Alembic)
3. Connection pooling for production
4. PostgreSQL for production (just change DATABASE_URL)
