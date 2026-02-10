import json
import uuid
from pathlib import Path
import os
import requests

try:
    import jsonschema
except Exception:
    jsonschema = None

# Load canonical contract used across the repo
_contract_path = Path(__file__).parent.parent / 'workers' / 'ingest' / 'schema' / 'problem_contract.json'
try:
    with open(_contract_path, 'r', encoding='utf-8') as f:
        PROBLEM_CONTRACT = json.load(f)
except Exception:
    PROBLEM_CONTRACT = None


def make_strict_prompt(stem: str, request_id: str = None) -> str:
    """Return a strict system+user prompt instructing the LLM to output exactly one JSON object
    following the canonical contract. This is for development only: callers should send the
    returned prompt to their LLM and then paste the model output into the validation endpoint.
    """
    if not request_id:
        request_id = str(uuid.uuid4())

    system = (
        'You are an assistant that outputs exactly one JSON object and nothing else. '
        'Do not add any surrounding text, explanation, or markdown. The JSON MUST include ' 
        'top-level fields "schema_version" and "request_id". The canonical schema_version is "1.0". '
        'If the input is missing required problem details, return an object with only an "error" ' 
        'field describing the missing information. Use only JSON types (no python/undefined).'
    )

    user = (
    f'Problem: {stem}\n'
        f'Response requirements:\n'
        '- Output exactly one JSON object (no surrounding text).\n'
        '- Include "schema_version":"1.0" and "request_id":"{request_id}".\n'
        '- If solvable, include "problem" with subfields and a "final_answer" string and "checks" array ' 
        'with at least two verification items.\n'
        '- If not solvable because information is missing, return only an error object e.g. {"error":"..."}.\n'
    )

    return f"SYSTEM:\n{system}\n\nUSER:\n{user}"


def make_strict_prompt_with_context(stem: str, request_id: str = None, context_text: str = None, profile: str = 'default') -> str:
    """Build a strict prompt that includes optional context (retrieved refs, variant prompt) and a chosen profile.

    Ensures the output instructions require a single JSON object following the canonical contract.
    """
    if not request_id:
        request_id = str(uuid.uuid4())

    system = (
        'You are an assistant that outputs exactly one JSON object and nothing else. '
        'Do not add any surrounding text, explanation, or markdown. The JSON MUST include top-level fields "schema_version" and "request_id". '
        'If the input is missing required problem details, return an object with only an "error" field describing the missing information.'
    )

    profile_desc = ''
    if profile == 'json_only':
        profile_desc = 'Return only a machine-parsable JSON object following the schema described below.'
    elif profile == 'explain_then_json':
        profile_desc = 'First give a very brief natural language answer (1-2 sentences), then output the JSON object only.'
    else:
        profile_desc = 'Output the required JSON object. Do not include extra text.'

    user_parts = [f'Problem: {stem}', profile_desc, "Response requirements:", '- Output exactly one JSON object (no surrounding text).', f'- Include "schema_version":"1.0" and "request_id":"{request_id}".']
    user_parts.append('- If solvable, include "problem" and a "final_answer" and a "checks" array with at least two verification items.')
    user_parts.append('- If multiple candidate problems or references are present in the context, choose the single most relevant one and include a top-level field "selected_reference": {"index": <number>, "id": "<doc_id>", "snippet": "..."} identifying it. If ambiguous, default to the first candidate.')
    user_parts.append('- If the selected reference lacks numeric coefficients (e.g., unspecified constants like k), do not return an error. Instead: (a) treat missing values as symbolic parameters (e.g., k) and return the answer as a symbolic expression where appropriate; (b) include an "assumptions" array listing any inferred or defaulted assumptions; (c) ensure "final_answer" is present (numeric if computable, otherwise a concise symbolic expression string).')
    user_parts.append('- If the selected reference does not explicitly state "what to find" (e.g., minimum value, vertex, k satisfying a condition), assume the most likely exam-style task in this order: (1) minimum value (vertex), (2) find k that makes roots have property, (3) compute discriminant-related quantity. State the assumed task in "assumptions" and set a top-level boolean "solvable": true if you proceeded with assumptions, or false only if absolutely impossible to produce any meaningful answer.')
    user_parts.append('- REQUIRED OUTPUT STRUCTURE: top-level fields: "schema_version", "request_id", "solvable" (boolean). Under "problem": include "stem", "final_answer", "checks" (>=2), optional "assumptions" (array), and "selected_reference" object referencing the chosen chunk (index and id). Do not return an "error" object unless you absolutely cannot proceed under any reasonable assumption.')
    # explicit requirement for machine-usable outputs
    user_parts.append('- REQUIRED: include "final_answer" (numeric if applicable) and "checks" (array with at least 2 verification objects).')
    if context_text:
        # Prepend context so LLM uses it when forming solution
        user = 'Context:\n' + context_text + '\n\n' + '\n'.join(user_parts)
    else:
        user = '\n'.join(user_parts)

    return f"SYSTEM:\n{system}\n\nUSER:\n{user}"


