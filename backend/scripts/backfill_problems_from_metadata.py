#!/usr/bin/env python3
"""Backfill `problems.explanation` and `problems.answer_brief` from `metadata`.

Usage:
  # use DATABASE_URL env var (default behavior)
  python backend/scripts/backfill_problems_from_metadata.py

  # or explicitly provide DB URL
  python backend/scripts/backfill_problems_from_metadata.py --db sqlite:///data/db/dev.db

This script supports Postgres (psycopg2) and SQLite (sqlite3).
It will run the appropriate SQL file in `backend/db/` depending on the engine.
"""
import os
import sys
import argparse
from urllib.parse import urlparse


def run_sql_file_pg(conn, path):
    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()
    cur = conn.cursor()
    cur.execute('BEGIN;')
    try:
        cur.execute(sql)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def run_sql_file_sqlite(db_path, path):
    import sqlite3
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        with open(path, 'r', encoding='utf-8') as f:
            sql = f.read()
        cur.executescript(sql)
        conn.commit()
    finally:
        conn.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--db', help='Database URL (overrides DATABASE_URL env)')
    p.add_argument('--yes', action='store_true', help='Skip confirmation')
    args = p.parse_args()

    db_url = args.db or os.environ.get('DATABASE_URL')
    if not db_url:
        print('No DATABASE_URL set and --db not provided. Aborting.')
        sys.exit(2)

    parsed = urlparse(db_url)
    scheme = parsed.scheme

    if not args.yes:
        print('About to run backfill on', db_url)
        ans = input('Proceed? [y/N] ').strip().lower()
        if ans != 'y':
            print('Aborted')
            sys.exit(1)

    script_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'db')
    if scheme.startswith('postgres') or scheme in ('postgresql', 'pgsql'):
        try:
            import psycopg2
        except Exception as e:
            print('psycopg2 required for Postgres. Install it into your environment.')
            raise
        sql_path = os.path.join(script_dir, 'backfill_problems_from_metadata_pg.sql')
        conn = psycopg2.connect(db_url)
        try:
            run_sql_file_pg(conn, sql_path)
            print('Backfill completed (Postgres).')
        finally:
            conn.close()
    elif scheme.startswith('sqlite') or scheme == 'sqlite':
        # sqlite:///path/to/db
        # remove sqlite:// prefix
        if db_url.startswith('sqlite:///'):
            db_path = db_url.replace('sqlite:///', '', 1)
        elif db_url.startswith('sqlite://'):
            db_path = db_url.replace('sqlite://', '', 1)
        else:
            db_path = db_url
        sql_path = os.path.join(script_dir, 'backfill_problems_from_metadata_sqlite.sql')
        run_sql_file_sqlite(db_path, sql_path)
        print('Backfill completed (SQLite).')
    else:
        print('Unsupported DB scheme:', scheme)
        sys.exit(2)


if __name__ == '__main__':
    main()
