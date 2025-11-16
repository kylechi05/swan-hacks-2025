import sqlite3

def add_possible_tutor(eventid, userid_tutor, start, end):
    conn = sqlite3.connect('./src/database.db')
    cursor = conn.cursor()
    