from src.models import User
from src.database import get_db
from sqlalchemy.exc import IntegrityError


def signup(name, email, password):
    """
    Create a new user account.
    
    Args:
        name: User's full name
        email: User's email (must be unique)
        password: User's password (plain text - should be hashed in production!)
        
    Raises:
        Exception: If user already exists
    """
    with get_db() as db:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            raise Exception('User already exists')
        
        # Create new user
        new_user = User(
            name=name,
            email=email,
            password=password
        )
        
        try:
            db.add(new_user)
            db.flush()  # Flush to get the userid
            print(f"User created with ID: {new_user.userid}")
        except IntegrityError:
            raise Exception('User already exists')


if __name__ == "__main__":
    signup("Carlo Tran", "carlotran4@gmail.com", "1234")
