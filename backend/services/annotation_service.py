import json
from typing import Optional, Dict, Any
from psycopg2 import sql

from backend.db import connect_db


def get_latest_annotation(conn, segment_id: int) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, segment_id, revision, payload, schema_version, created_by, created_at, is_latest
        FROM annotations
        WHERE segment_id = %s AND is_latest = TRUE
        """,
        (segment_id,),
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {
        "id": row[0],
        "segment_id": row[1],
        "revision": row[2],
        "payload": row[3],
        "schema_version": row[4],
        "created_by": row[5],
        "created_at": row[6],
        "is_latest": row[7],
    }


def create_annotation(conn, segment_id: int, payload: Dict[str, Any], schema_version: str, created_by: Optional[str] = None) -> Dict[str, Any]:
    cur = conn.cursor()
    # Ensure segment exists; use FOR UPDATE only on DBs that support it (Postgres)
    try:
        if getattr(conn, '_is_sqlite', False):
            cur.execute("SELECT id FROM problems WHERE id = %s", (segment_id,))
        else:
            cur.execute("SELECT id FROM problems WHERE id = %s FOR UPDATE", (segment_id,))
    except Exception:
        # fallback to plain select
        cur.execute("SELECT id FROM problems WHERE id = %s", (segment_id,))
    seg = cur.fetchone()
    if not seg:
        cur.close()
        raise KeyError("segment_not_found")

    cur.execute("SELECT MAX(revision) FROM annotations WHERE segment_id = %s", (segment_id,))
    r = cur.fetchone()
    max_rev = r[0] or 0
    new_rev = max_rev + 1

    # mark previous latest as not latest
    cur.execute("UPDATE annotations SET is_latest = FALSE WHERE segment_id = %s AND is_latest = TRUE", (segment_id,))

    cur.execute(
        """
        INSERT INTO annotations (segment_id, revision, payload, schema_version, created_by, is_latest)
        VALUES (%s, %s, %s, %s, %s, TRUE)
        RETURNING id, created_at
        """,
        (segment_id, new_rev, json.dumps(payload), schema_version, created_by),
    )
    ins = cur.fetchone()
    conn.commit()
    cur.close()
    return {
        "id": ins[0],
        "segment_id": segment_id,
        "revision": new_rev,
        "payload": payload,
        "schema_version": schema_version,
        "created_by": created_by,
        "created_at": ins[1],
        "is_latest": True,
    }
