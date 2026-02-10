import os
import shutil
import sqlite3
import glob
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'migrations')
DB_PATH = os.path.join(REPO_ROOT, '..', 'data', 'examgen.db')


def init_db_force():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    # Remove existing DB without backup
    if os.path.exists(DB_PATH):
        print('Removing existing DB at', DB_PATH)
        try:
            os.remove(DB_PATH)
        except Exception as e:
            print('Failed to remove DB:', e)
            raise
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # For sqlite local dev, apply a targeted sqlite schema rather than the
    # full Postgres migrations which include unsupported extensions.
    sqlite_schema = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sqlite_init.sql')
    print('Applying sqlite schema:', sqlite_schema)
    with open(sqlite_schema, 'r', encoding='utf-8') as fh:
        sql = fh.read()
        cur.executescript(sql)
    conn.commit()
    cur.close()
    conn.close()
    print('Initialized new sqlite DB at', DB_PATH)


if __name__ == '__main__':
    init_db_force()
