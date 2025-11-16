import sqlite3
from datetime import datetime

def create_event(
    userid_tutee,
    available_start,
    available_end,
    category,
    title,
    description
):
    conn = sqlite3.connect('./src/database.db')
    cursor = conn.cursor()
    try:
        available_start_time = datetime(second=available_start)
        available_end_time = datetime(second=available_end)

        cursor.execute('''
            insert into requested_event (
            userid_tutee,
            available_start_time,
            available_end_time,
            category,
            title,
            description
            ) values (?, ?, ?, ?, ?, ?)
        ''', 
        userid_tutee, available_start_time, available_end_time, category, title, description
        )
        
        eid = cursor.lastrowid
        conn.commit()
        
        return eid
    finally:
        conn.close()
    
    
