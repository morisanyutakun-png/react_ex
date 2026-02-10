from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import os
import json

from backend.db import connect_db
from backend.embeddings import load_model, vector_to_sql_literal

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


@router.post('/search')
def api_search(req: SearchRequest):
    # connect_db will default to sqlite when DATABASE_URL is not set
    conn = connect_db()
    cur = conn.cursor()
    # If running on SQLite, use a simplified fallback search (no pgvector/JSONB)
    if getattr(conn, '_is_sqlite', False):
        try:
            results: List[Dict[str, Any]] = []
            limit = int(req.limit or 10)
            # simple substring search on stem (canonical column)
            if req.query:
                q = "SELECT id, stem, difficulty FROM problems WHERE stem LIKE %s ORDER BY created_at DESC LIMIT %s"
                params = [f"%{req.query}%", limit]
                cur.execute(q, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append({'id': int(r[0]), 'text': r[1], 'difficulty': r[2], 'annotation_summary': None, 'score': None})
                return {'results': results}

            # filters-only: support simple numeric filters
            where = []
            params = []
            f = req.filters.dict() if req.filters else {}
            if f.get('difficulty_min') is not None:
                where.append('(difficulty >= %s)')
                params.append(f['difficulty_min'])
            if f.get('difficulty_max') is not None:
                where.append('(difficulty <= %s)')
                params.append(f['difficulty_max'])
            where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''
            final_sql = f"SELECT id, stem, difficulty FROM problems {where_sql} ORDER BY created_at DESC LIMIT %s"
            params.append(limit)
            cur.execute(final_sql, params)
            rows = cur.fetchall()
            for r in rows:
                results.append({'id': int(r[0]), 'text': r[1], 'difficulty': r[2], 'annotation_summary': None})
            return {'results': results}
        finally:
            try:
                cur.close(); conn.close()
            except Exception:
                pass
    try:
        version = os.environ.get('EMBEDDING_VERSION', 'v1')
        kind = os.environ.get('SEARCH_EMBEDDING_KIND', 'stem')
        limit = int(req.limit or 10)

        filters = req.filters.dict() if req.filters else {}

        # helper to build WHERE on annotations/problems
        def build_filter_clause(alias_payload='a.payload'):
            clauses = []
            params = []
            if filters.get('topic'):
                clauses.append(f"({alias_payload}->> 'topic') ILIKE %s")
                params.append(f"%{filters['topic']}%")
            if filters.get('format'):
                clauses.append(f"({alias_payload}->> 'format') = %s")
                params.append(filters['format'])
            if filters.get('tags'):
                tag_clauses = []
                for t in filters['tags']:
                    tag_clauses.append(f"({alias_payload} -> 'tags') @> %s::jsonb")
                    params.append(json.dumps([t], ensure_ascii=False))
                clauses.append('(' + ' OR '.join(tag_clauses) + ')')
            if filters.get('has_solution') is not None:
                if filters['has_solution']:
                    clauses.append("(coalesce(p.solution_outline, '') <> '')")
                else:
                    clauses.append("(coalesce(p.solution_outline, '') = '')")
            if filters.get('difficulty_min') is not None:
                clauses.append("(p.difficulty >= %s)")
                params.append(filters['difficulty_min'])
            if filters.get('difficulty_max') is not None:
                clauses.append("(p.difficulty <= %s)")
                params.append(filters['difficulty_max'])
            return (' AND '.join(clauses)) if clauses else '', params

        filter_clause, filter_params = build_filter_clause()

        results: List[Dict[str, Any]] = []

        if req.query:
            # vector search: encode query and find nearest embeddings
            model, _ = load_model()
            vec = model.encode([req.query], convert_to_numpy=True)[0]
            vec_lit = vector_to_sql_literal(vec.tolist())

            # fetch candidate problem_ids by nearest neighbors
            # fetch a bit more than limit to allow filtering
            cand_n = max(limit * 3, limit + 5)
            sql = "SELECT e.problem_id, e.vector <-> %s AS score FROM embeddings e WHERE e.kind=%s AND e.embedding_version=%s ORDER BY e.vector <-> %s LIMIT %s"
            cur.execute(sql, (vec_lit, kind, version, vec_lit, cand_n))
            rows = cur.fetchall()
            cand_ids = [r[0] for r in rows]
            score_map = {int(r[0]): float(r[1]) for r in rows}

            if not cand_ids:
                return {'results': []}

            # Now fetch problem+latest annotation, applying filters
            # Build SQL with candidate ids list
            params = [cand_ids]
            where_parts = ["p.id = ANY(%s)"]
            params = [cand_ids]
            if filter_clause:
                where_parts.append(filter_clause)
                params.extend(filter_params)

            final_sql = f"SELECT p.id, p.stem, p.difficulty, a.payload->> 'summary' AS annotation_summary FROM problems p LEFT JOIN annotations a ON a.segment_id=p.id AND a.is_latest=TRUE WHERE {' AND '.join(where_parts)} ORDER BY "
            # if query present order by score
            final_sql += "CASE WHEN p.id IS NOT NULL THEN array_position(%s::int[], p.id) ELSE NULL END"
            # array_position requires passing candidate id array as param
            params = [cand_ids] + params[1:] if params and isinstance(params[0], list) else params
            # Execute
            cur.execute(final_sql, params + [cand_ids])
            data_rows = cur.fetchall()
            for r in data_rows[:limit]:
                pid = int(r[0])
                results.append({'id': pid, 'text': r[1], 'difficulty': r[2], 'annotation_summary': r[3], 'score': score_map.get(pid)})

            return {'results': results}

        else:
            # no query: return via filters only
            where = []
            params = []
            if filter_clause:
                where.append(filter_clause)
                params.extend(filter_params)

            where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''
            final_sql = f"SELECT p.id, p.stem, p.difficulty, a.payload->> 'summary' AS annotation_summary FROM problems p LEFT JOIN annotations a ON a.segment_id=p.id AND a.is_latest=TRUE {where_sql} ORDER BY p.created_at DESC LIMIT %s"
            params.append(limit)
            cur.execute(final_sql, params)
            rows = cur.fetchall()
            for r in rows:
                results.append({'id': int(r[0]), 'text': r[1], 'difficulty': r[2], 'annotation_summary': r[3]})
            return {'results': results}

    finally:
        try:
            cur.close(); conn.close()
        except Exception:
            pass
