import sqlite3

def signup(name, email, password):
    try:
        insert = """
            insert into user (email, password, name) VALUES (?, ?, ?);
        """
        conn = sqlite3.connect("database.db")
        cursor = conn.cursor()
        cursor.execute(insert, (email, password, name))
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    signup("Carlo Tran", "carlotran4@gmail.com", "1234")