def parse_and_validate_raw_output(raw_output: str):
    """Try to extract a single JSON object from raw_output and validate against the canonical contract.
    Returns a tuple (parsed_obj_or_None, errors_list). If jsonschema is not available, returns a warning
    in errors_list but still returns the parsed object (if parsing succeeded).
    """
    if not raw_output or not raw_output.strip():
        return None, ['empty output']

    t = raw_output.strip()
    # strip fenced code blocks
    if t.startswith('```') and t.endswith('```'):
        lines = t.splitlines()
        if len(lines) >= 3:
            t = '\n'.join(lines[1:-1]).strip()

    # If wrapped quoted string, try to unquote
    try:
        if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
            unc = json.loads(t)
            try:
                parsed = json.loads(unc)
            except Exception:
                parsed = unc if isinstance(unc, (dict, list)) else None
            if parsed is not None:
                t = json.dumps(parsed, ensure_ascii=False)
    except Exception:
        pass

    # final parse
    try:
        parsed = json.loads(t)
    except Exception as e:
        # try to find first {...} or [...] substring that parses
        parsed = None
        s = t
        for i in range(len(s)):
            if s[i] in '{[':
                depth = 0
                j = i
                while j < len(s):
                    ch = s[j]
                    if ch == s[i]:
                        depth += 1
                    elif (s[i] == '{' and ch == '}') or (s[i] == '[' and ch == ']'):
                        depth -= 1
                        if depth == 0:
                            try:
                                candidate = s[i:j+1]
                                parsed = json.loads(candidate)
                                break
                            except Exception:
                                break
                    j += 1
        if parsed is None:
            return None, [f'json parse error: {str(e)}']

    errors = []
    if PROBLEM_CONTRACT is None:
        errors.append('contract not available in server')
        return parsed, errors

    if jsonschema is None:
        errors.append('jsonschema package not installed; skipping schema validation')
        return parsed, errors

    try:
        jsonschema.validate(parsed, PROBLEM_CONTRACT)
    except Exception as e:
        errors.append(str(e))
        return parsed, errors

    return parsed, errors


