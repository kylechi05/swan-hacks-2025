import sqlite3

def signup(name, email, password):
    try:
        ddl = """
            create table if not exists user_login (
                userid INTEGER PRIMARY KEY,
                name TEXT,
                email TEXT,
                password TEXT
            );
        """
        insert = """
            insert into user_login (name, email, password) VALUES (?, ?, ?);
        """
        conn = sqlite3.connect("database.db")
        cursor = conn.cursor()
        cursor.execute(ddl)
        cursor.execute(insert, (name, email, password))
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    signup("Carlo Tran", "carlotran4@gmail.com", "1234")
