from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from backend.db import connect_db
import os
import uuid
import json
from datetime import datetime

router = APIRouter()

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_DIR)
LOG_PATH = os.path.join(PROJECT_ROOT, 'data', 'tuning_logs.jsonl')

os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)


class TuningLogIn(BaseModel):
    prompt: str
    model_name: Optional[str] = None
    model_output: str
    metadata: Optional[Dict[str, Any]] = None
    expected_output: Optional[str] = None
    score: Optional[float] = None
    notes: Optional[str] = None


class SaveProblemRequest(BaseModel):
        """Request body for saving a single parsed problem into the `problems` table.

        - `parsed_output` may be either a dict (already parsed) or a JSON string.
        - When present, the endpoint maps top-level keys and the nested `problem` object
            into the `problems` table columns and inserts a single row.
        """
        parsed_output: Any
        overwrite_source: Optional[str] = None
        # allow caller to provide additional metadata to be merged into problem.metadata
        extra_metadata: Optional[Dict[str, Any]] = None


class RunLLMRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = None
    request_id: Optional[str] = None
    auto_insert: Optional[bool] = False


class BulkSaveRequest(BaseModel):
    items: List[Dict[str, Any]]
    overwrite_source: Optional[str] = None
    extra_metadata: Optional[Dict[str, Any]] = None


