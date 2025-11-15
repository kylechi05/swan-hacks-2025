import sqlite3

def login(email, password):
    conn = sqlite3.connect("database.db")
    try:
        ddl = """
            create table if not exists user_login (
                userid INTEGER PRIMARY KEY,
                name TEXT,
                email TEXT,
                password TEXT
            );
        """
        get_user_id = """
            select userid
            from user_login
            where email = ?
            and password = ?
        """
        cursor = conn.cursor()
        cursor.execute(ddl)
        conn.commit()
        
        cursor.execute(get_user_id, (email, password))
        result = cursor.fetchone()
        return result[0] if result else None
    finally:
        conn.close()