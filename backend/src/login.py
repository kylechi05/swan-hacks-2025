from src.models import User
from src.database import get_db
from flask_jwt_extended import create_access_token, decode_token
from datetime import timedelta


def login(email, password):
    """
    Authenticate user and return JWT token.
    
    Args:
        email: User's email
        password: User's password (plain text)
        
    Returns:
        JWT token if successful, None otherwise
    """
    with get_db() as db:
        user = db.query(User).filter(User.email == email, User.password == password).first()
        
        if user:
            additional_claims = {
                'userid': user.userid,
                'email': user.email,
                'name': user.name
            }
            token = create_access_token(
                identity=str(user.userid),  # Convert to string for JWT subject claim
                additional_claims=additional_claims,
                expires_delta=timedelta(hours=36)
            )
            return token
        
        return None

        
if __name__ == '__main__':
    token = login('carlotran4@gmail.com', '1234')
    if token:
        decoded = decode_token(token)
        print(decoded)
    else:
        print("Login failed")