@router.post('/api/tuning/log')
def log_tuning_entry(payload: TuningLogIn = Body(...)):
    """Append a tuning log entry (JSONL). Useful for manual paste of model outputs for tuning.

    Stored fields: id, timestamp, prompt, model_name, model_output, expected_output, score, notes, metadata
    """
    def extract_json_snippet(text: str):
        """Try to heuristically extract JSON substring from a larger text blob.

        Returns (snippet_str or None).
        """
        if not text:
            return None
        # strip common markdown/code fences
        t = text.strip()
        # remove surrounding ```json ... ``` or ``` ... ```
        if t.startswith('```') and t.endswith('```'):
            lines = t.splitlines()
            # drop first and last fence lines
            if len(lines) >= 3:
                inner = '\n'.join(lines[1:-1]).strip()
                t = inner

        # find first JSON object or array start ('{' or '['). Prefer '{' if both exist
        idx_obj = -1
        idx_obj = t.find('{') if '{' in t else -1
        idx_arr = t.find('[') if '[' in t else -1
        # prefer object if it appears before array, else array
        if idx_obj != -1 and (idx_arr == -1 or idx_obj <= idx_arr):
            first_obj = idx_obj
            opening = '{'
            closing = '}'
        elif idx_arr != -1:
            first_obj = idx_arr
            opening = '['
            closing = ']'
        else:
            return None

        # Scan forward and track nested depth, but skip bracket-like characters that appear
        # inside common LaTeX constructs by ignoring brackets that are immediately followed
        # by a backslash (heuristic) or that appear inside inline math ($...$) ranges.
        depth = 0
        in_math = False
        i = first_obj
        while i < len(t):
            ch = t[i]
            # toggle simple math mode (naive): $ ... $
            if ch == '$':
                in_math = not in_math
                i += 1
                continue
            if in_math:
                i += 1
                continue
            # ignore bracket if escaped (e.g., \[ or \])
            if ch == '\\' and i + 1 < len(t):
                i += 2
                continue
            if ch == opening:
                depth += 1
            elif ch == closing:
                depth -= 1
                if depth == 0:
                    return t[first_obj:i+1]
            i += 1
        return None

    parsed_output = None
    valid_json = False
    parse_error = None

    snippet = extract_json_snippet(payload.model_output)
    if snippet is not None:
        try:
            parsed_output = json.loads(snippet)
            valid_json = True
        except Exception as e:
            parse_error = str(e)
    else:
        # final attempt: try parsing the whole payload
        try:
            parsed_output = json.loads(payload.model_output)
            valid_json = True
        except Exception as e:
            parse_error = str(e)

    # Validate parsed_output against expected tuning schema. If the parsed JSON
    # does not follow the expected schema (answer_brief as LaTeX, explanation, references list, confidence number),
    # reject the submission so bad examples are not saved.
    # NOTE: removed strict LaTeX heuristic enforcement here. Some model outputs
    # include LaTeX while others include plain text; rejecting submissions
    # because they don't match a LaTeX pattern caused many valid examples to
    # be dropped. We'll accept any string for `answer_brief` and only enforce
    # structural requirements below.

    validation_errors = []
    if valid_json and parsed_output is not None:
        if not isinstance(parsed_output, dict):
            validation_errors.append('parsed output must be a JSON object')
        else:
            # answer_brief may be null if model abstains, otherwise must be a string
            ab = parsed_output.get('answer_brief') if 'answer_brief' in parsed_output else None
            if ab is None:
                # allowed, but note it
                pass
            else:
                if not isinstance(ab, str):
                    validation_errors.append('answer_brief must be a string or null')

            # explanation must be present and string
            exp = parsed_output.get('explanation')
            if exp is None or not isinstance(exp, str):
                validation_errors.append('explanation must be a string')

            # references must be a list of objects with snippet
            refs = parsed_output.get('references')
            if refs is None or not isinstance(refs, list):
                validation_errors.append('references must be a list (empty if none)')
            else:
                for i, r in enumerate(refs):
                    if not isinstance(r, dict):
                        validation_errors.append(f'references[{i}] must be an object')
                    else:
                        if 'snippet' not in r or not isinstance(r.get('snippet'), str):
                            validation_errors.append(f'references[{i}].snippet must be a string')

            # confidence must be numeric between 0 and 1
            conf = parsed_output.get('confidence')
            if conf is None or not (isinstance(conf, int) or isinstance(conf, float)):
                validation_errors.append('confidence must be a number between 0.0 and 1.0')
            else:
                try:
                    if not (0.0 <= float(conf) <= 1.0):
                        validation_errors.append('confidence must be between 0.0 and 1.0')
                except Exception:
                    validation_errors.append('confidence must be a numeric value')

    # If parsing succeeded but validation failed, reject the submission to enforce quality
    if valid_json and validation_errors:
        return JSONResponse({'error': 'validation_failed', 'detail': validation_errors, 'parsed_output': parsed_output, 'parse_error': parse_error}, status_code=400)

    entry = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'prompt': payload.prompt,
        'model_name': payload.model_name,
        'model_output': payload.model_output,
        'parsed_output': parsed_output,
        'valid_json': valid_json,
        'parse_error': parse_error,
        'expected_output': payload.expected_output,
        'score': payload.score,
        'notes': payload.notes,
        'metadata': payload.metadata or {},
    }

    try:
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'failed to write log: {e}')

    # Attempt to persist into the DB as well (best-effort). If DB is not available
    # or insertion fails, continue to return success for the JSONL write.
    try:
        conn = None
        try:
            conn = connect_db()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO tuning_logs (id, timestamp, prompt, model_name, model_output, parsed_output, valid_json, parse_error, expected_output, score, notes, metadata) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    entry['id'],
                    entry['timestamp'],
                    entry['prompt'],
                    entry['model_name'],
                    entry['model_output'],
                    json.dumps(entry.get('parsed_output')) if entry.get('parsed_output') is not None else None,
                    1 if entry.get('valid_json') else 0,
                    entry.get('parse_error'),
                    entry.get('expected_output'),
                    entry.get('score'),
                    entry.get('notes'),
                    json.dumps(entry.get('metadata') or {}),
                )
            )
            conn.commit()
            try:
                cur.close()
            except Exception:
                pass
            entry['db_saved'] = True
        except Exception as e:
            entry['db_saved'] = False
            entry['db_error'] = str(e)
        finally:
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
    except Exception:
        # ignore DB errors
        pass

    return JSONResponse({'status': 'ok', 'id': entry['id'], 'db_saved': entry.get('db_saved', False), 'db_error': entry.get('db_error')})


