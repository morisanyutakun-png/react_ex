"""Quick script to inspect attribute embeddings saved for a problem.
Usage:
  python backend/check_attribute_embeddings.py --id 123
"""
import os
import sys
import json
import argparse
import psycopg2


def get_conn():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('Set DATABASE_URL in environment')
        sys.exit(1)
    return psycopg2.connect(db_url)


def parse_vector_literal(v):
    # v may be returned as string like '[0.1,0.2]' or as list
    if v is None:
        return None
    if isinstance(v, (list, tuple)):
        return list(v)
    s = str(v).strip()
    if s.startswith('[') and s.endswith(']'):
        s = s[1:-1]
    if not s:
        return []
    return [float(x) for x in s.split(',')]


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--id', type=int, required=True)
    args = p.parse_args()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT kind, embedding_version, vector, metadata, created_at FROM embeddings WHERE problem_id = %s AND kind IN ('difficulty','trickiness') ORDER BY created_at DESC", (args.id,))
    rows = cur.fetchall()
    if not rows:
        print('No attribute embeddings found for problem', args.id)
        sys.exit(0)
    for kind, version, vec, meta, created in rows:
        vec_list = parse_vector_literal(vec)
        print('kind:', kind)
        print(' version:', version)
        print(' created:', created)
        print(' metadata:', json.dumps(meta or {}, ensure_ascii=False))
        print(' vector len:', len(vec_list))
        if vec_list:
            # compute norm
            import math
            norm = math.sqrt(sum(x*x for x in vec_list))
            print(' norm:', norm)
        print('---')
    cur.close()
    conn.close()
