#!/usr/bin/env python3
"""Worker to process reindex_annotation admin_jobs and upsert embeddings.

Run as a long-running process: python workers/reindex/reindex_worker.py
"""
import os
import time
import json
import traceback

from backend.embeddings import load_model, encode_texts, vector_to_sql_literal, get_vector_dim_from_db
from backend.db import connect_db


JOB_TYPE = 'reindex_annotation'
KIND = os.environ.get('REINDEX_EMBEDDING_KIND', 'stem')
VERSION = os.environ.get('EMBEDDING_VERSION', 'v1')
SLEEP_SECONDS = float(os.environ.get('REINDEX_POLL_SECONDS', '2.0'))


def process_job(conn, job_id, payload, model):
    cur = conn.cursor()
    try:
        problem_id = payload.get('problem_id')
        if not problem_id:
            raise ValueError('missing problem_id in payload')

        # fetch problem stem
        cur.execute('SELECT stem FROM problems WHERE id=%s', (problem_id,))
        r = cur.fetchone()
        if not r:
            raise ValueError(f'problem id={problem_id} not found')
        stem = r[0] or ''

        # fetch latest annotation payload (if any)
        cur.execute('SELECT payload FROM annotations WHERE segment_id=%s AND is_latest=TRUE LIMIT 1', (problem_id,))
        ar = cur.fetchone()
        annotation = ar[0] if ar and ar[0] is not None else {}

        # build input text
        parts = [stem.strip()]
        # annotation may be JSONB with keys like summary, tags, generation_hints
        try:
            summary = annotation.get('summary') if isinstance(annotation, dict) else None
        except Exception:
            summary = None
        if summary:
            parts.append(str(summary).strip())

        try:
            tags = annotation.get('tags') if isinstance(annotation, dict) else None
        except Exception:
            tags = None
        if tags:
            if isinstance(tags, list):
                parts.append(' '.join([str(t) for t in tags]))
            else:
                parts.append(str(tags))

        must_include = None
        try:
            gh = annotation.get('generation_hints') if isinstance(annotation, dict) else None
            if gh and isinstance(gh, dict):
                must_include = gh.get('must_include')
        except Exception:
            must_include = None
        if must_include:
            if isinstance(must_include, list):
                parts.append(' '.join([str(x) for x in must_include]))
            else:
                parts.append(str(must_include))

        input_text = '\n'.join([p for p in parts if p])

        # encode
        vecs = model.encode([input_text], convert_to_numpy=True)
        vec = vecs[0]
        v_literal = vector_to_sql_literal(vec.tolist())

        metadata = {
            'model': model.__class__.__name__ if model else 'model',
            'kind': KIND,
            'annotated': True,
        }

        # upsert into embeddings
        sql = """
        INSERT INTO embeddings (problem_id, kind, embedding_version, vector, metadata)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (problem_id, kind, embedding_version) DO UPDATE
          SET vector = EXCLUDED.vector, metadata = EXCLUDED.metadata, created_at = now()
        """
        cur.execute(sql, (int(problem_id), KIND, VERSION, v_literal, json.dumps(metadata, ensure_ascii=False)))
        conn.commit()
        return {'updated_problem_id': int(problem_id)}
    finally:
        try:
            cur.close()
        except Exception:
            pass

def main():
    print('Starting reindex worker, polling admin_jobs for', JOB_TYPE)
    conn = None
    model, _ = None, None
    try:
        model, _ = load_model()
    except Exception as e:
        print('Failed to load embedding model:', e)
        raise

    while True:
        try:
            if conn is None:
                conn = connect_db()

            cur = conn.cursor()
            # grab one queued job safely
            cur.execute("BEGIN")
            cur.execute(
                "SELECT id, payload FROM admin_jobs WHERE job_type=%s AND status=%s ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
                (JOB_TYPE, 'queued'),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback(); cur.close(); time.sleep(SLEEP_SECONDS); continue
            job_id = row[0]
            payload = row[1] or {}
            cur.execute("UPDATE admin_jobs SET status=%s WHERE id=%s", ('running', job_id))
            conn.commit()
            cur.close()

            print('Processing job', job_id, 'payload', payload)
            try:
                res = process_job(conn, job_id, payload, model)
                cur2 = conn.cursor()
                cur2.execute("UPDATE admin_jobs SET status=%s, result=%s, finished_at=now() WHERE id=%s", ('completed', json.dumps(res, ensure_ascii=False), job_id))
                conn.commit()
                cur2.close()
                print('Completed job', job_id)
            except Exception as e:
                tb = traceback.format_exc()
                print('Job failed', job_id, str(e))
                cur3 = conn.cursor()
                cur3.execute("UPDATE admin_jobs SET status=%s, message=%s, finished_at=now() WHERE id=%s", ('failed', tb, job_id))
                conn.commit()
                cur3.close()

        except Exception as e:
            print('Worker loop error:', str(e))
            try:
                if conn:
                    conn.rollback()
                    conn.close()
            except Exception:
                pass
            conn = None
            time.sleep(5.0)


if __name__ == '__main__':
    main()