@router.post('/api/tuning/save_problem')
def save_parsed_problem(payload: SaveProblemRequest = Body(...)):
    """Save a single parsed model output into the `problems` table.

    The endpoint accepts either a dict or a JSON string under `parsed_output`.
    It will map fields to the `problems` table columns and insert one row.
    Returns the inserted row `id` and any parse errors.
    """
    parsed = payload.parsed_output
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except Exception as e:
            return JSONResponse({'error': 'invalid_json', 'detail': str(e)}, status_code=400)

    if not isinstance(parsed, dict):
        return JSONResponse({'error': 'parsed_output_must_be_object'}, status_code=400)

    # prefer nested `problem` object for core fields, but fall back to top-level
    problem_obj = parsed.get('problem') or {}
    if problem_obj is None:
        problem_obj = {}

    # Merge top-level and nested fields; nested fields take precedence
    merged = {}
    # core textual fields (canonical names: 'stem' and 'stem_latex')
    merged['stem'] = problem_obj.get('stem') or parsed.get('stem')
    merged['solution_outline'] = problem_obj.get('solution_outline') or parsed.get('solution_outline')
    merged['stem_latex'] = problem_obj.get('stem_latex') or parsed.get('stem_latex')
    merged['explanation'] = problem_obj.get('explanation') if problem_obj.get('explanation') is not None else parsed.get('explanation')
    merged['answer_brief'] = problem_obj.get('answer_brief') if problem_obj.get('answer_brief') is not None else parsed.get('answer_brief')
    # include final_answer and checks when provided
    merged['final_answer'] = problem_obj.get('final_answer') if problem_obj.get('final_answer') is not None else parsed.get('final_answer')
    merged['checks'] = problem_obj.get('checks') if problem_obj.get('checks') is not None else parsed.get('checks')
    merged['references'] = problem_obj.get('references') if problem_obj.get('references') is not None else parsed.get('references')
    merged['confidence'] = problem_obj.get('confidence') if problem_obj.get('confidence') is not None else parsed.get('confidence')
    merged['difficulty'] = problem_obj.get('difficulty') if problem_obj.get('difficulty') is not None else parsed.get('difficulty')
    merged['difficulty_level'] = problem_obj.get('difficulty_level') if problem_obj.get('difficulty_level') is not None else parsed.get('difficulty_level')
    merged['trickiness'] = problem_obj.get('trickiness') if problem_obj.get('trickiness') is not None else parsed.get('trickiness')
    merged['metadata'] = {}
    # merge metadata dicts
    try:
        if isinstance(problem_obj.get('metadata'), dict):
            merged['metadata'].update(problem_obj.get('metadata'))
        elif isinstance(problem_obj.get('metadata'), str) and problem_obj.get('metadata').strip():
            try:
                merged['metadata'].update(json.loads(problem_obj.get('metadata')))
            except Exception:
                merged['metadata']['_raw'] = problem_obj.get('metadata')
        if isinstance(parsed.get('metadata'), dict):
            merged['metadata'].update(parsed.get('metadata'))
        elif isinstance(parsed.get('metadata'), str) and parsed.get('metadata').strip():
            try:
                merged['metadata'].update(json.loads(parsed.get('metadata')))
            except Exception:
                merged['metadata']['_raw_top'] = parsed.get('metadata')
    except Exception:
        pass
    if payload.extra_metadata:
        merged['metadata'].update(payload.extra_metadata)

    # set source/page if provided
    merged['source'] = payload.overwrite_source or problem_obj.get('source') or parsed.get('source')
    merged['page'] = problem_obj.get('page') or parsed.get('page')
    # allow normalized_text passthrough from parsed JSON
    merged['normalized_text'] = problem_obj.get('normalized_text') or parsed.get('normalized_text')
    # include optional tuning-specific fields
    merged['assumptions'] = problem_obj.get('assumptions') if problem_obj.get('assumptions') is not None else parsed.get('assumptions')
    merged['solvable'] = problem_obj.get('solvable') if problem_obj.get('solvable') is not None else parsed.get('solvable')
    merged['selected_reference'] = problem_obj.get('selected_reference') if problem_obj.get('selected_reference') is not None else parsed.get('selected_reference')
    # map schema/request-level identifiers when present so insert_problem includes them in normalized_json
    merged['schema_version'] = parsed.get('schema_version') or problem_obj.get('schema_version')
    merged['request_id'] = parsed.get('request_id') or problem_obj.get('request_id')

    # validation
    if not merged.get('stem'):
        return JSONResponse({'error': 'missing_stem'}, status_code=400)

    # require final_answer and checks for tuning-sourced saves
    try:
        from backend.llm_helpers import validate_insertable
        merged_check = {'problem': merged}
        verrs = validate_insertable(merged_check)
        if verrs:
            return JSONResponse({'error': 'validation_failed', 'detail': verrs}, status_code=400)
    except Exception:
        pass

    # Insert via shared insert_problem to ensure consistent normalization and scoring
    try:
        from workers.ingest.ingest import insert_problem
        conn = connect_db()
        pid = insert_problem(conn, merged, page=merged.get('page'))
        try:
            conn.close()
        except Exception:
            pass
        return JSONResponse({'status': 'ok', 'inserted_id': pid})
    except Exception as e:
        return JSONResponse({'error': 'db_insert_failed', 'detail': str(e)}, status_code=500)


