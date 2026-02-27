"""Retriever with difficulty/trickiness profile for RAG.

Provides a simple profile that combines text similarity (TF-IDF or pgvector) and
attribute proximity (difficulty/trickiness) into a final ranking score.

Functions:
 - retrieve_with_profile(conn, query, target_difficulty=None, target_trickiness=None, ...)
 - _tfidf_search(conn, query, top_k)
 - _pgvector_search(conn, model, query_vec_lit, top_k)

Notes:
 - If pgvector is available and a model is passed, the module will try a vector search
    on embeddings(kind='stem'). Otherwise it falls back to TF-IDF (text) search
    using the problems.stem column.
 - Final score = alpha * text_sim - beta * |difficulty - target_difficulty| - gamma * |trickiness - target_trickiness|
   Tuning of alpha/beta/gamma is expected.
"""
from typing import List, Dict, Optional, Tuple
import math
import os
import logging
import re
from concurrent.futures import ThreadPoolExecutor

try:
    import psycopg2
except Exception:
    psycopg2 = None

try:
    import numpy as np
except Exception:
    np = None

# Do not import backend.embeddings at module import time (it can require heavy deps like psycopg2)
# Import load_model / vector_to_sql_literal lazily where needed.


try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except Exception:
    TfidfVectorizer = None
    cosine_similarity = None

logger = logging.getLogger(__name__)


# TF-IDF index cache
_tfidf_cache = {
    'fingerprint': None,  # (count, sum_ids, max_id) tuple for robust invalidation
    'ids': None,
    'vectorizer': None,
    'mat': None,
}


def _build_or_get_tfidf_index(conn, force_refresh: bool = False):
    """Build or return cached TF-IDF index.

    Cache invalidation uses (count, sum(id), max(id)) to detect inserts, deletes,
    and ID reassignments reliably. For updates to stem content that don't change IDs,
    use force_refresh=True.

    Returns (ids, vectorizer, mat)
    """
    cur = conn.cursor()
    cur.execute("SELECT count(*), coalesce(sum(id), 0), coalesce(max(id), 0) FROM problems")
    stats = cur.fetchone()
    # fetch stem and stem_latex (if present) and optionally normalized_text
    cur.execute("SELECT id, stem, stem_latex FROM problems ORDER BY id")
    rows = cur.fetchall()
    cur.close()

    fingerprint = (int(stats[0]), int(stats[1]), int(stats[2]))
    if (not force_refresh) and _tfidf_cache['fingerprint'] == fingerprint and _tfidf_cache['ids'] is not None:
        return _tfidf_cache['ids'], _tfidf_cache['vectorizer'], _tfidf_cache['mat']

    ids = [r[0] for r in rows]
    # concatenate stem and stem_latex to improve math matchability
    def _concat_text(r):
        s = r[1] or ''
        s2 = r[2] or ''
        # simple LaTeX normalization: remove braces and convert backslash commands to words
        comb = (s + ' ' + s2).strip()
        return _normalize_latex_text(comb)

    texts = [_concat_text(r) for r in rows]
    if not ids:
        # empty fallback
        if TfidfVectorizer is None:
            raise RuntimeError('scikit-learn not installed: install with `pip install scikit-learn` to use TF-IDF retriever')
        vec = TfidfVectorizer()
        mat = vec.fit_transform(['']).toarray()
        _tfidf_cache.update({'fingerprint': fingerprint, 'ids': ids, 'vectorizer': vec, 'mat': mat})
        return ids, vec, mat

    if TfidfVectorizer is None:
        raise RuntimeError('scikit-learn not installed: install with `pip install scikit-learn` to use TF-IDF retriever')
    # use char n-grams for CJK-heavy text to avoid relying on whitespace tokenization
    use_char_ngrams = any(re.search(r'[\u4e00-\u9fff]', t) for t in texts)
    if use_char_ngrams:
        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2,4))
    else:
        vectorizer = TfidfVectorizer()
    mat = vectorizer.fit_transform(texts).toarray()
    _tfidf_cache.update({'fingerprint': fingerprint, 'ids': ids, 'vectorizer': vectorizer, 'mat': mat})
    return ids, vectorizer, mat


