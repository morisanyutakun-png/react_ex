from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import os
import json

from backend.db import connect_db

# Lazy-load embedding model to avoid ImportError when deps are missing
_embedding_model_cache = None


def _get_embedding_helpers():
    """Lazily import embedding helpers; returns (load_model_fn, vector_to_sql_literal_fn) or (None, None)."""
    try:
        from backend.embeddings import load_model, vector_to_sql_literal
        return load_model, vector_to_sql_literal
    except Exception:
        return None, None


router = APIRouter(prefix="/api", tags=["search"])


class SearchFilters(BaseModel):
    topic: Optional[str] = None
    format: Optional[str] = None
    difficulty_min: Optional[float] = None
    difficulty_max: Optional[float] = None
    has_solution: Optional[bool] = None
    tags: Optional[List[str]] = None


class SearchRequest(BaseModel):
    query: Optional[str] = None
    filters: Optional[SearchFilters] = None
    limit: Optional[int] = 10


def _do_search(query_text: Optional[str], topic: Optional[str], difficulty: Optional[str], limit: int):
    """Core search logic shared by GET and POST endpoints.

    Uses TF-IDF retriever on SQLite, pgvector on Postgres.
    Returns {'results': [...]}.
    """
    conn = connect_db()
    cur = conn.cursor()
    is_sqlite = getattr(conn, '_is_sqlite', False)

    try:
        results: List[Dict[str, Any]] = []

        if is_sqlite:
            # ------ SQLite path: TF-IDF or substring ------
            if query_text:
                # Try TF-IDF retriever first for better ranking
                try:
                    from backend.retriever import _tfidf_search, _normalize_latex_text
                    tfidf_results = _tfidf_search(conn, query_text, top_k=limit * 3)
                    if tfidf_results:
                        hit_ids = [r[0] for r in tfidf_results]
                        score_map = {r[0]: r[1] for r in tfidf_results}
                        placeholders = ','.join(['%s'] * len(hit_ids))
                        q = f"SELECT id, stem, difficulty, solution_outline FROM problems WHERE id IN ({placeholders}) LIMIT %s"
                        cur.execute(q, hit_ids + [limit])
                        rows = cur.fetchall()
                        for r in rows:
                            results.append({
                                'id': int(r[0]), 'text': r[1], 'stem': r[1],
                                'difficulty': r[2], 'solution_outline': r[3],
                                'annotation_summary': None,
                                'score': score_map.get(r[0]),
                            })
                        # sort by TF-IDF score
                        results.sort(key=lambda x: -(x.get('score') or 0))
                        results = results[:limit]
                        return {'results': results}
                except Exception:
                    pass

                # Fallback: simple substring search
                q = "SELECT id, stem, difficulty, solution_outline FROM problems WHERE stem LIKE %s ORDER BY id DESC LIMIT %s"
                cur.execute(q, [f"%{query_text}%", limit])
                rows = cur.fetchall()
                for r in rows:
                    results.append({
                        'id': int(r[0]), 'text': r[1], 'stem': r[1],
                        'difficulty': r[2], 'solution_outline': r[3],
                        'annotation_summary': None, 'score': None,
                    })
                return {'results': results}

            # filters-only
            where = []
            params: list = []
            if topic:
                where.append('stem LIKE %s')
                params.append(f"%{topic}%")
            if difficulty:
                try:
                    dval = float(difficulty)
                    where.append('(difficulty >= %s AND difficulty <= %s)')
                    params.extend([dval - 0.5, dval + 0.5])
                except ValueError:
                    pass
            where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''
            q = f"SELECT id, stem, difficulty, solution_outline FROM problems {where_sql} ORDER BY id DESC LIMIT %s"
            params.append(limit)
            cur.execute(q, params)
            rows = cur.fetchall()
            for r in rows:
                results.append({
                    'id': int(r[0]), 'text': r[1], 'stem': r[1],
                    'difficulty': r[2], 'solution_outline': r[3],
                    'annotation_summary': None,
                })
            return {'results': results}

        # ------ Postgres path (unchanged from original) ------
        version = os.environ.get('EMBEDDING_VERSION', 'v1')
        kind = os.environ.get('SEARCH_EMBEDDING_KIND', 'stem')

        filters_dict: Dict[str, Any] = {}
        if topic:
            filters_dict['topic'] = topic
        if difficulty:
            try:
                dval = float(difficulty)
                filters_dict['difficulty_min'] = dval - 0.5
                filters_dict['difficulty_max'] = dval + 0.5
            except ValueError:
                pass

        def build_filter_clause(alias_payload='a.payload'):
            clauses = []
            params = []
            if filters_dict.get('topic'):
                clauses.append(f"({alias_payload}->> 'topic') ILIKE %s")
                params.append(f"%{filters_dict['topic']}%")
            if filters_dict.get('difficulty_min') is not None:
                clauses.append("(p.difficulty >= %s)")
                params.append(filters_dict['difficulty_min'])
            if filters_dict.get('difficulty_max') is not None:
                clauses.append("(p.difficulty <= %s)")
                params.append(filters_dict['difficulty_max'])
            return (' AND '.join(clauses)) if clauses else '', params

        filter_clause, filter_params = build_filter_clause()

        if query_text:
            load_model, vector_to_sql_literal = _get_embedding_helpers()
            if load_model is None or vector_to_sql_literal is None:
                # Fall back to TF-IDF if embeddings unavailable
                try:
                    from backend.retriever import _tfidf_search
                    tfidf_results = _tfidf_search(conn, query_text, top_k=limit)
                    for pid, score in tfidf_results[:limit]:
                        cur2 = conn.cursor()
                        cur2.execute("SELECT id, stem, difficulty, solution_outline FROM problems WHERE id = %s", (pid,))
                        r = cur2.fetchone()
                        cur2.close()
                        if r:
                            results.append({
                                'id': int(r[0]), 'text': r[1], 'stem': r[1],
                                'difficulty': r[2], 'solution_outline': r[3],
                                'annotation_summary': None, 'score': float(score),
                            })
                    return {'results': results}
                except Exception:
                    return {'results': []}

            model, _ = load_model()
            vec = model.encode([query_text], convert_to_numpy=True)[0]
            vec_lit = vector_to_sql_literal(vec.tolist())

            cand_n = max(limit * 3, limit + 5)
            sql = "SELECT e.problem_id, e.vector <-> %s AS score FROM embeddings e WHERE e.kind=%s AND e.embedding_version=%s ORDER BY e.vector <-> %s LIMIT %s"
            cur.execute(sql, (vec_lit, kind, version, vec_lit, cand_n))
            rows = cur.fetchall()
            cand_ids = [r[0] for r in rows]
            score_map = {int(r[0]): float(r[1]) for r in rows}

            if not cand_ids:
                return {'results': []}

            where_parts = ["p.id = ANY(%s)"]
            params = [cand_ids]
            if filter_clause:
                where_parts.append(filter_clause)
                params.extend(filter_params)

            final_sql = (
                f"SELECT p.id, p.stem, p.difficulty, p.solution_outline, "
                f"a.payload->> 'summary' AS annotation_summary "
                f"FROM problems p "
                f"LEFT JOIN annotations a ON a.segment_id=p.id AND a.is_latest=TRUE "
                f"WHERE {' AND '.join(where_parts)} "
                f"ORDER BY CASE WHEN p.id IS NOT NULL THEN array_position(%s::int[], p.id) ELSE NULL END"
            )
            cur.execute(final_sql, params + [cand_ids])
            data_rows = cur.fetchall()
            for r in data_rows[:limit]:
                pid = int(r[0])
                results.append({
                    'id': pid, 'text': r[1], 'stem': r[1],
                    'difficulty': r[2], 'solution_outline': r[3],
                    'annotation_summary': r[4],
                    'score': score_map.get(pid),
                })
            return {'results': results}

        else:
            where = []
            params = []
            if filter_clause:
                where.append(filter_clause)
                params.extend(filter_params)
            where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''
            final_sql = (
                f"SELECT p.id, p.stem, p.difficulty, p.solution_outline, "
                f"a.payload->> 'summary' AS annotation_summary "
                f"FROM problems p "
                f"LEFT JOIN annotations a ON a.segment_id=p.id AND a.is_latest=TRUE "
                f"{where_sql} ORDER BY p.created_at DESC LIMIT %s"
            )
            params.append(limit)
            cur.execute(final_sql, params)
            rows = cur.fetchall()
            for r in rows:
                results.append({
                    'id': int(r[0]), 'text': r[1], 'stem': r[1],
                    'difficulty': r[2], 'solution_outline': r[3],
                    'annotation_summary': r[4],
                })
            return {'results': results}

    finally:
        try:
            cur.close(); conn.close()
        except Exception:
            pass


# ---- GET endpoint: accepts query params from frontend ----
@router.get('/search')
def api_search_get(
    q: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    limit: int = Query(10),
):
    """Search problems via GET with query parameters."""
    return _do_search(q, topic, difficulty, limit)


# ---- POST endpoint: accepts JSON body (backward compat) ----
@router.post('/search')
def api_search(req: SearchRequest):
    """Search problems via POST with JSON body (backward compatible)."""
    topic = None
    difficulty = None
    if req.filters:
        topic = req.filters.topic
        if req.filters.difficulty_min is not None:
            difficulty = str(req.filters.difficulty_min)
    return _do_search(req.query, topic, difficulty, int(req.limit or 10))