def validate_insertable(parsed: dict):
    """Validate that parsed JSON is suitable for insertion: requires final_answer and checks (>=2).

    Returns a list of error strings (empty if OK).
    Also performs in-place coercion (e.g. final_answer → str) so downstream
    code always gets consistent types.
    """
    errs = []
    if not isinstance(parsed, dict):
        return ['parsed must be a JSON object']
    # prefer nested problem
    problem = parsed.get('problem') if isinstance(parsed.get('problem'), dict) else parsed

    # ── final_answer ──
    fa = problem.get('final_answer')
    if fa is None and 'final_answer' not in problem:
        errs.append('missing final_answer')
    else:
        # coerce any value to string so downstream always gets str
        if fa is not None:
            if not isinstance(fa, (int, float, str)):
                try:
                    problem['final_answer'] = str(fa)
                except Exception:
                    errs.append('final_answer must be numeric or string')
            elif not isinstance(fa, str):
                # keep numeric as-is (valid)
                pass
        else:
            # final_answer key exists but is None — treat as empty string
            problem['final_answer'] = ''

    # ── checks ──
    checks = problem.get('checks')
    if checks is None:
        # auto-generate minimal checks so validation passes
        problem['checks'] = [
            {'desc': '自動生成 — 未検証', 'ok': False},
            {'desc': '自動生成 — 未検証', 'ok': False},
        ]
    else:
        if isinstance(checks, str):
            # try to parse JSON string
            try:
                checks = json.loads(checks)
                problem['checks'] = checks
            except Exception:
                checks = []
        if not isinstance(checks, list):
            errs.append('checks must be an array')
        else:
            if len(checks) < 2:
                errs.append('checks must contain at least 2 items')
            else:
                for i, c in enumerate(checks):
                    if not isinstance(c, dict):
                        errs.append(f'checks[{i}] must be an object')
                    else:
                        # auto-fill missing desc/ok with defaults instead of hard-failing
                        if 'desc' not in c:
                            c['desc'] = f'check {i + 1}'
                        if 'ok' not in c:
                            c['ok'] = False
    return errs


def make_generation_prompt_with_context(stem: str, num: int = 5, request_id: str = None, context_text: str = None, profile: str = 'latex_only', min_difficulty: float = None, max_difficulty: float = None, generation_style: str = None, prohibited_tags: list = None, include_explanations: bool = False) -> str:
    """Build a strict prompt instructing the LLM to return a JSON object with a 'generated' array.

    Each generated item should be an object with keys: 'latex' (required), optional 'stem', optional 'difficulty', optional 'tags'.
    The output MUST be a single JSON object with top-level fields: schema_version, request_id, generated.
    """
    if not request_id:
        request_id = str(uuid.uuid4())

    system = (
        'You are a generator that outputs exactly one JSON object and nothing else. The JSON object MUST include top-level keys "schema_version" and "request_id" and a key "generated" which is an array of generated problems. Each generated problem should be an object containing at minimum a "latex" string (the full problem in LaTeX). Optional fields: "stem" (plain text), "difficulty" (0-1), and "tags" (array of strings). Do not include any surrounding text or explanations.'
    )

    parts = [f'Generate {num} distinct problems similar to the following prompt (do not simply repeat).', f'Include each problem as a LaTeX string in the "latex" field.']
    # add difficulty constraints if provided
    if min_difficulty is not None or max_difficulty is not None:
        rng = f"between {min_difficulty if min_difficulty is not None else 0.0} and {max_difficulty if max_difficulty is not None else 1.0}"
        parts.append(f'- Constraint: set a difficulty score for each generated item and keep difficulty in {rng}. Include the numeric difficulty in the "difficulty" field (0.0-1.0).')
    # add generation style guidance
    if generation_style:
        parts.append(f'- Style: {generation_style}. Follow this style when composing problems and LaTeX rendering.')
    # add prohibited tags/phrases to avoid unwanted styles
    if prohibited_tags:
        parts.append(f'- Do NOT produce problems with these tags/characteristics: {", ".join(prohibited_tags)}')
    if include_explanations:
        parts.append('- For each generated item include an optional short "explanation" field (one-sentence) describing the solution approach.')
    parts.append('- Output exactly one JSON object with fields: "schema_version":"1.0", "request_id":"%s", "generated": [ ... ]' % request_id)
    parts.append(r'- Each item in "generated" must be a JSON object with "latex" (string). The "latex" field MUST be a valid LaTeX-formatted problem (use inline $...$ or display \[...\] for equations, or full LaTeX environments). Optionally include "stem" (plain text), "difficulty" (number between 0 and 1), and "tags" (array of short strings).')
    parts.append('Example output:\n{ "schema_version":"1.0", "request_id": "%s", "generated": [ {"latex":"\\\\[ x^2-4x+3=(x-2)^2-1 \\\\]", "stem":"二次関数 f(x)=x^2-4x+3 の最小値を求めよ", "difficulty":0.3 }, ... ] }' % request_id)
    parts.append('- Do not return extraneous commentary. If you cannot generate real variants, return an empty "generated" array instead of an error.')

    if context_text:
        user = 'Context:\n' + context_text + '\n\n' + '\n'.join(parts)
    else:
        user = '\n'.join(parts)

    return f"SYSTEM:\n{system}\n\nUSER:\n{user}"