@router.post('/api/tuning/run')
def run_llm_on_prompt(req: RunLLMRequest = Body(...)):
    """Run the LLM on a strict prompt, validate the output JSON, and optionally insert the parsed problem into DB.

    Returns the parsed JSON (if any), raw output, errors, attempts, and inserted_id (if inserted).
    """
    from backend.llm_helpers import run_llm_and_validate
    from workers.ingest.ingest import insert_problem
    if not req.prompt:
        raise HTTPException(status_code=400, detail='no prompt provided')
    # Ensure the prompt enforces strict JSON output (final_answer & checks). If the
    # caller did not provide a strict prompt, wrap it with make_strict_prompt_with_context
    # so the LLM receives explicit instructions.
    prompt_to_send = req.prompt
    try:
        if not prompt_to_send or ('schema_version' not in prompt_to_send or 'request_id' not in prompt_to_send or 'REQUIRED' not in prompt_to_send):
            from backend.llm_helpers import make_strict_prompt_with_context
            rid = str(uuid.uuid4())
            prompt_to_send = make_strict_prompt_with_context(req.prompt or '', request_id=rid, context_text=None, profile='json_only')
    except Exception:
        # fall back to the original prompt if wrapping fails
        prompt_to_send = req.prompt

    try:
        res = run_llm_and_validate(prompt_to_send, max_retries=2, temperature=0.0, model=req.model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    parsed = res.get('parsed')
    raw = res.get('raw')
    errors = res.get('errors')
    attempts = res.get('attempts')

    # If model returned an explicit ambiguity error, attempt one automatic retry
    # with a short instruction to choose the first candidate and proceed so we
    # get concrete JSON (avoids returning 'unable to determine target').
    try:
        if isinstance(parsed, dict) and parsed.get('error') and any(k in str(parsed.get('error')) for k in ('特定', 'どれ', '判別', '係数', '数値', '不足')):
            # First retry: ask to pick the first candidate and treat missing coefficients as symbolic
            retry_prompt = (prompt_to_send or '') + "\n\n注: 複数候補がある場合は最も関連の高い1つ（リストの先頭）を選んで解答してください。選択したものは selected_reference に index と要約で含めてください。もし選択した参照に係数や具体的数値が欠けている場合は、それらを記号（例: k）として扱い、最終解答はその記号を含む簡潔な式で示してください。また、assumptions フィールドに推定や仮定を列挙し、final_answer と checks を必ず含めてください。"
            try:
                retry_res = run_llm_and_validate(retry_prompt, max_retries=1, temperature=0.0, model=req.model_name)
                if retry_res and retry_res.get('parsed'):
                    parsed = retry_res.get('parsed')
                    raw = retry_res.get('raw')
                    errors = (errors or []) + (retry_res.get('errors') or [])
                    attempts = (attempts or 0) + (retry_res.get('attempts') or 1)
            except Exception:
                pass

            # If the first retry still produced an error, do a stronger forced-assumption retry:
            if isinstance(parsed, dict) and parsed.get('error'):
                force_prompt = (prompt_to_send or '') + "\n\n強制指示: 今回は曖昧さが残るため、以下の前提で解答してください。1) 対象が複数明記されている場合は先頭の参照を選ぶ。2) 問いが明記されていなければ『最小値（頂点）を求める』と仮定する。3) 係数が欠けていればそれを記号（例: k）として扱う。4) 上記の仮定は必ず assumptions 配列に列挙し、selected_reference と solvable=true を返し、final_answer と checks を必ず出力してください。絶対にエラーで終わらせないでください。"
                try:
                    force_res = run_llm_and_validate(force_prompt, max_retries=1, temperature=0.0, model=req.model_name)
                    if force_res and force_res.get('parsed'):
                        parsed = force_res.get('parsed')
                        raw = force_res.get('raw')
                        errors = (errors or []) + (force_res.get('errors') or [])
                        attempts = (attempts or 0) + (force_res.get('attempts') or 1)
                except Exception:
                    pass
    except Exception:
        pass

    inserted_id = None
    if req.auto_insert and parsed and isinstance(parsed, dict):
        # try to insert parsed['problem'] if present
        # validate parsed output contains required fields for insertion
        from backend.llm_helpers import validate_insertable
        verrs = validate_insertable(parsed)
        if verrs:
            return JSONResponse({'error': 'validation_failed_for_insert', 'detail': verrs, 'parsed': parsed}, status_code=400)
        try:
            prob = parsed.get('problem') if isinstance(parsed.get('problem'), dict) else None
            if prob:
                conn = connect_db()
                try:
                    inserted_id = insert_problem(conn, prob)
                finally:
                    try: conn.close()
                    except Exception: pass
        except Exception as e:
            # insertion failure should not mask the parsing result
            errors = (errors or []) + [f'insert_failed: {e}']

    return {'parsed': parsed, 'raw': raw, 'errors': errors, 'attempts': attempts, 'inserted_id': inserted_id}


@router.get('/api/tuning/logs')
def list_tuning_logs(limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    """Return recent tuning logs (JSONL). Simple pagination via limit/offset."""
    if not os.path.exists(LOG_PATH):
        return []
    out = []
    try:
        with open(LOG_PATH, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i < offset:
                    continue
                if len(out) >= limit:
                    break
                try:
                    out.append(json.loads(line))
                except Exception:
                    # skip malformed
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'failed to read logs: {e}')

    # return reversed so newest appear first
    return list(reversed(out))


@router.get('/api/tuning/db_logs')
def list_tuning_db_logs(limit: int = 100, offset: int = 0):
    """Return recent tuning logs from the DB table `tuning_logs`.

    Falls back to a 500 error if DB is unavailable or the table does not exist.
    """
    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, timestamp, prompt, model_name, model_output, parsed_output, valid_json, parse_error, expected_output, score, notes, metadata FROM tuning_logs ORDER BY timestamp DESC LIMIT %s OFFSET %s",
            (limit, offset),
        )
        rows = cur.fetchall()
        out = []
        for r in rows:
            # parsed_output and metadata may be stored as text; be defensive when loading
            parsed_raw = r[5]
            parsed_output_val = None
            parsed_error = None
            if parsed_raw:
                try:
                    parsed_output_val = json.loads(parsed_raw)
                except Exception as e:
                    parsed_output_val = None
                    parsed_error = f'parsed_output json load error: {e}'

            metadata_raw = r[11]
            metadata_val = {}
            if metadata_raw:
                try:
                    metadata_val = json.loads(metadata_raw)
                except Exception:
                    metadata_val = {}

            out.append({
                'id': r[0],
                'timestamp': r[1],
                'prompt': r[2],
                'model_name': r[3],
                'model_output': r[4],
                'parsed_output': parsed_output_val,
                'parsed_output_error': parsed_error,
                'valid_json': bool(r[6]),
                'parse_error': r[7],
                'expected_output': r[8],
                'score': r[9],
                'notes': r[10],
                'metadata': metadata_val,
            })
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'failed to query db tuning logs: {e}')


