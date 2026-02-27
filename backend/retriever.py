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
        where_parts.append("p.subject = %s")
        params.append(subject_filter)
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
    """Retrieve top candidates using a profile that weights text and attribute proximity.

    Uses a cascading filter strategy:
      1. subject + field/topic → if sufficient results, use these
      2. subject only          → if sufficient results, use these
      3. global (no filter)    → fallback
    This prevents cross-topic pollution (e.g. calculus for quadratic function queries).

    Returns list of dicts: {id, text_score, difficulty, trickiness, final_score, subject_match, field_match}
    """
    # Minimum number of candidates to consider a search tier "sufficient".
    # If fewer candidates are found, cascade to the next (broader) tier.
    MIN_CASCADE_CANDIDATES = max(top_k, 5)

    # Step 1: get candidate list via vector (if requested and model provided) or TF-IDF fallback
    candidates: List[Tuple[int, float]] = []

    # ── Cascading search tiers ──
    # Build a list of (subject_f, field_f, topic_f, label) tiers to try in order.
    # Priority: subject+field+topic → subject+topic → subject+field → subject-only → global
    has_field = field_filter is not None
    has_topic = bool(topic_filter)
    tiers = []
    if subject_filter and has_field and has_topic:
        tiers.append((subject_filter, field_filter, topic_filter, 'subject+field+topic'))
    if subject_filter and has_topic:
        tiers.append((subject_filter, None, topic_filter, 'subject+topic'))
    if subject_filter and has_field:
        tiers.append((subject_filter, field_filter, None, 'subject+field'))
    if subject_filter:
        tiers.append((subject_filter, None, None, 'subject-only'))
    tiers.append((None, None, None, 'global'))

    # Track which tier was actually used (for scoring bonus)
    used_tier = 'global'

    if use_vector and model is not None:
        try:
            # If running on SQLite, skip pgvector and fall back to TF-IDF
            if getattr(conn, '_is_sqlite', False):
                logger.info('SQLite detected: skipping pgvector search, using TF-IDF')
                candidates = _tfidf_search(conn, query, top_k=top_k * 3, force_refresh=tfidf_force_refresh)
                used_tier = 'global'  # TF-IDF has no built-in subject/field filter
            else:
                qvec = model.encode([query], convert_to_numpy=True)[0]
                # import vector_to_sql_literal lazily
                try:
                    from backend.embeddings import vector_to_sql_literal as _v2s
                except Exception:
                    try:
                        from embeddings import vector_to_sql_literal as _v2s  # type: ignore
                    except Exception:
                        _v2s = None
                if _v2s is None:
                    raise RuntimeError('vector_to_sql_literal not available (missing embeddings module)')
                qvec_lit = _v2s(qvec.tolist())

                # Try each tier until we get enough candidates
                for tier_subject, tier_field, tier_topic, tier_label in tiers:
                    tier_candidates = _pgvector_search(
                        conn, qvec_lit, top_k=top_k * 3, shards=pgvector_shards,
                        subject_filter=tier_subject, field_filter=tier_field,
                        topic_filter=tier_topic,
                    )
                    logger.info(
                        'pgvector cascade tier=%s retrieved %d candidates',
                        tier_label, len(tier_candidates),
                    )
                    if len(tier_candidates) >= MIN_CASCADE_CANDIDATES:
                        candidates = tier_candidates
                        used_tier = tier_label
                        break
                    # If this tier has SOME results but not enough, keep them as
                    # a fallback and try the next broader tier
                    if tier_candidates and not candidates:
                        candidates = tier_candidates
                        used_tier = tier_label

                # If we iterated all tiers without breaking, candidates holds
                # the best we found (or the global search result from the last tier)
                if not candidates:
                    # All tiers returned nothing – do a final global search
                    candidates = _pgvector_search(conn, qvec_lit, top_k=top_k * 3, shards=pgvector_shards)
                    used_tier = 'global'

                logger.info('pgvector final: tier=%s, %d candidates', used_tier, len(candidates))
        except Exception as e:
            logger.warning('pgvector search failed: %s; falling back to tfidf', e)
            candidates = _tfidf_search(conn, query, top_k=top_k * 3, force_refresh=tfidf_force_refresh)
            used_tier = 'global'
    else:
        candidates = _tfidf_search(conn, query, top_k=top_k * 3, force_refresh=tfidf_force_refresh)
        used_tier = 'global'

    if not candidates:
        return []

    cids = [c[0] for c in candidates]
    # fetch attributes — also retrieve subject, field_id & topic for match bonus scoring
    cur = conn.cursor()

    # Note: We no longer do post-fetch filtering here because the cascading
    # search already filters at the SQL level (JOIN + WHERE). We still apply
    # a lightweight post-filter for TF-IDF fallback (which doesn't support
    # SQL-level subject/field/topic filtering).
    if getattr(conn, '_is_sqlite', False):
        placeholders = ','.join(['%s'] * len(cids))
        q = f"SELECT id, difficulty, trickiness, stem, subject, topic FROM problems WHERE id IN ({placeholders})"
        cur.execute(q, cids)
    else:
        q = "SELECT id, difficulty, trickiness, stem, subject, field_id, topic FROM problems WHERE id = ANY(%s)"
        cur.execute(q, (cids,))
    rows = cur.fetchall()

    if getattr(conn, '_is_sqlite', False):
        prob_map = {
            r[0]: {'difficulty': r[1], 'trickiness': r[2], 'text': r[3], 'subject': r[4], 'field_id': None, 'topic': r[5]}
            for r in rows
        }
    else:
        prob_map = {
            r[0]: {'difficulty': r[1], 'trickiness': r[2], 'text': r[3], 'subject': r[4], 'field_id': r[5], 'topic': r[6]}
            for r in rows
        }

    # For TF-IDF fallback, apply post-filter if subject_filter / topic_filter is given
    if used_tier == 'global' and subject_filter:
        filtered = [(pid, score) for pid, score in candidates
                    if pid in prob_map and prob_map[pid].get('subject') == subject_filter]
        if len(filtered) >= top_k:
            candidates = filtered
    if used_tier in ('global', 'subject-only') and topic_filter:
        filtered = [(pid, score) for pid, score in candidates
                    if pid in prob_map and prob_map[pid].get('topic') == topic_filter]
        if len(filtered) >= top_k:
            candidates = filtered

    # Filter candidates to only those found in prob_map
    candidates = [(pid, score) for pid, score in candidates if pid in prob_map]
    if not candidates:
        return []

    # Build a map of text_score
    score_map = {pid: score for pid, score in candidates}

    # prepare arrays for standardization
    pids = [pid for pid, _ in candidates]
    text_scores = [score_map.get(pid, 0.0) for pid in pids]
    diffs = []
    tricks = []
    # compute raw diffs/tricks first
    for pid in pids:
        p = prob_map.get(pid, {})
        if target_difficulty is not None:
            if p.get('difficulty') is not None:
                diffs.append(abs(float(p['difficulty']) - float(target_difficulty)))
            else:
                diffs.append(0.5)
        else:
            diffs.append(0.0)
        if target_trickiness is not None:
            if p.get('trickiness') is not None:
                tricks.append(abs(float(p['trickiness']) - float(target_trickiness)))
            else:
                tricks.append(0.5)
        else:
            tricks.append(0.0)

    # standardize (z-score) arrays so scales are comparable
    z_text = _zscore(text_scores)
    z_diff = _zscore(diffs)
    z_trick = _zscore(tricks)

    ranked = []
    # Subject / field / topic match bonus weights
    SUBJECT_MATCH_BONUS = 0.3
    FIELD_MATCH_BONUS = 0.5
    TOPIC_MATCH_BONUS = 0.6  # topic text match is the strongest signal

    for idx, (pid, text_score) in enumerate(candidates):
        p = prob_map.get(pid, {})
        zt = z_text[idx]
        zd = z_diff[idx]
        zt2 = z_trick[idx]
        final_score = alpha_text * float(zt) - beta_difficulty * float(zd) - gamma_trickiness * float(zt2)

        # ── subject / field / topic match bonus ──
        # Reward candidates that match the requested subject/field/topic to ensure
        # topically relevant results rank higher even after cascade relaxation.
        if subject_filter and p.get('subject') == subject_filter:
            final_score += SUBJECT_MATCH_BONUS
        if field_filter is not None and p.get('field_id') == field_filter:
            final_score += FIELD_MATCH_BONUS
        if topic_filter and p.get('topic') == topic_filter:
            final_score += TOPIC_MATCH_BONUS

        # small exact-match / token-overlap boost to favor strong matches (helps math queries)
        try:
            qnorm = _normalize_latex_text(query)
            txt = _normalize_latex_text((p.get('text') or ''))
            q_tokens = set(qnorm.lower().split())
            txt_tokens = set(txt.lower().split())
            if not q_tokens:
                overlap = 0.0
            else:
                overlap = len(q_tokens & txt_tokens) / float(len(q_tokens))
            # if high overlap or query is substring, boost final score
            if overlap > overlap_threshold or qnorm.lower() in txt.lower():
                final_score += overlap_boost * overlap
        except Exception:
            pass
        ranked.append(
            {
                'id': pid,
                'text_score': float(text_score),
                'difficulty': p.get('difficulty'),
                'trickiness': p.get('trickiness'),
                'final_score': float(final_score),
                'text': (p.get('text') or '')[:500],
                'subject': p.get('subject'),
                'field_id': p.get('field_id'),
                'topic': p.get('topic'),
                'search_tier': used_tier,
            }
        )

    # sort by final_score desc and return top_k
    ranked_sorted = sorted(ranked, key=lambda x: -x['final_score'])[:top_k]
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
