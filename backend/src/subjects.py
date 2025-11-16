import sqlite3

def subjects():
    conn = sqlite3.connect("./src/database.db")
    cursor = conn.cursor()
    cursor.execute('select * from subjects')
    projects = [x[0] for x in cursor.fetchall()]
    conn.close()
    
    return projects