@router.get('/api/tuning/problem_columns')
def get_problem_columns():
    """Return column metadata for the `problems` table.

    Attempts SQLite `PRAGMA table_info('problems')` first, falls back to
    Postgres information_schema if needed.
    """
    try:
        conn = connect_db()
        cur = conn.cursor()
        cols = []
        try:
            # try SQLite PRAGMA
            cur.execute("PRAGMA table_info('problems')")
            rows = cur.fetchall()
            if rows:
                # pragma columns: cid, name, type, notnull, dflt_value, pk
                for r in rows:
                    cols.append({'name': r[1], 'type': r[2], 'notnull': bool(r[3]), 'default': r[4], 'pk': bool(r[5])})
            else:
                # fallback: information_schema (Postgres)
                cur.execute("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=%s", ('problems',))
                for r in cur.fetchall():
                    cols.append({'name': r[0], 'type': r[1], 'notnull': (r[2] == 'NO'), 'default': r[3], 'pk': False})
        except Exception:
            # try fallback query for other DBs
            try:
                cur.execute("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=%s", ('problems',))
                for r in cur.fetchall():
                    cols.append({'name': r[0], 'type': r[1], 'notnull': (r[2] == 'NO'), 'default': r[3], 'pk': False})
            except Exception as e:
                try:
                    cur.close()
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass
                raise HTTPException(status_code=500, detail=f'failed to introspect problems table: {e}')

        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        return {'columns': cols}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'failed to connect to db: {e}')


