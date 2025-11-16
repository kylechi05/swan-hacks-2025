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
    print(f"create_event called with: userid={userid_tutee}, start={available_start}, end={available_end}")
    conn = sqlite3.connect('./src/database.db')
    cursor = conn.cursor()
    try:
        available_start_time = datetime.fromtimestamp(available_start)
        available_end_time = datetime.fromtimestamp(available_end)
        
        print(f"Converted times: start={available_start_time}, end={available_end_time}")

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
        (userid_tutee, available_start_time, available_end_time, category, title, description)
        )
        
        eid = cursor.lastrowid
        conn.commit()
        
        print(f"Event created with id: {eid}")
        return eid
    except Exception as e:
        print(f"Error in create_event: {e}")
        raise
    finally:
        conn.close()
    
    