def _tfidf_search(conn, query: str, top_k: int = 50, force_refresh: bool = False) -> List[Tuple[int, float]]:
    """TF-IDF search using a cached index to avoid rebuilding on every call."""
    ids, vectorizer, mat = _build_or_get_tfidf_index(conn, force_refresh=force_refresh)
    if not ids:
        return []
    if cosine_similarity is None:
        raise RuntimeError('scikit-learn not installed: install with `pip install scikit-learn` to use TF-IDF retriever')
    qv = vectorizer.transform([_normalize_latex_text(query)]).toarray()
    sims = cosine_similarity(qv, mat)[0]
    idxs = np.argsort(-sims)[:top_k]
    results = [(int(ids[i]), float(sims[i])) for i in idxs if sims[i] > 0]
    return results


def _pgvector_search_single(
    conn,
    query_vec_lit: str,
    top_k: int = 100,
    shard_clause: str = None,
    subject_filter: Optional[str] = None,
    field_filter: Optional[int] = None,
    topic_filter: Optional[str] = None,
) -> List[Tuple[int, float]]:
    """pgvector search with optional subject/field pre-filtering via JOIN.

    When subject_filter or field_filter is provided, the query JOINs with the
    problems table so that only embeddings for matching problems are considered.
    This prevents cross-topic pollution (e.g. calculus results for quadratic queries).
    """
    cur = conn.cursor()
    params: list = []

    # Build WHERE conditions
    where_parts = ["e.kind = 'stem'"]
    need_join = False

    if subject_filter:
        # Use LIKE for flexible matching: "数学" matches "数学", "数学I", "数学II" etc.
        where_parts.append("(p.subject = %s OR p.subject LIKE %s)")
        params.append(subject_filter)
        params.append(subject_filter + '%')
        need_join = True
    if field_filter is not None:
        where_parts.append("p.field_id = %s")
        params.append(field_filter)
        need_join = True
    if topic_filter:
        where_parts.append("p.topic = %s")
        params.append(topic_filter)
        need_join = True
    if shard_clause:
        where_parts.append(shard_clause)

    where_sql = " AND ".join(where_parts)

    if need_join:
        sql = (
            "SELECT e.problem_id, (e.vector <-> %s) AS dist "
            "FROM embeddings e "
            "JOIN problems p ON p.id = e.problem_id "
            f"WHERE {where_sql} "
            "ORDER BY e.vector <-> %s LIMIT %s"
        )
    else:
        sql = (
            "SELECT e.problem_id, (e.vector <-> %s) AS dist "
            f"FROM embeddings e WHERE {where_sql} "
            "ORDER BY e.vector <-> %s LIMIT %s"
        )

    params = [query_vec_lit] + params + [query_vec_lit, top_k]
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    results = []
    for pid, dist in rows:
        try:
            dist = float(dist)
            sim = 1.0 / (1.0 + dist)
        except Exception:
            sim = 0.0
        results.append((int(pid), float(sim)))
    return results


