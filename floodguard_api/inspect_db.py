import sqlite3
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
print('Tables:', tables)
for t in tables:
    print('\n---', t[0], '---')
    cursor.execute("SELECT sql FROM sqlite_master WHERE name=?", (t[0],))
    print(cursor.fetchone()[0])
conn.close()
