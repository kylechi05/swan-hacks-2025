import sqlite3

def signup(name, email, password):
    try:
        user_exists = f"""
            select count(*) from user where email = '{email}';
        """
        insert = """
            insert into user (email, password, name) VALUES (?, ?, ?);
        """
        conn = sqlite3.connect("./src/database.db")
        cursor = conn.cursor()
        
        cursor.execute(user_exists)
        count = cursor.fetchone()[0]
        print(count)
        if(count > 0):
            raise Exception('User already exists')
        cursor.execute(insert, (email, password, name))
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    signup("Carlo Tran", "carlotran4@gmail.com", "1234")
