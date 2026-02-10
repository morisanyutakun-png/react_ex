"""Generate labeled eval candidate file for manual annotation.

Produces backend/data/eval_candidates.json with entries:
  {"query":"...", "relevant_ids": [], "candidates": [id1,id2,...], "source_id": <id>}

Default behavior: sample N problems, run TF-IDF to get top_k candidates for each, and prefill candidates; relevant_ids empty for manual labeling. Optionally auto-fill relevant_ids with the true source id for quick baseline.
"""
import argparse
import json
import os
import sys

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
# repo root is parent of backend
REPO_ROOT = os.path.dirname(os.path.dirname(THIS_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.db import connect_db
from backend.retriever import _tfidf_search


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n', type=int, default=50)
    parser.add_argument('--topk', type=int, default=5)
    parser.add_argument('--auto-fill', dest='autofill', action='store_true', help='auto-fill relevant_ids with source id for quick baseline')
    args = parser.parse_args()

    conn = connect_db(None)
    cur = conn.cursor()
    cur.execute('SELECT id, stem FROM problems ORDER BY id')
    rows = cur.fetchall()
    cur.close()
    if not rows:
        print('No problems in DB')
        return

    import random
    random.seed(42)
    chosen = random.sample(rows, min(args.n, len(rows)))

    out = []
    for r in chosen:
        pid, stem = r[0], r[1] or ''
        if not stem:
            continue
        # get TF-IDF candidates
        cand = _tfidf_search(conn, stem, top_k=args.topk)
        cand_ids = [c[0] for c in cand]
        entry = {
            'query': stem,
            'source_id': int(pid),
            'candidates': [int(x) for x in cand_ids],
            'relevant_ids': [int(pid)] if args.autofill else [],
        }
        out.append(entry)

    os.makedirs(os.path.join(REPO_ROOT, 'backend', 'data'), exist_ok=True)
    path = os.path.join(REPO_ROOT, 'backend', 'data', 'eval_candidates.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print('Wrote', path, 'with', len(out), 'cases')
    conn.close()

if __name__ == '__main__':
    main()