@router.get('/api/tuning/sample_problems')
def sample_problems(limit: int = 5, columns: Optional[str] = None):
    """Return sample rows from `problems`.

    `columns` is a comma-separated list of column names to include; if omitted,
    returns a sensible subset.
    """
    try:
        conn = connect_db()
        cur = conn.cursor()
        if columns:
            # sanitize simple comma-separated list
            cols = [c.strip() for c in columns.split(',') if c.strip()]
            if not cols:
                raise HTTPException(status_code=400, detail='invalid columns')
            col_sql = ', '.join(cols)
        else:
                col_sql = 'id, stem, answer_brief, explanation, difficulty, confidence, source'

        q = f"SELECT {col_sql} FROM problems ORDER BY id DESC LIMIT %s"
        cur.execute(q, (limit,))
        rows = cur.fetchall()
        out = []
        for r in rows:
            if isinstance(r, dict):
                out.append(r)
            else:
                # map by position to keys
                vals = list(r)
                if columns:
                    keys = cols
                else:
                    keys = ['id', 'stem', 'answer_brief', 'explanation', 'difficulty', 'confidence', 'source']
                obj = {}
                for k, v in zip(keys, vals):
                    # try to decode JSON fields if they look like JSON text
                    if isinstance(v, str) and (v.strip().startswith('{') or v.strip().startswith('[')):
                        try:
                            obj[k] = json.loads(v)
                        except Exception:
                            obj[k] = v
                    else:
                        obj[k] = v
                out.append(obj)

        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'failed to fetch sample problems: {e}')


    def _format_problem_record(rec: Dict[str, Any]) -> Dict[str, Any]:
        """Format a DB problem record (dict) into the rich tuning JSON structure.

    Accepts a mapping with keys such as `stem`, `answer_brief`, `explanation`,
        `references_json` (or `references`), `difficulty`, `difficulty_level`, `trickiness`,
        `stem_latex`, `metadata`, `source`, `page`, `confidence`.
        """
        # normalize metadata
        md = rec.get('metadata') or rec.get('meta')
        if isinstance(md, str):
            try:
                md = json.loads(md)
            except Exception:
                md = {'_raw': md}
        if not isinstance(md, dict):
            md = {}

        # references may be stored under references_json or references
        refs = rec.get('references_json') or rec.get('references') or rec.get('refs')
        if isinstance(refs, str):
            try:
                refs = json.loads(refs)
            except Exception:
                refs = [{'snippet': refs}]
        if refs is None:
            refs = []

        problem = {
            'source': rec.get('source') or 'unknown',
            'page': rec.get('page'),
            'stem': rec.get('stem') or rec.get('text') or rec.get('snippet') or '',
            'normalized_text': rec.get('normalized_text') or md.get('normalized_text'),
            'solution_outline': rec.get('solution_outline') or md.get('solution_outline') or '',
            'stem_latex': rec.get('stem_latex') or rec.get('latex') or None,
            'difficulty': rec.get('difficulty') if rec.get('difficulty') is not None else (md.get('difficulty') if isinstance(md, dict) else None),
            'difficulty_level': rec.get('difficulty_level') or md.get('difficulty_level'),
            'trickiness': rec.get('trickiness') if rec.get('trickiness') is not None else (md.get('trickiness') if isinstance(md, dict) else None),
            'metadata': md,
        }

        out = {
            'answer_brief': rec.get('answer_brief') or problem.get('stem_latex') or problem['stem'],
            'explanation': rec.get('explanation') or md.get('explanation') or '',
            'confidence': float(rec.get('confidence')) if rec.get('confidence') is not None else (float(md.get('confidence')) if isinstance(md.get('confidence') if isinstance(md, dict) else None, (int, float)) else None) if isinstance(md, dict) else None,
            'references': refs,
            'problem': problem,
        }
        # remove None values for cleanliness
        for k in list(out.keys()):
            if out[k] is None:
                out.pop(k)
        return out


    @router.get('/api/tuning/format_sample_problems')
    def format_sample_problems(limit: int = 5):
        """Return sample problems formatted into the richer tuning JSON structure."""
        rows = sample_problems(limit=limit)
        formatted = []
        for r in rows:
            try:
                formatted.append(_format_problem_record(r))
            except Exception:
                # if formatting fails, include raw row
                formatted.append({'raw': r})
        return formatted


    @router.get('/api/tuning/format_problem')
    def format_problem(id: Optional[str] = None, limit: int = 1):
        """Format a single problem by `id` (primary key) or return the most recent.

        If `id` is provided, attempts to fetch that row; otherwise returns the
        latest `limit` rows formatted and returns the first one.
        """
        try:
            conn = connect_db()
            cur = conn.cursor()
            if id:
                cur.execute("SELECT * FROM problems WHERE id = %s", (id,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail='problem not found')
                # fetch column names
                cols = [d[0] for d in cur.description]
                rec = {k: v for k, v in zip(cols, list(row))}
                cur.close(); conn.close()
                return _format_problem_record(rec)
            else:
                # reuse sample_problems to get recent rows
                cur.close(); conn.close()
                rows = sample_problems(limit=limit)
                if not rows:
                    raise HTTPException(status_code=404, detail='no problems')
                return _format_problem_record(rows[0])
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'failed to format problem: {e}')