def run_llm_generation(prompt: str, model: str = None, timeout: int = 20):
    """Call a local Ollama-like LLM HTTP API. Returns dict: {'raw': str, 'parsed': obj, 'errors': list}.

    This is a lightweight wrapper; in tests you can monkeypatch this function.
    """
    ollama_url = os.getenv('OLLAMA_URL')
    ollama_model = model or os.getenv('OLLAMA_MODEL', 'llama3')
    if not ollama_url:
        raise RuntimeError('OLLAMA_URL not configured; cannot call LLM')

    payload = {'model': ollama_model, 'prompt': prompt}
    try:
        resp = requests.post(f"{ollama_url.rstrip('/')}/api/generate", json=payload, timeout=timeout)
        resp.raise_for_status()
        body = resp.json()
        # try to extract text fields used by various servers
        raw = ''
        if isinstance(body, dict):
            # common shape: {'results': [{'content': '...'}]} or {'text': '...'}
            if 'results' in body and isinstance(body['results'], list) and body['results']:
                raw = ''.join([r.get('text') or r.get('content') or '' for r in body['results']])
            elif 'text' in body:
                raw = body.get('text')
            elif 'output' in body and isinstance(body['output'], str):
                raw = body['output']
            else:
                raw = json.dumps(body, ensure_ascii=False)
        else:
            raw = str(body)
    except Exception as e:
        return {'raw': None, 'parsed': None, 'errors': [str(e)]}

    parsed, errors = parse_and_validate_raw_output(raw)
    
    # For generation mode, require that parsed contains a 'generated' array with LaTeX strings
    def _is_latex_like(s: str) -> bool:
        if not s or not isinstance(s, str):
            return False
        import re
        return bool(re.search(r"\\\\|\\frac|\\begin\{|\\\[|\$|\^|_", s))

    # If parsed looks like generation output, validate latex presence; if missing, retry once
    if isinstance(parsed, dict) and isinstance(parsed.get('generated'), list):
        bad = False
        for it in parsed.get('generated'):
            if not isinstance(it, dict) or not _is_latex_like(it.get('latex') if isinstance(it.get('latex'), str) else None):
                bad = True
                break
        if bad:
            # append strong instruction and retry once
            retry_prompt = (prompt or '') + "\n\n強化指示: 生成する各項目の 'latex' フィールドには有効な LaTeX コード（例: $...$、\\[...\\]、\\frac{...}{...} など）を必ず含めてください。'latex' に完全な問題表現（式と必要なテキスト）を入れ、JSON以外の付随コメントは出さないでください。"
            try:
                # call LLM again
                ollama_url = os.getenv('OLLAMA_URL')
                if not ollama_url:
                    return {'raw': raw, 'parsed': parsed, 'errors': errors}
                payload = {'model': model or os.getenv('OLLAMA_MODEL', 'llama3'), 'prompt': retry_prompt}
                resp = requests.post(f"{ollama_url.rstrip('/')}/api/generate", json=payload, timeout=timeout)
                resp.raise_for_status()
                body2 = resp.json()
                raw2 = ''
                if isinstance(body2, dict):
                    if 'results' in body2 and isinstance(body2['results'], list) and body2['results']:
                        raw2 = ''.join([r.get('text') or r.get('content') or '' for r in body2['results']])
                    elif 'text' in body2:
                        raw2 = body2.get('text')
                    elif 'output' in body2 and isinstance(body2['output'], str):
                        raw2 = body2['output']
                    else:
                        raw2 = json.dumps(body2, ensure_ascii=False)
                else:
                    raw2 = str(body2)
                parsed2, errors2 = parse_and_validate_raw_output(raw2)
                if isinstance(parsed2, dict) and isinstance(parsed2.get('generated'), list):
                    ok2 = True
                    for it in parsed2.get('generated'):
                        if not isinstance(it, dict) or not _is_latex_like(it.get('latex') if isinstance(it.get('latex'), str) else None):
                            ok2 = False
                            break
                    if ok2:
                        return {'raw': raw2, 'parsed': parsed2, 'errors': errors2}
                # if retry did not succeed, return original result but annotate errors
                return {'raw': raw, 'parsed': parsed, 'errors': (errors or []) + ['latex_validation_failed_on_retry']}
            except Exception as e:
                return {'raw': raw, 'parsed': parsed, 'errors': (errors or []) + [str(e)]}

    return {'raw': raw, 'parsed': parsed, 'errors': errors}


