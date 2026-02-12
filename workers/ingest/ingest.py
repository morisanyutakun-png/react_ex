"""
Simple ingest script: reads a plain text file, segments into problems using
`segmenter`, and inserts into Postgres `problems` table.

Usage:
  python workers/ingest/ingest.py /path/to/file.txt

This is a minimal MVP helper to populate the DB for later embedding steps.
"""
import os
import sys
from backend.db import connect_db
import json
from urllib.parse import urlparse
from pathlib import Path
from workers.ingest.pipeline.segmenter import segment_text, normalize_numbers

# load JSON Schema contract (single source of truth)
try:
    import jsonschema
except ImportError:
    jsonschema = None
import uuid
_contract_path = Path(__file__).parent / 'schema' / 'problem_contract.json'
try:
    with open(_contract_path, 'r', encoding='utf-8') as _f:
        problem_contract = json.load(_f)
except FileNotFoundError:
    problem_contract = None


def _extract_solution_snippet(text: str) -> str:
    # find '解答' or '解説' sections
    import re
    m = re.search(r'(解答|解説|方針).*', text)
    if not m:
        return ''
    start = m.start()
    return text[start: start + 2000]


def _count_steps(snippet: str) -> int:
    # count typical step markers: '1.', '1)', '1．', '1）', or explicit 'ステップ'/'Step'
    import re
    if not snippet:
        return 0
    # line-start digit patterns like '1.', '1)', '1．', '1）'
    pattern = r'(?:^|\n)\s*\d+\s*(?:[\)\]\.|\uFF0E\uFF09])'
    n1 = len(re.findall(pattern, snippet))
    n2 = len(re.findall(r'ステップ|Step', snippet))
    return n1 or n2


def _count_operations(text: str) -> int:
    # count arithmetic operators/operations occurrences as a proxy
    return len([c for c in text if c in '+-*/=±×÷'])


def _extract_mc_options(text: str) -> list:
    # naive multiple-choice extractor: look for lines with (A) or A.
    import re
    opts = []
    # (A) foo (B) bar in same line
    m = re.findall(r'\([A-D]\)\s*([^\(\n]+)', text)
    if m:
        return [o.strip() for o in m]
    # lines starting with A. or A)
    lines = text.splitlines()
    for ln in lines:
        m = re.match(r'\s*([A-D])(?:\.|\)|：|:)\s*(.+)', ln)
        if m:
            opts.append(m.group(2).strip())
    return opts


def _options_similarity(opts: list) -> float:
    # simple token-set Jaccard average pairwise similarity
    if not opts or len(opts) < 2:
        return 0.0
    import re
    def toks(s):
        return set(re.findall(r"\w+", s.lower()))
    pairs = 0
    total = 0.0
    for i in range(len(opts)):
        for j in range(i + 1, len(opts)):
            a = toks(opts[i])
            b = toks(opts[j])
            if not a and not b:
                sim = 0.0
            else:
                sim = len(a & b) / float(len(a | b))
            total += sim
            pairs += 1
    return total / pairs if pairs else 0.0


def _domain_keyword_density(text: str) -> float:
    # small list of math/science keywords; density = hits / word_count
    kws = ['計算', '証明', '定理', '方程式', '積分', '微分', '行列', '確率', '図形', '三角', '比', '割合']
    import re
    words = re.findall(r"\w+|[一-龥ぁ-んァ-ヴ]+", text)
    if not words:
        return 0.0
    hits = sum(1 for w in words if any(k in w for k in kws))
    return hits / len(words)


from .estimate_difficulty import estimate_difficulty
try:
    import rag
except Exception:
    try:
        from backend import rag
    except Exception:
        rag = None


