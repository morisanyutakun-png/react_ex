"""Evaluation harness for RAG retrieval.

Usage (local):
  python backend/scripts/eval_rag.py --mode self_supervised --topk 10
  python backend/scripts/eval_rag.py --evalfile path/to/eval.json

Eval JSON format (list of objects):
  [{"query": "...", "relevant_ids": [1,2,3]}, ...]

Self-supervised mode: sample N problems from DB, use their stem as query and the single correct id as relevant.
"""
import argparse
import json
import random
import time
import os
import sys
# make project root importable when running script directly
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
# repo root is parent of backend
REPO_ROOT = os.path.dirname(os.path.dirname(THIS_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.eval.metrics import precision_at_k, mrr, ndcg_at_k
from backend.db import connect_db
from backend import retriever


def load_eval_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_self_supervised(conn, n=50, seed=42):
    cur = conn.cursor()
    cur.execute("SELECT id, stem FROM problems ORDER BY id")
    rows = cur.fetchall()
    cur.close()
    if not rows:
        return []
    random.seed(seed)
    chosen = random.sample(rows, min(n, len(rows)))
    cases = []
    for r in chosen:
        pid, stem = r[0], r[1] or ''
        if not stem:
            continue
        cases.append({'query': stem, 'relevant_ids': [pid]})
    return cases


def run_eval(conn, cases, use_vector=False, model=None, topk=10):
    results = []
    for c in cases:
        q = c['query']
        relevant = c['relevant_ids']
        cand = retriever.retrieve_with_profile(conn, q, top_k=topk, use_vector=use_vector, model=model, pgvector_shards=1)
        retrieved = [r['id'] for r in cand]
        p = precision_at_k(retrieved, relevant, k=topk)
        rrank = mrr(retrieved, relevant)
        n = ndcg_at_k(retrieved, relevant, k=topk)
        results.append({'query': q[:120], 'precision': p, 'mrr': rrank, 'ndcg': n, 'retrieved': retrieved})
    # aggregate
    ag = {'precision': sum(r['precision'] for r in results) / len(results) if results else 0.0,
          'mrr': sum(r['mrr'] for r in results) / len(results) if results else 0.0,
          'ndcg': sum(r['ndcg'] for r in results) / len(results) if results else 0.0,
          'n': len(results)}
    return ag, results


def grid_search_weights(conn, cases, model=None, topk=10, alphas=[0.5,1.0,2.0], betas=[0.5,1.0,2.0], gammas=[0.5,1.0,2.0]):
    best = None
    best_params = None
    for a in alphas:
        for b in betas:
            for g in gammas:
                # run retrieval with these weights
                agg_all = {'precision':0.0,'mrr':0.0,'ndcg':0.0,'n':0}
                for c in cases:
                    q = c['query']
                    relevant = c['relevant_ids']
                    cand = retriever.retrieve_with_profile(conn, q, top_k=topk, use_vector=(model is not None), model=model, alpha_text=a, beta_difficulty=b, gamma_trickiness=g)
                    retrieved = [r['id'] for r in cand]
                    # use MRR as target metric
                    mm = mrr(retrieved, relevant)
                    agg_all['mrr'] += mm
                    agg_all['n'] += 1
                if agg_all['n'] > 0:
                    mean_mrr = agg_all['mrr'] / agg_all['n']
                else:
                    mean_mrr = 0.0
                if best is None or mean_mrr > best:
                    best = mean_mrr
                    best_params = (a,b,g)
    return {'best_mrr': best, 'best_params': best_params}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['self_supervised', 'file'], default='self_supervised')
    parser.add_argument('--evalfile', type=str)
    parser.add_argument('--n', type=int, default=50)
    parser.add_argument('--topk', type=int, default=10)
    parser.add_argument('--no-vector', dest='use_vector', action='store_false')
    parser.add_argument('--grid-search', dest='grid_search', action='store_true', help='Run grid search for alpha/beta/gamma (MRR)')
    parser.add_argument('--target-mrr', type=float, help='Fail with non-zero exit if final MRR is below this threshold')
    args = parser.parse_args()

    conn = connect_db(None)

    if args.mode == 'file':
        if not args.evalfile:
            print('Provide --evalfile when mode=file')
            return
        cases = load_eval_file(args.evalfile)
    else:
        cases = build_self_supervised(conn, n=args.n)

    # attempt to load a model if vector is requested
    model = None
    if args.use_vector:
        try:
            m, _ = retriever.load_model()
            model = m
        except Exception as e:
            print('Model load failed, falling back to TF-IDF:', e)
            model = None

    if args.topk <= 0:
        print('topk must be > 0')
        return

    # optional grid search
    if hasattr(args, 'grid_search') and args.grid_search:
        print('Running grid search for alpha/beta/gamma...')
        gs = grid_search_weights(conn, cases, model=model, topk=args.topk)
        print('Grid search best:', gs)
    else:
        t0 = time.time()
        agg, details = run_eval(conn, cases, use_vector=args.use_vector and (model is not None), model=model, topk=args.topk)
        dt = time.time() - t0

        print('Evaluation summary: n=%d elapsed=%.2fs' % (agg['n'], dt))
        print('Precision@%d: %.4f  MRR: %.4f  NDCG: %.4f' % (args.topk, agg['precision'], agg['mrr'], agg['ndcg']))
        # write details to file
        with open('eval_last_results.json', 'w', encoding='utf-8') as f:
            json.dump({'agg': agg, 'details': details}, f, ensure_ascii=False, indent=2)
        if args.target_mrr is not None:
            if agg['mrr'] < float(args.target_mrr):
                print(f"MRR {agg['mrr']:.4f} below target {args.target_mrr:.4f}; failing")
                raise SystemExit(2)
    conn.close()


if __name__ == '__main__':
    main()