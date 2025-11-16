from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from contextlib import contextmanager
from models import Base
import os

# Get the directory where this file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database configuration - use absolute path for SQLite
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{os.path.join(BASE_DIR, "database.db")}')

# Create engine
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    connect_args={'check_same_thread': False} if 'sqlite' in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create scoped session for thread-safety
db_session = scoped_session(SessionLocal)


def init_db():
    """Initialize the database, creating all tables"""
    Base.metadata.create_all(bind=engine)


def drop_all():
    """Drop all tables (use with caution!)"""
    Base.metadata.drop_all(bind=engine)


@contextmanager
def get_db():
    """
    Context manager for database sessions.
    Usage:
        with get_db() as db:
            user = db.query(User).first()
    """
    session = db_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_session():
    """
    Get a database session (for use in Flask routes).
    Remember to close the session after use!
    """
    return db_session()


def close_db_session():
    """Remove the current session"""
    db_session.remove()
