import os
import logging
import json
import sqlite3
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

logger = logging.getLogger(__name__)


def _normalize_database_url(url: str) -> str:
    """Normalize DATABASE_URL for compatibility.

    - Neon / Heroku often use 'postgres://' which SQLAlchemy / psycopg2 don't accept;
      rewrite to 'postgresql://'.
    - Ensure sslmode=require is present for remote Postgres (Neon requires SSL).
    """
    if not url:
        return url
    # scheme fix
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    # add sslmode=require for remote PG when not already set
    parsed = urlparse(url)
    if parsed.scheme.startswith('postgresql'):
        qs = parse_qs(parsed.query)
        if 'sslmode' not in qs:
            # Only add for non-localhost (Neon, Render Postgres, etc.)
            host = parsed.hostname or ''
            if host not in ('localhost', '127.0.0.1', '::1', 'db'):
                qs['sslmode'] = ['require']
                new_query = urlencode(qs, doseq=True)
                parsed = parsed._replace(query=new_query)
                url = urlunparse(parsed)
    return url


def _ensure_data_dir(path='data'):
    try:
        os.makedirs(path, exist_ok=True)
    except Exception:
        logger.exception('Failed to create data directory')


class SQLiteCursorWrapper:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, params=None):
        # adapt %s -> ? parameter style
        import time
        max_retries = 6
        delay = 0.05
        if params is None:
            q = sql
            adapted = None
        else:
            # convert list params to JSON strings for storage/compat
            adapted = []
            for p in params:
                if isinstance(p, (list, dict)):
                    adapted.append(json.dumps(p, ensure_ascii=False))
                else:
                    adapted.append(p)
            # replace %s with ? for sqlite
            q = sql.replace('%s', '?')

        # retry loop to handle occasional sqlite 'database is locked' errors
        for attempt in range(max_retries):
            try:
                if adapted is None:
                    return self._cur.execute(q)
                return self._cur.execute(q, adapted)
            except Exception as e:
                # only retry on sqlite locked errors
                msg = str(e).lower()
                if 'database is locked' in msg or 'locked' in msg:
                    if attempt + 1 == max_retries:
                        raise
                    time.sleep(delay)
                    delay = min(delay * 2, 1.0)
                    continue
                raise

    def executemany(self, sql, seq_of_params):
        q = sql.replace('%s', '?')
        adapted_seq = []
        for params in seq_of_params:
            adapted = []
            for p in params:
                if isinstance(p, (list, dict)):
                    adapted.append(json.dumps(p, ensure_ascii=False))
                else:
                    adapted.append(p)
            adapted_seq.append(adapted)
        return self._cur.executemany(q, adapted_seq)

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def close(self):
        try:
            return self._cur.close()
        except Exception:
            pass


class SQLiteConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
        self._is_sqlite = True

    def cursor(self):
        return SQLiteCursorWrapper(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()


def connect_db(db_url: str = None):
    db = db_url or os.environ.get('DATABASE_URL')
    # default to sqlite file in ./data for development
    if not db:
        # Resolve repository root relative to this file so behavior is cwd-independent
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(repo_root, 'data')
        _ensure_data_dir(data_dir)
        db = f"sqlite:///{os.path.join(data_dir, 'examgen.db')}"
        logger.info('No DATABASE_URL set; defaulting to sqlite DB at %s', db)

    # Normalize for Neon / remote Postgres compatibility
    db = _normalize_database_url(db)

    parsed = urlparse(db)
    scheme = parsed.scheme

    if scheme.startswith('sqlite'):
        # ensure ./data exists
        _ensure_data_dir('data')
        # path like sqlite:///./data/examgen.db -> file path is parsed.path
        # For relative paths, parsed.path may begin with '/./data/...'
        # use the part after the scheme
        # Use sqlite3 to connect; allow multi-thread use in FastAPI
        path = db.replace('sqlite:///', '')
        try:
            conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
            # default row factory
            conn.row_factory = None
            # set pragmas to improve concurrency
            try:
                conn.execute("PRAGMA journal_mode=WAL;")
            except Exception:
                # ignore if unsupported
                pass
            try:
                conn.execute("PRAGMA busy_timeout = 5000;")
            except Exception:
                pass
            return SQLiteConnectionWrapper(conn)
        except Exception:
            logger.exception('Failed to open sqlite DB at %s', path)
            raise

    # fallback: assume a Postgres-style DSN; use psycopg2 if available
    try:
        from psycopg2 import connect as pg_connect

        return pg_connect(db)
    except Exception:
        logger.exception('Primary DB connection failed (psycopg2)')
        # try docker-host fallback when DATABASE_URL references the service name 'db'
        try:
            if parsed.hostname == 'db':
                userinfo = ''
                if parsed.username:
                    userinfo += parsed.username
                    if parsed.password:
                        userinfo += ':' + parsed.password
                    userinfo += '@'
                netloc = userinfo + 'localhost:5433'
                new = parsed._replace(netloc=netloc)
                from urllib.parse import urlunparse

                fallback = urlunparse(new)
                try:
                    logger.info('Attempting DB fallback to %s', fallback)
                    return pg_connect(fallback)
                except Exception:
                    logger.exception('Fallback DB connection failed')
        except Exception:
            logger.exception('Error while attempting DB fallback')
        raise
