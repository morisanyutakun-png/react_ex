import os
import shutil
import sqlite3
import glob
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, '..', 'data')
MIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'migrations')
DB_PATH = os.path.join(REPO_ROOT, '..', 'data', 'examgen.db')


def backup_db(path):
    if os.path.exists(path):
        ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        bak = path + f'.bak.{ts}'
        print('Backing up', path, '->', bak)
        shutil.copy2(path, bak)


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    backup_db(DB_PATH)
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # apply migrations in sorted order by filename
    sql_files = sorted(glob.glob(os.path.join(MIG_DIR, '*.sql')))
    for f in sql_files:
        print('Applying', f)
        with open(f, 'r', encoding='utf-8') as fh:
            sql = fh.read()
            try:
                cur.executescript(sql)
            except Exception as e:
                print('Failed to apply', f, 'error:', e)
                conn.rollback()
                cur.close()
                conn.close()
                raise
    conn.commit()
    cur.close()
    conn.close()
    print('Initialized new sqlite DB at', DB_PATH)


if __name__ == '__main__':
    init_db()
