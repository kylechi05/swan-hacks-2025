import sqlite3
from flask_jwt_extended import create_access_token, decode_token
from datetime import datetime, timedelta

def login(email, password):
    conn = sqlite3.connect("./src/database.db")
    try:
        get_user_id = """
            select *
            from user
            where email = ?
            and password = ?
        """
        cursor = conn.cursor()
        
        cursor.execute(get_user_id, (email, password))
        result = cursor.fetchone()
        print(result)
        if result:
            additional_claims = {
                'userid': result[0],
                'email': result[1],
                'name': result[3]
            }
            token = create_access_token(
                identity=result[0],
                additional_claims=additional_claims,
                expires_delta=timedelta(hours=36)
            )
            return token
        return None
    finally:
        conn.close()
        
if __name__ == '__main__':
    token = login('carlotran4@gmail.com', '1234')
    if token:
        decoded = decode_token(token)
        print(decoded)
    else:
        print("Login failed")