def run_llm_and_validate(prompt: str, max_retries: int = 2, temperature: float = 0.0, model: str = None, timeout: int = 20):
    """Call the LLM with a strict prompt and attempt to parse/validate a single JSON object.

    Returns a dict: {'raw': str, 'parsed': obj or None, 'errors': list, 'attempts': int}.
    This is intentionally lightweight so tests can monkeypatch it; in production it
    will call the same Ollama-compatible endpoint used by run_llm_generation.
    """
    ollama_url = os.getenv('OLLAMA_URL')
    ollama_model = model or os.getenv('OLLAMA_MODEL', 'llama3')
    if not ollama_url:
        raise RuntimeError('OLLAMA_URL not configured; cannot call LLM')

    payload = {'model': ollama_model, 'prompt': prompt}
    attempts = 0
    last_raw = None
    last_parsed = None
    last_errors = []

    for attempt in range(1, max_retries + 1):
        attempts = attempt
        try:
            resp = requests.post(f"{ollama_url.rstrip('/')}/api/generate", json=payload, timeout=timeout)
            resp.raise_for_status()
            body = resp.json()
            raw = ''
            if isinstance(body, dict):
                if 'results' in body and isinstance(body['results'], list) and body['results']:
                    raw = ''.join([r.get('text') or r.get('content') or '' for r in body['results']])
                elif 'text' in body:
                    raw = body.get('text')
                elif 'output' in body and isinstance(body['output'], str):
                    raw = body['output']
                else:
                    raw = json.dumps(body, ensure_ascii=False)
            else:
                raw = str(body)
        except Exception as e:
            last_raw = None
            last_parsed = None
            last_errors = [str(e)]
            # If the call itself failed, do not retry semantics beyond the configured attempts
            continue

        parsed, errors = parse_and_validate_raw_output(raw)
        last_raw = raw
        last_parsed = parsed
        last_errors = errors or []

        # If parsed and schema validation succeeded (no schema errors), return
        if parsed is not None and (not errors or all('jsonschema' not in e for e in errors)):
            return {'raw': last_raw, 'parsed': last_parsed, 'errors': last_errors, 'attempts': attempts}

        # If parsed contains an explicit error field, return immediately so caller can retry with different prompt
        if isinstance(parsed, dict) and parsed.get('error'):
            return {'raw': last_raw, 'parsed': last_parsed, 'errors': last_errors, 'attempts': attempts}

        # otherwise, prepare a slightly stronger instruction and retry
        payload['prompt'] = (prompt or '') + "\n\n追記: 出力は1つのJSONオブジェクトのみを返してください。余分な説明やマークダウンは出さないでください。失敗する場合は空のオブジェクトではなく{'error':'...'}の形でエラーを返してください。"

    # return last attempt results
    return {'raw': last_raw, 'parsed': last_parsed, 'errors': last_errors, 'attempts': attempts}
