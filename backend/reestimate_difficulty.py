"""Recompute difficulty/trickiness for existing problems and update DB.
Usage:
  python backend/reestimate_difficulty.py --limit 100 --dry-run
"""
import os
import sys
import argparse
import psycopg2
import json
from workers.ingest.estimate_difficulty import estimate_difficulty_verbose

p = argparse.ArgumentParser()
p.add_argument('--limit', type=int, default=0, help='Process at most N problems (0 = all)')
p.add_argument('--dry-run', action='store_true')
args = p.parse_args()

DB = os.environ.get('DATABASE_URL')
if not DB:
    print('Set DATABASE_URL in env')
    raise SystemExit(1)

conn = psycopg2.connect(DB)
cur = conn.cursor()
q = 'SELECT id, stem FROM problems ORDER BY id'
if args.limit:
    q += f' LIMIT {args.limit}'
cur.execute(q)
rows = cur.fetchall()
print('Recomputing for', len(rows), 'problems')
for pid, text in rows:
    d, level, trick, details = estimate_difficulty_verbose(text or '')
    print(pid, '-> diff=%.3f level=%d trick=%.3f' % (d, level, trick))
    if not args.dry_run:
        cur2 = conn.cursor()
        # update difficulty fields and write details into metadata.difficulty_details
        details_json = json.dumps(details, ensure_ascii=False)
        cur2.execute(
            """
            UPDATE problems
            SET difficulty = %s, difficulty_level = %s, trickiness = %s,
                metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{difficulty_details}', %s::jsonb)
            WHERE id = %s
            """,
            (d, level, trick, details_json, pid),
        )
        conn.commit()
        cur2.close()

cur.close()
conn.close()
print('Done')
