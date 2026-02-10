from typing import Optional
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request

from backend.schemas.annotation import AnnotationCreate, AnnotationRead
from backend.services.annotation_service import get_latest_annotation, create_annotation
from backend.db import connect_db

router = APIRouter(prefix="/segments", tags=["annotations"])


@router.get("/{segment_id}/annotation", response_model=AnnotationRead)
def get_annotation(segment_id: int):
    conn = connect_db()
    try:
        ann = get_latest_annotation(conn, segment_id)
        if not ann:
            raise HTTPException(status_code=404, detail="annotation not found")
        # convert created_at to native (psycopg2 returns datetime)
        return AnnotationRead(**ann)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.post("/{segment_id}/annotation", response_model=AnnotationRead, status_code=status.HTTP_201_CREATED)
def post_annotation(segment_id: int, payload: AnnotationCreate):
    conn = connect_db()
    try:
        try:
            ann = create_annotation(conn, segment_id, payload.payload, payload.schema_version, payload.created_by)
            # enqueue reindex job (do not run embedding generation synchronously)
            try:
                cur = conn.cursor()
                cur.execute("""
                CREATE TABLE IF NOT EXISTS admin_jobs (
                  id SERIAL PRIMARY KEY,
                  job_type VARCHAR NOT NULL,
                  status VARCHAR NOT NULL,
                  payload JSONB DEFAULT '{}',
                  result JSONB DEFAULT NULL,
                  message TEXT DEFAULT NULL,
                  created_at TIMESTAMPTZ DEFAULT now(),
                  finished_at TIMESTAMPTZ DEFAULT NULL
                )""")
                conn.commit()
                job_payload = json.dumps({'problem_id': segment_id})
                cur.execute("INSERT INTO admin_jobs (job_type, status, payload) VALUES (%s, %s, %s) RETURNING id", ('reindex_annotation', 'queued', job_payload))
                job_id = cur.fetchone()[0]
                conn.commit()
                try:
                    cur.close()
                except Exception:
                    pass
            except Exception:
                # fail silently to avoid blocking annotation save if job enqueue fails
                try:
                    conn.rollback()
                except Exception:
                    pass
            return AnnotationRead(**ann)
        except KeyError:
            raise HTTPException(status_code=404, detail="segment not found")
    finally:
        try:
            conn.close()
        except Exception:
            pass
