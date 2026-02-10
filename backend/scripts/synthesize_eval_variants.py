"""Synthesize evaluation cases by replacing <NUM> tokens with small candidate values.

Reads backend/data/eval_candidates.json and expands cases where query contains '<NUM>' by substituting values
from a small candidate set (e.g. 1,2,3,4,5,10). For each synthetic query, fetch TF-IDF candidates and optionally
set relevant_ids to the original source_id (auto-fill) or leave empty for manual labeling.

Usage:
  python backend/scripts/synthesize_eval_variants.py --values 1 2 3 --topk 5 --autofill
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

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'eval_candidates.json')
DATA_PATH = os.path.abspath(DATA_PATH)


def main(values, topk=5, autofill=False, out=None):
    if not os.path.exists(DATA_PATH):
        print('no eval_candidates.json found at', DATA_PATH); return
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        cases = json.load(f)

    conn = connect_db(None)
    new_cases = []
    for c in cases:
        q = c.get('query','')
        if '<NUM>' not in q:
            new_cases.append(c)
            continue
        # generate variants
        for v in values:
            q2 = q.replace('<NUM>', str(v))
            # find TF-IDF candidates
            try:
                cand = _tfidf_search(conn, q2, top_k=topk)
                cand_ids = [int(x[0]) for x in cand]
            except Exception as e:
                cand_ids = []
            entry = {'query': q2, 'source_id': c.get('source_id'), 'candidates': cand_ids, 'relevant_ids': [int(c.get('source_id'))] if autofill and c.get('source_id') else [], 'synthetic': True}
            new_cases.append(entry)
    conn.close()
    # write to new file
    out_path = out or DATA_PATH
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(new_cases, f, ensure_ascii=False, indent=2)
    print('Wrote', out_path, 'cases:', len(new_cases))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--values', type=int, nargs='+', default=[1,2,3,4,5,10])
    parser.add_argument('--topk', type=int, default=5)
    parser.add_argument('--autofill', action='store_true')
    parser.add_argument('--out', type=str)
    args = parser.parse_args()
    main(args.values, topk=args.topk, autofill=args.autofill, out=args.out)