@router.get('/api/tuning/export_table')
def export_problems_table(limit: int = 100):
    """Export recent problems as a flat table aligned to DB columns.

    Returns JSON: {columns: [..], rows: [[val1, val2, ...], ...]}
    Column order matches the user's desired export format.
    """
    # desired ordered columns
    cols = [
        'source', 'id', 'page', 'stem', 'normalized_text', 'solution_outline',
        'stem_latex', 'difficulty', 'difficulty_level', 'trickiness', 'metadata',
        'explanation', 'answer_brief', 'references_json', 'confidence'
    ]
    try:
        rows = sample_problems(limit=limit, columns=','.join(cols))
        out_rows = []
        for r in rows:
            row = []
            for c in cols:
                v = r.get(c)
                if v is None:
                    row.append('')
                elif isinstance(v, (dict, list)):
                    try:
                        row.append(json.dumps(v, ensure_ascii=False))
                    except Exception:
                        row.append(str(v))
                else:
                    row.append(str(v))
            out_rows.append(row)
        return {'columns': cols, 'rows': out_rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'export failed: {e}')


@router.post('/api/tuning/save_problems')
def save_multiple_problems(payload: BulkSaveRequest = Body(...)):
    """Save multiple generated problems into the `problems` table.

    Accepts a list of problem-like dicts. Each item should contain at least `stem` or `stem_latex`.
    Returns inserted_count and list of inserted_ids (or errors per item).
    """
    items = payload.items or []
    if not isinstance(items, list) or len(items) == 0:
        return JSONResponse({'error': 'no_items_provided'}, status_code=400)

    results = []
    conn = None
    try:
        conn = connect_db()
        from workers.ingest.ingest import insert_problem
        for it in items:
            try:
                # Normalize input: prefer explicit stem, fall back to stem_latex when possible
                p = dict(it or {})
                if payload.overwrite_source:
                    p['source'] = payload.overwrite_source
                if payload.extra_metadata:
                    p_meta = p.get('metadata') or {}
                    if isinstance(p_meta, dict):
                        p_meta.update(payload.extra_metadata)
                        p['metadata'] = p_meta
                # Ensure stem exists
                if not p.get('stem') and p.get('stem_latex'):
                    # as a fallback, set stem to a short plain-text preview
                    s = p.get('stem_latex')
                    p['stem'] = (s[:300] + '...') if len(s) > 300 else s
                if not p.get('stem'):
                    results.append({'ok': False, 'error': 'missing_stem', 'item': p})
                    continue
                pid = insert_problem(conn, p, page=p.get('page'))
                results.append({'ok': True, 'inserted_id': pid})
            except Exception as e:
                results.append({'ok': False, 'error': str(e), 'item': it})
    except Exception as e:
        return JSONResponse({'error': 'db_connection_failed', 'detail': str(e)}, status_code=500)
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

    inserted = sum(1 for r in results if r.get('ok'))
    return JSONResponse({'status': 'ok', 'inserted_count': inserted, 'results': results})