def insert_problem(conn, problem, page=None):
    """Insert a problem. `problem` may be a string (stem) or a dict with keys:
    {'stem', 'solution_outline', 'stem_latex', 'source', 'metadata'}.
    Returns the inserted id (or -1 when id unknown).
    """
    if isinstance(problem, dict):
        # primary key is 'stem'; require 'stem' to be present
        if not problem.get('stem'):
            raise ValueError('missing required field: stem')
        stem = problem.get('stem')
        solution_outline = problem.get('solution_outline') or ''
        # accept only the canonical 'stem_latex'
        stem_latex = problem.get('stem_latex') if problem.get('stem_latex') is not None else None
        source_tag = problem.get('source', 'ingest')
        metadata = problem.get('metadata', {}) or {}
    else:
        stem = problem
        solution_outline = ''
        stem_latex = None
        source_tag = 'ingest'
        metadata = {}

    # allow upstream to provide a precomputed normalized_text
    if isinstance(problem, dict) and problem.get('normalized_text'):
        normalized = problem.get('normalized_text')
    else:
        normalized = normalize_numbers(stem)
    difficulty, level, trick = estimate_difficulty(stem)
    # allow optional richer fields when provided by upstream parsed JSON
    explanation = problem.get('explanation') if isinstance(problem, dict) else None
    answer_brief = problem.get('answer_brief') if isinstance(problem, dict) else None
    references = problem.get('references') if isinstance(problem, dict) else None
    # normalize references to JSON text if list/dict
    references_json = None
    if references is not None:
        try:
            if isinstance(references, (list, dict)):
                references_json = json.dumps(references, ensure_ascii=False)
            elif isinstance(references, str) and references.strip():
                # try to parse string as JSON, otherwise store as snippet list
                try:
                    json.loads(references)
                    references_json = references
                except Exception:
                    references_json = json.dumps([{'snippet': references}], ensure_ascii=False)
        except Exception:
            references_json = None

    confidence = problem.get('confidence') if isinstance(problem, dict) else None

    # If explanation/answer_brief are missing, try to extract from the stem
    try:
        if rag is not None:
            import re
            # attempt LaTeX-aware split first
            prob_core, sol_core = rag.split_problem_and_answer_latex(stem)
            if sol_core and not explanation:
                explanation = sol_core
            if sol_core and not solution_outline:
                solution_outline = sol_core
            # if there is an answer environment, use it as answer_brief if missing
            if not answer_brief:
                m = None
                try:
                    m = re.search(r"(\\begin\{answer\}[\s\S]*?\\end\{answer\})", stem, flags=re.I)
                except Exception:
                    m = None
                if m:
                    answer_brief = m.group(1)
            # Fallbacks: if explanation/answer_brief still empty, prefer solution_outline
            # (rag/chunker may populate `solution_outline` but not `explanation`/`answer_brief`).
            if (not explanation or not str(explanation).strip()) and solution_outline:
                explanation = solution_outline
            if not answer_brief and solution_outline:
                # prefer latex-like answer blocks inside the solution outline
                try:
                    m2 = re.search(r"(\\begin\{answer\}[\s\S]*?\\end\{answer\})", solution_outline, flags=re.I)
                except Exception:
                    m2 = None
                if m2:
                    answer_brief = m2.group(1)
                else:
                    # as a last resort, store a short snippet of the solution outline
                    answer_brief = solution_outline if len(solution_outline) < 1000 else solution_outline[:1000]
    except Exception:
        # ignore extraction errors and proceed
        pass

    # If still missing, try to populate explanation from metadata.expected_mistakes
    try:
        md = metadata if isinstance(metadata, dict) else {}
        if (not explanation or not explanation.strip()) and isinstance(md.get('expected_mistakes'), list) and md.get('expected_mistakes'):
            # join short mistake snippets into a readable explanation
            explanation = '\n'.join([str(x).strip() for x in md.get('expected_mistakes') if x])
        # fallback: if explanation missing but stem is short and looks like an explanatory line,
        # keep it as explanation and avoid duplicating as a full problem entry
        if (not explanation or not explanation.strip()) and isinstance(stem, str) and len(stem) < 120 and '\n' in stem:
            # use the text as explanation (trim)
            explanation = stem.strip()

        # ensure answer_brief exists: prefer explicit, then stem_latex
        if not answer_brief and stem_latex:
            answer_brief = stem_latex
    except Exception:
        pass

    # FINAL FALLBACKS: ensure explanation and answer_brief are populated from metadata
    try:
        if (not explanation or not str(explanation).strip()) and isinstance(metadata, dict):
            # prefer explicit metadata fields
            if metadata.get('explanation'):
                explanation = metadata.get('explanation')
            elif metadata.get('expected_mistakes'):
                em = metadata.get('expected_mistakes')
                if isinstance(em, list):
                    explanation = '\n'.join([str(x).strip() for x in em if x])
                else:
                    explanation = str(em)

        if (not answer_brief or not str(answer_brief).strip()) and isinstance(metadata, dict):
            if metadata.get('answer_brief'):
                answer_brief = metadata.get('answer_brief')
            elif metadata.get('stem_latex'):
                answer_brief = metadata.get('stem_latex')
            else:
                # as last resort, use a short snippet from explanation
                if explanation and len(str(explanation)) < 1000:
                    answer_brief = explanation
    except Exception:
        pass

    # extract expected_mistakes (may be provided either at top-level or inside metadata)
    expected_mistakes = None
    try:
        if isinstance(problem, dict):
            expected_mistakes = problem.get('expected_mistakes')
        if (not expected_mistakes) and isinstance(metadata, dict):
            expected_mistakes = metadata.get('expected_mistakes')
    except Exception:
        expected_mistakes = None

    # normalize expected_mistakes to JSON text when storing
    expected_mistakes_json = None
    if expected_mistakes is not None:
        try:
            if isinstance(expected_mistakes, (list, dict)):
                expected_mistakes_json = json.dumps(expected_mistakes, ensure_ascii=False)
            elif isinstance(expected_mistakes, str) and expected_mistakes.strip():
                try:
                    json.loads(expected_mistakes)
                    expected_mistakes_json = expected_mistakes
                except Exception:
                    expected_mistakes_json = json.dumps([{'note': expected_mistakes}], ensure_ascii=False)
        except Exception:
            expected_mistakes_json = None

    # trap_type and origin: try to source from problem or metadata
    trap_type = None
    if isinstance(problem, dict) and problem.get('trap_type'):
        trap_type = problem.get('trap_type')
    elif isinstance(metadata, dict) and metadata.get('trap_type'):
        trap_type = metadata.get('trap_type')

    origin_val = None
    if isinstance(problem, dict) and problem.get('origin'):
        origin_val = problem.get('origin')
    elif isinstance(metadata, dict) and metadata.get('origin'):
        origin_val = metadata.get('origin')
    else:
        origin_val = None

    # Build a base contract object (used as fallback). Ensure request_id is stable/non-null.
    base_contract = {
        'schema_version': '1.0',
        'request_id': problem.get('request_id') if isinstance(problem, dict) and problem.get('request_id') else str(uuid.uuid4()),
        'problem': {
                'stem': stem or '',
                'normalized_text': normalized if normalized is not None else None,
            'page': page if page is not None else None,
            'metadata': metadata or {},
            'solution_outline': solution_outline if solution_outline is not None else None,
            'stem_latex': stem_latex if stem_latex is not None else None,
            'difficulty': difficulty if difficulty is not None else None,
            'difficulty_level': level if level is not None else None,
            'trickiness': trick if trick is not None else None,
            'explanation': explanation if explanation is not None else None,
            'answer_brief': answer_brief if answer_brief is not None else None,
            'final_answer': problem.get('final_answer') if isinstance(problem, dict) else None,
            'checks': problem.get('checks') if isinstance(problem, dict) else None,
            'assumptions': problem.get('assumptions') if isinstance(problem, dict) else None,
            'solvable': problem.get('solvable') if isinstance(problem, dict) else None,
            'selected_reference': problem.get('selected_reference') if isinstance(problem, dict) else None,
            'references': None,
            'confidence': confidence if confidence is not None else None,
            'expected_mistakes': None,
            'source': source_tag,
        }
    }

    # Attach references/expected_mistakes into the base contract when present
    try:
        if references is not None:
            try:
                refs_parsed = json.loads(references_json) if references_json is not None else references
            except Exception:
                refs_parsed = references
            base_contract['problem']['references'] = refs_parsed
    except Exception:
        base_contract['problem']['references'] = None
    try:
        if expected_mistakes is not None:
            em_parsed = expected_mistakes if isinstance(expected_mistakes, (list, dict)) else None
            base_contract['problem']['expected_mistakes'] = em_parsed
    except Exception:
        base_contract['problem']['expected_mistakes'] = None

    # Extract LLM-provided fields (final_answer, checks, assumptions, etc.) when present
    final_answer = None
    final_answer_numeric = None
    checks_json = None
    assumptions_json = None
    selected_reference_json = None
    solvable_val = None
    try:
        if isinstance(problem, dict):
            fa = problem.get('final_answer')
            if fa is not None:
                final_answer = str(fa)
                if isinstance(fa, (int, float)):
                    final_answer_numeric = float(fa)
            if problem.get('checks') is not None:
                checks_json = json.dumps(problem.get('checks'), ensure_ascii=False)
            if problem.get('assumptions') is not None:
                assumptions_json = json.dumps(problem.get('assumptions'), ensure_ascii=False)
            if problem.get('selected_reference') is not None:
                selected_reference_json = json.dumps(problem.get('selected_reference'), ensure_ascii=False)
            if problem.get('solvable') is not None:
                solvable_val = 1 if problem.get('solvable') else 0
    except Exception:
        final_answer = None
        final_answer_numeric = None
        checks_json = None
        assumptions_json = None
        selected_reference_json = None
        solvable_val = None

    # Decide raw_text / raw_json / normalized_json according to provided inputs and validation outcome.
    raw_text = problem.get('raw_text') if isinstance(problem, dict) and problem.get('raw_text') is not None else stem

    parsed_raw_json = None
    raw_json_str = None
    normalized_json = None

    # If upstream supplied a raw_json field (string or object), try to parse & validate it first
    if isinstance(problem, dict) and problem.get('raw_json') is not None:
        try:
            # allow either dict or JSON string
            if isinstance(problem.get('raw_json'), (dict, list)):
                parsed_raw_json = problem.get('raw_json')
                raw_json_str = json.dumps(parsed_raw_json, ensure_ascii=False)
            else:
                raw_json_str = str(problem.get('raw_json'))
                parsed_raw_json = json.loads(raw_json_str)
        except Exception:
            parsed_raw_json = None

    # If we parsed a raw_json, attempt to validate it against the canonical contract
    if parsed_raw_json is not None:
        try:
            if jsonschema is not None and problem_contract is not None:
                jsonschema.validate(parsed_raw_json, problem_contract)
            # validation passed (or skipped): this is our normalized JSON
            normalized_json = json.dumps(parsed_raw_json, ensure_ascii=False)
            # preserve raw_json_str (already set)
        except Exception:
            # validation failed: keep raw_json_str for auditing, but also try to validate our base_contract
            normalized_json = None

    # If we don't have a validated normalized_json yet, validate the base_contract
    if normalized_json is None:
        try:
            if jsonschema is not None and problem_contract is not None:
                jsonschema.validate(base_contract, problem_contract)
            # validation succeeded (or skipped): use base_contract as both raw and normalized
            normalized_json = json.dumps(base_contract, ensure_ascii=False)
        except Exception:
            # validation failed; do not set raw_json (we only save raw_json when json.loads succeeded)
            pass

    # finalize names expected by DB insert: raw_json (string or None) and normalized_json (string or None)
    raw_json = raw_json_str if 'raw_json_str' in locals() else None
    cur = conn.cursor()
    is_sqlite = getattr(conn, '_is_sqlite', False)

    # ── Compute subject/topic/subtopic/language for both SQLite and Postgres ──
    subject = metadata.get('subject') if isinstance(metadata, dict) and metadata.get('subject') else (metadata.get('topic') if isinstance(metadata, dict) else None) or 'general'
    topic = metadata.get('topic') if isinstance(metadata, dict) else None
    subtopic = metadata.get('subtopic') if isinstance(metadata, dict) else None
    language = metadata.get('language') if isinstance(metadata, dict) and metadata.get('language') else 'ja'

    if is_sqlite:
        # stem already computed above (variable `stem_latex` comes from above)
        choices_json = None
        answer_json = None
        try:
            if isinstance(problem, dict):
                if problem.get('choices') is not None:
                    choices_json = json.dumps(problem.get('choices'), ensure_ascii=False)
                if problem.get('answer') is not None:
                    answer_json = json.dumps(problem.get('answer'), ensure_ascii=False)
        except Exception:
            choices_json = None
            answer_json = None

        concepts_json = None
        try:
            if isinstance(problem, dict) and problem.get('concepts') is not None:
                concepts_json = json.dumps(problem.get('concepts'), ensure_ascii=False)
        except Exception:
            concepts_json = None

        metadata_json = json.dumps(metadata, ensure_ascii=False) if metadata is not None else None

        # Insert into the simplified sqlite `problems` table we use for local dev.
        cur.execute(
            """
            INSERT INTO problems (
                subject, topic, subtopic, language,
                source, page, stem, normalized_text, solution_outline, stem_latex,
                difficulty, difficulty_level, trickiness, metadata, explanation, answer_brief,
                references_json, expected_mistakes, confidence, raw_text, raw_json, normalized_json,
                final_answer_text, final_answer_numeric, checks_json, assumptions_json, selected_reference_json, solvable,
                schema_version, request_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                subject,
                topic,
                subtopic,
                language,
                source_tag,
                page,
                stem,
                normalized,
                solution_outline,
                stem_latex,
                difficulty,
                level,
                trick,
                json.dumps(metadata, ensure_ascii=False),
                explanation,
                answer_brief,
                references_json,
                expected_mistakes_json,
                confidence,
                raw_text,
                raw_json,
                normalized_json,
                final_answer,
                final_answer_numeric,
                checks_json,
                assumptions_json,
                selected_reference_json,
                solvable_val,
                base_contract.get('schema_version'),
                base_contract.get('request_id'),
            ),
        )
    else:
        # keep existing Postgres-compatible insert for backwards compatibility
        cur.execute(
             """
             INSERT INTO problems (subject, topic, subtopic, language, source, page, stem, normalized_text, solution_outline, stem_latex, difficulty, difficulty_level, trickiness, metadata_json, explanation, answer_brief, references_json, expected_mistakes, confidence, raw_text, raw_json, normalized_json, final_answer_text, final_answer_numeric, checks_json, assumptions_json, selected_reference_json, solvable)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
             RETURNING id
             """,
             (
                 subject,
                 topic,
                 subtopic,
                 language,
                 source_tag,
                 page,
                 stem,
                 normalized,
                 solution_outline,
                 stem_latex,
                 difficulty,
                 level,
                 trick,
                 json.dumps(metadata, ensure_ascii=False),
                 explanation,
                 answer_brief,
                 references_json,
                 expected_mistakes_json,
                 confidence,
                 raw_text,
                 raw_json,
                 normalized_json,
                 final_answer,
                 final_answer_numeric,
                 checks_json,
                 assumptions_json,
                 selected_reference_json,
                 solvable_val,
             ),
         )
    # Some DB drivers (or older SQLite builds) may not support RETURNING. Try fetchone(),
    # otherwise fall back to cursor.lastrowid on the underlying DB cursor if available.
    try:
        pid = cur.fetchone()[0]
    except Exception:
        pid = None
        try:
            # SQLite wrapper exposes underlying cursor as _cur
            pid = getattr(cur, '_cur', cur).lastrowid
        except Exception:
            pid = None
    if pid is None:
        # as a final fallback, return -1 to indicate unknown id but allow processing to continue
        pid = -1
    conn.commit()
    cur.close()
    return pid


def main():
    if len(sys.argv) < 2:
        print('Usage: python workers/ingest/ingest.py PATH_TO_TEXT')
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print('File not found:', path)
        sys.exit(1)

    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('Please set DATABASE_URL environment variable (see .env.example)')
        sys.exit(1)

    # get a DB connection; connect_db handles sqlite fallback when db_url is None
    conn = connect_db(db_url)

    chunks = segment_text(text)
    print('Found', len(chunks), 'problem chunks')
    for c in chunks:
        # segmenter returns dicts; insert_problem now accepts dict or string
        if isinstance(c, dict):
            pid = insert_problem(conn, c, page=c.get('page'))
        else:
            pid = insert_problem(conn, c)
        print('Inserted problem id=', pid)

    conn.close()


if __name__ == '__main__':
    main()