def _pgvector_search(
    conn,
    query_vec_lit: str,
    top_k: int = 100,
    topic_filter: Optional[str] = None,
    shards: int = 1,
    subject_filter: Optional[str] = None,
    field_filter: Optional[int] = None,
) -> List[Tuple[int, float]]:
    """Search with optional partitioned parallel execution.

    If shards == 1, runs a single SQL (fast when the index is used). If shards > 1,
    the table is partitioned by `problem_id % shards` and queries are issued in parallel
    and results are merged (best-by-distance per problem_id). This helps on very
    large tables where a single ORDER BY may be slower or when DB can serve parallel queries.
    """
    if shards <= 1:
        return _pgvector_search_single(
            conn, query_vec_lit, top_k=top_k, shard_clause=None,
            subject_filter=subject_filter, field_filter=field_filter,
            topic_filter=topic_filter,
        )

    # prepare per-shard workload
    per_shard_limit = int(max(10, (top_k // shards) + 10))
    dsn = getattr(conn, 'dsn', None)

    if dsn is None:
        # Cannot open independent connections per worker; sharing one connection
        # across threads is not thread-safe with psycopg2. Fall back to single query.
        logger.warning(
            '_pgvector_search: shards=%d requested but conn.dsn is not available; '
            'falling back to shards=1 to avoid thread-unsafe connection sharing.',
            shards,
        )
        return _pgvector_search_single(conn, query_vec_lit, top_k=top_k, shard_clause=None,
                                         topic_filter=topic_filter)

    def worker(shard_idx: int):
        # open a new connection per worker to allow parallel queries
        subconn = psycopg2.connect(dsn)
        clause = f"(e.problem_id % {shards}) = {shard_idx}"
        try:
            return _pgvector_search_single(
                subconn, query_vec_lit, top_k=per_shard_limit, shard_clause=clause,
                subject_filter=subject_filter, field_filter=field_filter,
                topic_filter=topic_filter,
            )
        finally:
            subconn.close()

    results = []
    with ThreadPoolExecutor(max_workers=min(shards, 8)) as ex:
        futures = [ex.submit(worker, i) for i in range(shards)]
        for f in futures:
            try:
                res = f.result()
                results.extend(res)
            except Exception as e:
                # log and continue
                logger.warning('pgvector shard failed: %s', e)

    # merge results: keep best (smallest dist -> largest sim) per problem id
    best = {}
    for pid, sim in results:
        if pid not in best or sim > best[pid]:
            best[pid] = sim
    merged = sorted([(pid, sim) for pid, sim in best.items()], key=lambda x: -x[1])[:top_k]
    return merged


def _zscore(arr):
    """Standardize an array. Uses z-score when variance is sufficient,
    falls back to min-max normalization for small or constant sets."""
    import numpy as _np
    if not arr:
        return []
    a = _np.array(arr, dtype=float)
    if len(a) < 3:
        # Too few samples for meaningful z-score; use min-max [0,1]
        mn, mx = a.min(), a.max()
        if mx - mn < 1e-12:
            return [0.0 for _ in a]
        return ((a - mn) / (mx - mn)).tolist()
    mean = a.mean()
    std = a.std()
    if std < 1e-12 or _np.isnan(std):
        return [0.0 for _ in a]
    return ((a - mean) / std).tolist()


def retrieve_with_profile(
    conn,
    query: str,
    top_k: int = 10,
    target_difficulty: Optional[float] = None,
    target_trickiness: Optional[float] = None,
    # defaults tuned via grid-search on eval set (see backend/scripts/eval_rag.py)
    alpha_text: float = 0.5,
    beta_difficulty: float = 0.5,
    gamma_trickiness: float = 0.5,
    overlap_boost: float = 0.5,
    overlap_threshold: float = 0.4,
    use_vector: bool = True,
    model = None,
    tfidf_force_refresh: bool = False,
    pgvector_shards: int = 1,
    field_filter: Optional[int] = None,
    subject_filter: Optional[str] = None,
    topic_filter: Optional[str] = None,
) -> List[Dict]:
    """Retrieve top candidates using DB-first filtering + optional vector/TF-IDF ranking.

    Strategy (guaranteed to return results if DB has matching rows):
      1. Query problems table directly with cascading filters:
         subject+field → subject+topic → subject → global
      2. If vector model available, compute similarity scores for ranking boost
      3. Rank by combined score (text similarity + difficulty match + bonuses)
      4. Return top_k results

    This ensures that even 1 matching row in DB will be returned.
    """
    is_sqlite = getattr(conn, '_is_sqlite', False)

    # ── Step 1: DB-first query with cascading filters ──
    # Always query problems table directly. This guarantees results if data exists.
    def _subject_where(subj):
        """Build flexible subject match clause."""
        if is_sqlite:
            return "(subject = %s OR subject LIKE %s)", [subj, subj + '%']
        else:
            return "(subject = %s OR subject LIKE %s)", [subj, subj + '%']

    def _query_problems(where_clause, params, limit=200):
        """Execute a query on problems and return rows."""
        cur = conn.cursor()
        order_col = 'id' if is_sqlite else 'created_at'
        sql = (
            f"SELECT id, stem, difficulty, trickiness, subject, "
            f"{'topic' if is_sqlite else 'field_id, topic'} "
            f"FROM problems WHERE {where_clause} "
            f"AND stem IS NOT NULL AND stem != '' "
            f"ORDER BY {order_col} DESC LIMIT %s"
        )
        cur.execute(sql, tuple(params + [limit]))
        rows = cur.fetchall()
        cur.close()
        return rows

    # Build cascading filter attempts
    # Note: SQLite has no field_id column, so skip field_id-based filter on SQLite
    attempts = []
    if subject_filter and field_filter is not None and not is_sqlite:
        sw, sp = _subject_where(subject_filter)
        attempts.append((f"{sw} AND field_id = %s", sp + [field_filter], 'subject+field'))
    if subject_filter and topic_filter:
        sw, sp = _subject_where(subject_filter)
        attempts.append((f"{sw} AND topic = %s", sp + [topic_filter], 'subject+topic'))
    if subject_filter:
        sw, sp = _subject_where(subject_filter)
        attempts.append((sw, sp, 'subject-only'))
    attempts.append(("1=1", [], 'global'))

    db_rows = []
    used_tier = 'global'
    for where_clause, params, tier_label in attempts:
        rows = _query_problems(where_clause, params, limit=200)
        logger.info('RAG DB tier=%s: %d rows found', tier_label, len(rows))
        if rows:
            db_rows = rows
            used_tier = tier_label
            break

    if not db_rows:
        logger.info('RAG: no problems found in DB at all')
        return []

    # Parse DB rows into prob_map
    prob_map = {}
    for r in db_rows:
        if is_sqlite:
            pid, stem, diff, trick, subj, topic = r[0], r[1], r[2], r[3], r[4], r[5]
            fid = None
        else:
            pid, stem, diff, trick, subj, fid, topic = r[0], r[1], r[2], r[3], r[4], r[5], r[6]
        prob_map[pid] = {
            'id': pid,
            'text': (stem or '').strip(),
            'difficulty': diff,
            'trickiness': trick,
            'subject': subj,
            'field_id': fid,
            'topic': topic,
        }

    pids = list(prob_map.keys())
    logger.info('RAG: %d candidate problems from DB (tier=%s)', len(pids), used_tier)

    # ── Step 2: Compute text similarity scores ──
    # Try vector similarity first, then TF-IDF, then fall back to no text score
    text_scores = {pid: 0.0 for pid in pids}

    # Try pgvector
    vector_ok = False
    if use_vector and model is not None and not is_sqlite:
        try:
            from backend.embeddings import vector_to_sql_literal as _v2s
        except Exception:
            try:
                from embeddings import vector_to_sql_literal as _v2s
            except Exception:
                _v2s = None

        if _v2s is not None:
            try:
                qvec = model.encode([query], convert_to_numpy=True)[0]
                qvec_lit = _v2s(qvec.tolist())
                cur = conn.cursor()
                # Get vector distances for our candidate problem IDs
                cur.execute(
                    "SELECT e.problem_id, (e.vector <-> %s) AS dist "
                    "FROM embeddings e "
                    "WHERE e.kind = 'stem' AND e.problem_id = ANY(%s) "
                    "ORDER BY dist",
                    (qvec_lit, pids)
                )
                for pid, dist in cur.fetchall():
                    try:
                        text_scores[pid] = 1.0 / (1.0 + float(dist))
                    except Exception:
                        pass
                cur.close()
                vector_ok = True
                logger.info('RAG: pgvector scores computed for %d problems', sum(1 for v in text_scores.values() if v > 0))
            except Exception as e:
                logger.warning('RAG: pgvector scoring failed: %s', e)

    # Try TF-IDF if vector didn't work
    if not vector_ok:
        try:
            texts_for_tfidf = [prob_map[pid]['text'] for pid in pids]
            if texts_for_tfidf and TfidfVectorizer is not None:
                normalized = [_normalize_latex_text(t) for t in texts_for_tfidf]
                use_char = any(re.search(r'[\u4e00-\u9fff]', t) for t in normalized)
                if use_char:
                    vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
                else:
                    vec = TfidfVectorizer()
                mat = vec.fit_transform(normalized)
                qv = vec.transform([_normalize_latex_text(query)])
                sims = cosine_similarity(qv, mat)[0]
                for i, pid in enumerate(pids):
                    text_scores[pid] = float(sims[i])
                logger.info('RAG: TF-IDF scores computed for %d problems', len(pids))
        except Exception as e:
            logger.warning('RAG: TF-IDF scoring failed: %s', e)

    # ── Step 3: Compute final ranking scores ──
    # Combine text similarity, difficulty match, trickiness match, and bonuses
    score_list = list(text_scores.values())
    diff_list = []
    trick_list = []
    for pid in pids:
        p = prob_map[pid]
        if target_difficulty is not None and p.get('difficulty') is not None:
            try:
                diff_list.append(abs(float(p['difficulty']) - float(target_difficulty)))
            except Exception:
                diff_list.append(0.5)
        else:
            diff_list.append(0.0)
        if target_trickiness is not None and p.get('trickiness') is not None:
            try:
                trick_list.append(abs(float(p['trickiness']) - float(target_trickiness)))
            except Exception:
                trick_list.append(0.5)
        else:
            trick_list.append(0.0)

    z_text = _zscore(score_list)
    z_diff = _zscore(diff_list)
    z_trick = _zscore(trick_list)

    SUBJECT_MATCH_BONUS = 0.3
    FIELD_MATCH_BONUS = 0.5
    TOPIC_MATCH_BONUS = 0.6

    def _subject_matches(db_subj, filter_subj):
        if not db_subj or not filter_subj:
            return False
        return db_subj == filter_subj or db_subj.startswith(filter_subj) or filter_subj in db_subj

    ranked = []
    for idx, pid in enumerate(pids):
        p = prob_map[pid]
        zt = z_text[idx] if idx < len(z_text) else 0.0
        zd = z_diff[idx] if idx < len(z_diff) else 0.0
        ztk = z_trick[idx] if idx < len(z_trick) else 0.0

        final_score = alpha_text * float(zt) - beta_difficulty * float(zd) - gamma_trickiness * float(ztk)

        # Bonuses for matching filters
        if subject_filter and _subject_matches(p.get('subject', ''), subject_filter):
            final_score += SUBJECT_MATCH_BONUS
        if field_filter is not None and p.get('field_id') == field_filter:
            final_score += FIELD_MATCH_BONUS
        if topic_filter and p.get('topic') == topic_filter:
            final_score += TOPIC_MATCH_BONUS

        # Token overlap boost
        try:
            qnorm = _normalize_latex_text(query)
            txt = _normalize_latex_text(p.get('text', ''))
            q_tokens = set(qnorm.lower().split())
            txt_tokens = set(txt.lower().split())
            if q_tokens:
                overlap = len(q_tokens & txt_tokens) / float(len(q_tokens))
                if overlap > overlap_threshold or qnorm.lower() in txt.lower():
                    final_score += overlap_boost * overlap
        except Exception:
            pass

        ranked.append({
            'id': pid,
            'text_score': text_scores.get(pid, 0.0),
            'difficulty': p.get('difficulty'),
            'trickiness': p.get('trickiness'),
            'final_score': float(final_score),
            'text': (p.get('text', ''))[:500],
            'subject': p.get('subject'),
            'field_id': p.get('field_id'),
            'topic': p.get('topic'),
            'search_tier': used_tier,
        })

    # Sort by final_score desc and return top_k
    ranked_sorted = sorted(ranked, key=lambda x: -x['final_score'])[:top_k]
    logger.info('RAG: returning %d results (top_k=%d, tier=%s)', len(ranked_sorted), top_k, used_tier)
    return ranked_sorted


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Run RAG retrieval with difficulty/trickiness profile')
    parser.add_argument('--query', type=str, required=True)
    parser.add_argument('--topk', type=int, default=10)
    parser.add_argument('--difficulty', type=float)
    parser.add_argument('--trickiness', type=float)
    parser.add_argument('--no-vector', dest='use_vector', action='store_false')
    parser.add_argument('--model', type=str, help='sentence-transformer model name (optional)')
    parser.add_argument('--pg-shards', type=int, default=1, help='number of shards for parallel pgvector queries')
    parser.add_argument('--tfidf-refresh', action='store_true', help='force tfidf index rebuild')
    args = parser.parse_args()

    DB = os.environ.get('DATABASE_URL')
    if not DB:
        print('Set DATABASE_URL in environment')
        raise SystemExit(1)
    if psycopg2 is None:
        print('psycopg2 is not installed; cannot connect to Postgres. Install psycopg2 or run with --no-vector for TF-IDF mode.')
        raise SystemExit(1)
    conn = psycopg2.connect(DB)
    model = None
    if args.use_vector:
        try:
            if args.model:
                os.environ['SENTENCE_TRANSFORMER_MODEL'] = args.model
            # import load_model lazily to avoid heavy deps at import time
            try:
                from backend.embeddings import load_model as _load_model
            except Exception:
                try:
                    from embeddings import load_model as _load_model  # type: ignore
                except Exception:
                    _load_model = None
            if _load_model is None:
                logger.warning('Could not import load_model from embeddings; proceeding without vector search')
                model = None
            else:
                model = _load_model()
        except Exception as e:
            logger.warning('Could not load model: %s; proceeding without vector search', e)
            model = None

    res = retrieve_with_profile(
        conn,
        args.query,
        top_k=args.topk,
        target_difficulty=args.difficulty,
        target_trickiness=args.trickiness,
        use_vector=bool(args.use_vector),
        model=model,
        tfidf_force_refresh=args.tfidf_refresh,
        pgvector_shards=max(1, args.pg_shards),
    )
    for r in res:
        print(f"id={r['id']} final={r['final_score']:.4f} text_score={r['text_score']:.4f} diff={r['difficulty']} trick={r['trickiness']}")
        print(' text snippet:', r['text'][:200].replace('\n', ' '))
        print('---')
    conn.close()


def _normalize_latex_text(s: str) -> str:
    """LaTeX / math normalization to improve token matching.

    - Preserve math-significant tokens (frac, int, sum, sqrt, etc.) as keywords
    - Remove curly braces and dollar signs
    - Replace backslash commands like \\frac -> frac
    - Normalize common math operators and Greek letters
    - Collapse multiple spaces
    """
    if not s:
        return ''
    import re
    t = s
    # normalize display math delimiters
    t = re.sub(r'\\\[', ' ', t)
    t = re.sub(r'\\\]', ' ', t)
    t = t.replace('{', ' ').replace('}', ' ')
    t = t.replace('$$', ' ')
    t = t.replace('$', ' ')
    # convert \command to command  (keeps math keywords like frac, int, sum, sqrt, lim, etc.)
    t = re.sub(r'\\([A-Za-z]+)', r' \1 ', t)
    # normalize common subscript/superscript noise
    t = t.replace('^', ' ').replace('_', ' ')
    # keep digits and operators meaningful
    t = re.sub(r'[\\&~]', ' ', t)
    # remove multiple spaces
    t = re.sub(r'\s+', ' ', t)
    return t.strip()
