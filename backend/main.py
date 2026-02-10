import os
import uuid
import subprocess
import shutil
import zipfile
from typing import Optional, Dict, Any
import re
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi import Body
import json
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse, FileResponse
from pydantic import BaseModel
from io import BytesIO
import sys
import tempfile

# ensure project root is on sys.path so top-level imports like `workers` work
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    import rag
except Exception:
    # allow importing as module (tests/importers) where package context differs
    from . import rag

# Attempt to import retriever helper functions; fall back to None when unavailable
try:
    from backend.retriever import retrieve_with_profile
except Exception:
    try:
        from retriever import retrieve_with_profile  # type: ignore
    except Exception:
        retrieve_with_profile = None

# Attempt to import embeddings helpers (load_model, vector_to_sql_literal)
try:
    from backend.embeddings import load_model, vector_to_sql_literal
except Exception:
    try:
        from embeddings import load_model, vector_to_sql_literal  # type: ignore
    except Exception:
        load_model = None
        vector_to_sql_literal = None

import requests
import logging
import traceback
from backend.db import connect_db
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10MB 制限

app = FastAPI(title="RAG LaTeX/JSON MVP")

# In-memory store used by several endpoints (keeps session/sample docs in memory).
# Initialize it to avoid NameError in dev/test environments where DB isn't used.
STORE: Dict[str, Any] = {}

# include routers
try:
    from backend.routers.annotations import router as annotations_router
    app.include_router(annotations_router)
except Exception:
    # ignore if router cannot be imported (keeps backward compatibility)
    pass

try:
    from backend.routers.search import router as search_router
    app.include_router(search_router)
except Exception:
    pass

try:
    from backend.routers.generations import router as generations_router
    app.include_router(generations_router)
except Exception:
    pass

try:
    from backend.routers.tuning import router as tuning_router
    app.include_router(tuning_router)
except Exception:
    # optional router; ignore if not present
    pass

class IngestJSON(BaseModel):
    latex: Optional[str] = None
    plain_text: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AssemblePromptRequest(BaseModel):
    question: str
    top_k: int = 5
    target_difficulty: Optional[float] = None
    target_trickiness: Optional[float] = None
    use_vector: bool = True
    tuning_mode: Optional[bool] = False
    # Optional tuning profile/mode: 'json_only', 'explain_then_json', 'short_answer'
    tuning_profile: Optional[str] = None
    # When true, include reference chunks inline in the tuning prompt instructions
    tuning_include_refs: Optional[bool] = True
    # Optional run-level metadata to help generate more specific tuning prompts
    model_name: Optional[str] = None
    expected_output: Optional[str] = None
    # Additional tuning control knobs and context
    difficulty_match_weight: Optional[float] = None
    trickiness_weight: Optional[float] = None
    # additional re-ranking control (optional): text weight
    text_weight: Optional[float] = None
    doc_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AskRequest(BaseModel):
    doc_id: Optional[str] = None
    question: str
    top_k: int = 5


def latex_to_plain(latex: str) -> str:
    """Convert LaTeX to plain text.

    - If pandoc is available, call it for a robust conversion.
    - Otherwise fall back to a conservative regex-based strip of common TeX commands.
    """
    if not latex:
        return ""
    # try pandoc if installed
    if shutil.which("pandoc"):
        try:
            p = subprocess.run(["pandoc", "-f", "latex", "-t", "plain"], input=latex.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            out = p.stdout.decode("utf-8", errors="ignore")
            if out:
                return out
        except Exception:
            # fall through to regex fallback
            pass

    # naive fallback with some improvements to preserve useful content:
    s = latex
    # 1) remove comments
    s = '\n'.join(line.split('%', 1)[0] for line in s.splitlines())

    # 2) extract and preserve \begin{answer}...\end{answer} blocks
    answer_blocks = []
    def _answer_repl(m):
        answer_blocks.append(m.group(1).strip())
        return f"__ANSWER_BLOCK_{len(answer_blocks)-1}__"
    s = re.sub(r"\\begin\{answer\}([\s\S]*?)\\end\{answer\}", _answer_repl, s, flags=re.I)

    # 3) replace common math delimiters but keep inner content (remove $ / $$ / \( \) / \[ \])
    s = re.sub(r"\$\$(.*?)\$\$", r"\1", s, flags=re.S)
    s = re.sub(r"\$(.*?)\$", r"\1", s, flags=re.S)
    s = re.sub(r"\\\((.*?)\\\)", r"\1", s, flags=re.S)
    s = re.sub(r"\\\[(.*?)\\\]", r"\1", s, flags=re.S)

    # 4) remove generic \begin{...}/\end{...} except we already removed answer blocks
    s = re.sub(r"\\begin\{[^}]+\}|\\end\{[^}]+\}", "", s)

    # 5) iteratively remove LaTeX commands but preserve braced arguments where reasonable
    #    e.g. \textbf{word} -> word, \frac{a}{b} -> a/b (best-effort)
    # convert simple \frac{a}{b} -> a/b
    s = re.sub(r"\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}", r"(\1/\2)", s)
    # replace commands with a single braced arg: \cmd{arg} -> arg
    for _ in range(3):
        s = re.sub(r"\\[a-zA-Z@]+\*?\s*\{([^}]*)\}", r"\1", s)
    # remove remaining command names like \alpha or \item
    s = re.sub(r"\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?", "", s)

    # 6) remove any leftover braces
    s = s.replace("{", "").replace("}", "")

    # 7) remove zero-width and control characters
    s = re.sub(r"[\u200B-\u200F\uFEFF\x00-\x1F]", "", s)

    # 8) collapse long runs of the same character (e.g. 単単単 -> 単)
    try:
        s = re.sub(r"(.)\1{2,}", r"\1", s)
    except re.error:
        # on some environments the backreference may fail; ignore
        pass

    # 9) collapse multiple spaces and normalize newlines
    s = re.sub(r"[ \t\u00A0]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)

    # 10) restore answer blocks, prefixed with a label to make them stand out
    def _restore_answer(m):
        idx = int(m.group(1))
        txt = answer_blocks[idx] if idx < len(answer_blocks) else ''
        return f"Answer: {txt}"
    s = re.sub(r"__ANSWER_BLOCK_(\d+)__", _restore_answer, s)

    result = s.strip()

    # expose the cleaned string
    # (use `result` to make it easier to insert helpers below)
    # Helper: normalize bracketed math and basic LaTeX sanitize checks
    return result


def _normalize_bracket_math(latex: str) -> str:
    """Normalize common non-standard display-math delimiters.

    This is intentionally conservative: we only replace bracketed blocks that
    appear to contain math (contain common math symbols) to avoid accidental
    rewrites.
    """
    if not latex:
        return latex
    try:
        # Patterns used to decide whether a bracketed block is math-like.
        # If the block contains obvious CJK characters or textual macros such as
        # 	extbf, \text, \section, we conservatively do NOT convert it to
        # display math.
        cjk_re = re.compile(r"[\u3040-\u30FF\u4E00-\u9FFF]")
        textual_macro_re = re.compile(r"\\(?:textbf|text|section|subsection|paragraph|emph|begin|end)\b")
        math_like_re = re.compile(r"(?:\\(?:frac|sqrt|left|right|cdot|times|pm|leq|geq|sin|cos|tan|log|exp|sum|prod|int|lim)|\^|_|=|\\\(|\\\)|\\\[|\\\]|\d)")

        def is_probably_math(s: str) -> bool:
            # Reject very long blocks (likely prose) to avoid accidental conversions.
            if not s or len(s) > 2000:
                return False
            # If it contains CJK characters, usually it's prose; however if there
            # are explicit math tokens or non-textual LaTeX controls we should
            # still allow conversion (e.g. \therefore with \text inside math).
            if cjk_re.search(s):
                # allow if clear math tokens present
                if has_math:
                    return True
                # otherwise treat as non-math
                return False
            has_textual = bool(textual_macro_re.search(s))
            has_math = bool(math_like_re.search(s))
            # If there's obvious math tokens, treat as math even if textual macros appear.
            if has_math:
                return True
            # If the block contains other LaTeX control sequences (e.g. \therefore,
            # \implies) that are not just the textual macros, consider it math.
            try:
                controls = re.findall(r"\\([A-Za-z@]+)", s)
                textual_names = {"text", "textbf", "section", "subsection", "paragraph", "emph", "begin", "end", "item"}
                for name in controls:
                    if name and name not in textual_names:
                        return True
            except Exception:
                pass
            # If there are textual macros but no math tokens, avoid converting.
            if has_textual and not has_math:
                return False
            return False

        def _repl(m):
            inner = m.group(1)
            if is_probably_math(inner):
                return "\\[" + inner + "\\]"
            # leave alone when not confident
            return "[" + inner + "]"

        out = re.sub(r"\[\s*([\s\S]*?)\s*\]", _repl, latex)
        return out
    except Exception:
        return latex


def _latex_sanitize_check(latex: str) -> bool:
    """Basic safety check for LaTeX content.

    Disallow obviously dangerous or server-affecting commands like \write18,
    \input, \include (which pull external files), and other low-level TeX
    primitives. This is not exhaustive; tune as needed.
    """
    if not latex or not isinstance(latex, str):
        return False
    bad_patterns = [
        r"\\write18",
        r"\\input\s*\{",
        r"\\include\s*\{",
        r"\\openout",
        r"\\catcode",
        r"\\newread",
        r"\\read\s*\{",
        r"\\immediate",
        r"\\includegraphics\b",
    ]
    for p in bad_patterns:
        if re.search(p, latex):
            return False
    return True


def _collapse_internal_newlines(latex: str) -> str:
    """Attempt to fix common line-break issues from LLM output that split tokens.

    - Remove newlines inside inline math ($...$, \(...\)) and display math (\\[...\\]).
    - Remove newlines immediately after a caret '^' or immediately before a caret
      so that constructs like "x^\n2" become "x^2".
    - Remove newlines between a backslash and letters so that commands split across
      lines ("\\n\ntextbf") are rejoined.

    These are heuristics to make LLM line-wrapped output more TeX-friendly.
    """
    if not latex or not isinstance(latex, str):
        return latex
    s = latex
    # Normalize CRLF
    s = s.replace('\r\n', '\n')

    # 1) Remove newlines inside $...$ and \(...\) and \[...\]
    def _strip_newlines_in_math(m):
        inner = m.group(1)
        # collapse internal newlines to spaces for readability, but avoid
        # introducing spurious spaces around ^/_ which are syntactic
        inner2 = re.sub(r"\n\s*", " ", inner)
        inner2 = re.sub(r"\s+", " ", inner2)
        return m.group(0)[0] + inner2 + m.group(0)[-1]

    try:
        # $...$
        s = re.sub(r"\$(.*?)\$", lambda m: '$' + m.group(1).replace('\n', ' ') + '$', s, flags=re.S)
        # \(...\)
        s = re.sub(r"\\\((.*?)\\\)", lambda m: '\\(' + m.group(1).replace('\n', ' ') + '\\)', s, flags=re.S)
        # \[...\]
        s = re.sub(r"\\\\\[(.*?)\\\\\]", lambda m: '\\\\[' + m.group(1).replace('\n', ' ') + '\\\\]', s, flags=re.S)
    except Exception:
        pass

    # 2) Remove newlines immediately after '^' or before '^'
    s = re.sub(r"\^\s*\n\s*", "^", s)
    s = re.sub(r"\n\s*\^", "^", s)

    # 3) Remove newlines between backslash and letters (\ \n text -> \text)
    s = re.sub(r"\\\s*\n\s*([a-zA-Z@]+)", r"\\\1", s)

    # 4) Collapse accidental ")\n^" -> ")^" (already handled by caret rules but safe)
    s = s.replace(')\n^', ')^')

    return s


def _unescape_latex(latex: str) -> str:
    """Heuristic unescape for LaTeX-like strings that were JSON-escaped

    Converts common escape sequences (\n, \r\n, \t) back to real newlines/tabs
    and collapses accidental doubled backslashes before letters (e.g. "\\\\bigskip"
    -> "\\bigskip"). This fixes cases where the client sent a string with
    literal escape sequences instead of raw newlines.
    """
    if not latex or not isinstance(latex, str):
        return latex
    s = latex
    # quick heuristics: if we see literal \n or \r\n sequences, convert them
    # NOTE: we deliberately DO NOT convert "\\t" -> real tab here because
    # sequences like "\textbf" can be misinterpreted as "\\t" + "extbf"
    # during JSON unescaping; converting to a real tab can destroy TeX control
    # sequences (producing a tab character followed by "extbf"). Instead,
    # we only normalize newlines and leave any literal '\\t' alone. Any
    # real TAB characters in the final string are converted to a single space
    # below to avoid TeX receiving actual tab control characters (which show
    # up as ^^I in logs).
    if '\\r\\n' in s or '\\n' in s:
        s = s.replace('\\r\\n', '\n')
        s = s.replace('\\n', '\n')
    # collapse doubled backslashes before letters into single backslash
    # e.g. "\\\\textbf" -> "\\textbf"  (this handles JSON-escaped
    # backslashes that became doubled during transmission)
    s = re.sub(r"\\\\([a-zA-Z@]+)", r"\\\1", s)
    # Replace any actual tab characters with a single space so TeX doesn't
    # receive raw tabs which are often rendered as ^^I in the log and can
    # break control sequences when adjacent to backslash sequences.
    if '\t' in s:
        s = s.replace('\t', ' ')
    return s


def _extract_latex_if_json(blob: str) -> str:
    """If the provided blob looks like JSON containing a `latex` field, extract it.

    This handles cases where the client accidentally serialized the entire request
    (including `return_url`) into the `latex` string.
    """
    if not blob or not isinstance(blob, str):
        return blob
    t = blob.strip()
    if not (t.startswith('{') or t.startswith('[') or ('"latex"' in t) or ('"return_url"' in t)):
        return blob
    try:
        j = json.loads(t)
        if isinstance(j, dict) and j.get('latex'):
            return j.get('latex')
    except Exception:
        # if direct load fails, try to extract first JSON object via regex
        try:
            m = re.search(r"(\{[\s\S]*?\})(?=\s*$)", t)
            if m:
                o = m.group(1)
                j = json.loads(o)
                if isinstance(j, dict) and j.get('latex'):
                    return j.get('latex')
        except Exception:
            pass
    return blob


@app.post("/api/upload")
def upload(file: UploadFile = File(...)):
    # PDF upload was disabled in favor of LaTeX/JSON ingestion.
    # Keep the endpoint to provide a clear error response for clients that still call it.
    raise HTTPException(status_code=410, detail="PDF アップロードは無効です。LaTeX/JSON のみ受け付けます。`/api/upload_json` を使用してください。")


@app.post('/api/upload_json')
def upload_json(payload: IngestJSON = Body(...)):
    """Ingest a JSON doc containing LaTeX or plain text.

    Expects either `latex` or `plain_text` in the body. Converts LaTeX to plain text
    (using pandoc if available) and then runs the same chunk/index pipeline used for PDFs.
    """
    # Defensive wrapper: catch and surface any unexpected errors so the client
    # (and dev logs) show the real cause of failures such as pattern/validation
    # errors that were previously opaque.
    try:
        text = None
        if payload.plain_text:
            text = payload.plain_text
        elif payload.latex:
            try:
                text = latex_to_plain(payload.latex)
            except Exception as e:
                logger.exception('latex_to_plain failed')
                # surface as 400 to the client but include exception text
                raise HTTPException(status_code=400, detail=f'LaTeX 変換に失敗しました: {e}')
        else:
            raise HTTPException(status_code=400, detail='latex または plain_text を指定してください')
    except HTTPException:
        # re-raise FastAPI HTTPExceptions unchanged
        raise
    except Exception as e:
        # log contextual info to help debugging
        try:
            sample = (payload.latex or payload.plain_text or '')[:200]
        except Exception:
            sample = '<unavailable>'
        logger.exception('upload_json unexpected error; sample payload start=%s', sample)
        raise _dev_error_response('upload processing failed', e, status_code=500)

    # If conversion produced no text, be permissive: if the client provided a
    # `latex` field, fall back to using the original latex payload as plain
    # text instead of rejecting the upload. This avoids rejections when the
    # LaTeX-to-plain heuristic strips content (common for short/partial inputs).
    if not text:
        if payload.latex:
            text = payload.latex
        else:
            raise HTTPException(status_code=400, detail='変換結果が空です')

    # simple size guard: text length
    if len(text.encode('utf-8')) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail='テキストが大きすぎます')

    # chunk and index
    # If the provided text is actually a JSON blob (single object or list of objects)
    # chunk and index
    # If the provided text is actually a JSON blob (single object or list of objects)
    
        t = s.strip()
        # drop surrounding code fences ``` ```
        if t.startswith('```') and t.endswith('```'):
            lines = t.splitlines()
            if len(lines) >= 3:
                t = '\n'.join(lines[1:-1]).strip()

        # if wrapped in a quoted JSON string, try unquoting first
        if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
            try:
                unq = json.loads(t)
                # if unq is string containing JSON, try parse again
                try:
                    return json.loads(unq)
                except Exception:
                    return unq if isinstance(unq, (dict, list)) else None
            except Exception:
                pass

        # direct parse attempt
        try:
            return json.loads(t)
        except Exception:
            pass

        # fallback: prefer extracting the JSON object that contains a 'problem'
        # or other expected keys. Search for keyword positions and expand to
        # nearest enclosing braces to parse a coherent object.
        keywords = ['"problem"', "'problem'", '"stem"', '"solution_outline"', '"stem_latex"', '"metadata"']
        for kw in keywords:
            ki = t.find(kw)
            if ki != -1:
                # find opening brace before keyword
                start = t.rfind('{', 0, ki)
                if start == -1:
                    start = t.rfind('[', 0, ki)
                if start == -1:
                    continue
                # find matching closing brace
                opening = t[start]
                closing = '}' if opening == '{' else ']'
                depth = 0
                in_math = False
                i = start
                while i < len(t):
                    ch = t[i]
                    if ch == '$':
                        in_math = not in_math
                        i += 1; continue
                    if in_math:
                        i += 1; continue
                    if ch == '\\' and i + 1 < len(t):
                        i += 2; continue
                    if ch == opening:
                        depth += 1
                    elif ch == closing:
                        depth -= 1
                        if depth == 0:
                            snippet = t[start:i+1]
                            try:
                                parsed = json.loads(snippet)
                                # ensure parsed contains something useful
                                if isinstance(parsed, dict):
                                    # accept parsed JSON if it looks like a problem object
                                    if 'problem' in parsed or 'stem' in parsed or 'solution_outline' in parsed or 'stem_latex' in parsed:
                                        return parsed
                                # otherwise keep looking
                            except Exception:
                                pass
                            break
                    i += 1

        # last resort: attempt to parse any brace-delimited substring starting at any brace
        for idx in range(len(t)):
            if t[idx] in '{[':
                opening = t[idx]
                closing = '}' if opening == '{' else ']'
                depth = 0
                in_math = False
                i = idx
                while i < len(t):
                    ch = t[i]
                    if ch == '$':
                        in_math = not in_math
                        i += 1; continue
                    if in_math:
                        i += 1; continue
                    if ch == '\\' and i + 1 < len(t):
                        i += 2; continue
                    if ch == opening:
                        depth += 1
                    elif ch == closing:
                        depth -= 1
                        if depth == 0:
                            snippet = t[idx:i+1]
                            try:
                                parsed = json.loads(snippet)
                                return parsed
                            except Exception:
                                pass
                            break
                    i += 1
        return None

    raw_chunks = None
    parsed_json = _try_parse_json_blob(text)

    if parsed_json is not None:
        raw_chunks = []
        if isinstance(parsed_json, dict):
            if isinstance(parsed_json.get('problem'), dict):
                p = parsed_json.get('problem')
                prob = p.get('stem') or p.get('text') or parsed_json.get('stem') or parsed_json.get('text') or text
                sol = p.get('solution_outline') or ''
                md = dict(p.get('metadata') or {}) if isinstance(p.get('metadata'), dict) else {}
                # preserve legacy fields inside metadata so nothing is lost (prefer nested but fall back to top-level)
                if p.get('explanation') is not None:
                    md.setdefault('explanation', p.get('explanation'))
                elif parsed_json.get('explanation') is not None:
                    md.setdefault('explanation', parsed_json.get('explanation'))
                if p.get('answer_brief') is not None:
                    md.setdefault('answer_brief', p.get('answer_brief'))
                elif parsed_json.get('answer_brief') is not None:
                    md.setdefault('answer_brief', parsed_json.get('answer_brief'))
                # pull references/confidence into metadata if provided (prefer nested then top-level)
                if p.get('references') is not None:
                    md.setdefault('references', p.get('references'))
                elif parsed_json.get('references') is not None:
                    md.setdefault('references', parsed_json.get('references'))
                if p.get('confidence') is not None:
                    md.setdefault('confidence', p.get('confidence'))
                elif parsed_json.get('confidence') is not None:
                    md.setdefault('confidence', parsed_json.get('confidence'))

                # also expose explanation/answer_brief/confidence/references as top-level keys
                # so downstream insert_problem() can use them directly. Prefer explicit fields,
                # otherwise fall back to metadata values if provided there.
                explanation_val = p.get('explanation') if p.get('explanation') is not None else parsed_json.get('explanation')
                answer_brief_val = p.get('answer_brief') if p.get('answer_brief') is not None else parsed_json.get('answer_brief')
                references_val = p.get('references') if p.get('references') is not None else parsed_json.get('references')
                confidence_val = p.get('confidence') if p.get('confidence') is not None else parsed_json.get('confidence')
                # if still missing, try metadata
                if (not explanation_val) and isinstance(md.get('explanation'), (str,)):
                    explanation_val = md.get('explanation')
                if (not answer_brief_val) and isinstance(md.get('answer_brief'), (str,)):
                    answer_brief_val = md.get('answer_brief')
                if references_val is None and md.get('references') is not None:
                    references_val = md.get('references')
                if confidence_val is None and md.get('confidence') is not None:
                    confidence_val = md.get('confidence')
                # expected_mistakes: prefer explicit p, then top-level parsed_json, then metadata
                expected_mistakes_val = p.get('expected_mistakes') if p.get('expected_mistakes') is not None else parsed_json.get('expected_mistakes')
                if expected_mistakes_val is None and md.get('expected_mistakes') is not None:
                    expected_mistakes_val = md.get('expected_mistakes')

                # gather optional fields preserved for DB; prefer nested `problem` values
                raw_chunks.append({
                    'stem': prob,
                    'normalized_text': p.get('normalized_text') or parsed_json.get('normalized_text'),
                    'solution_outline': sol,
                    'metadata': md,
                    'stem_latex': p.get('stem_latex') or parsed_json.get('stem_latex'),
                    'difficulty': p.get('difficulty') if p.get('difficulty') is not None else parsed_json.get('difficulty'),
                    'difficulty_level': p.get('difficulty_level') if p.get('difficulty_level') is not None else parsed_json.get('difficulty_level'),
                    'trickiness': p.get('trickiness') if p.get('trickiness') is not None else parsed_json.get('trickiness'),
                    'explanation': explanation_val,
                    'answer_brief': answer_brief_val,
                    'references': references_val,
                    'confidence': confidence_val,
                    'expected_mistakes': expected_mistakes_val,
                    'source': payload.source or p.get('source') or parsed_json.get('source') or 'json',
                    # preserve original uploaded text and raw JSON for auditing and schema validation downstream
                    'raw_text': text,
                    'raw_json': json.dumps(parsed_json, ensure_ascii=False),
                })
            elif 'stem' in parsed_json:
                md = dict(parsed_json.get('metadata') or {}) if isinstance(parsed_json.get('metadata'), dict) else {}
                # prefer explicit fields, but fall back to metadata values
                expl = parsed_json.get('explanation') if parsed_json.get('explanation') is not None else md.get('explanation')
                abr = parsed_json.get('answer_brief') if parsed_json.get('answer_brief') is not None else md.get('answer_brief')
                refs = parsed_json.get('references') if parsed_json.get('references') is not None else md.get('references')
                conf = parsed_json.get('confidence') if parsed_json.get('confidence') is not None else md.get('confidence')
                expected_mistakes_val = parsed_json.get('expected_mistakes') if parsed_json.get('expected_mistakes') is not None else md.get('expected_mistakes')
                raw_chunks.append({
                    'stem': parsed_json.get('stem'),
                    'normalized_text': parsed_json.get('normalized_text'),
                    'solution_outline': parsed_json.get('solution_outline', ''),
                    'metadata': md,
                    'stem_latex': parsed_json.get('stem_latex'),
                    'difficulty': parsed_json.get('difficulty'),
                    'difficulty_level': parsed_json.get('difficulty_level'),
                    'trickiness': parsed_json.get('trickiness'),
                    'explanation': expl,
                    'answer_brief': abr,
                    'references': refs,
                    'confidence': conf,
                    'expected_mistakes': expected_mistakes_val,
                    'source': payload.source or parsed_json.get('source') or 'json',
                    'raw_text': text,
                    'raw_json': json.dumps(parsed_json, ensure_ascii=False),
                })
            else:
                # unknown structure: keep whole text as single chunk
                raw_chunks.append({'stem': text, 'solution_outline': ''})
        elif isinstance(parsed_json, list):
            for item in parsed_json:
                if isinstance(item, dict):
                    md = dict(item.get('metadata') or {}) if isinstance(item.get('metadata'), dict) else {}
                    # preserve legacy fields in metadata (prefer item values)
                    if item.get('explanation') is not None:
                        md.setdefault('explanation', item.get('explanation'))
                    if item.get('answer_brief') is not None:
                        md.setdefault('answer_brief', item.get('answer_brief'))
                    if item.get('references') is not None:
                        md.setdefault('references', item.get('references'))
                    if item.get('confidence') is not None:
                        md.setdefault('confidence', item.get('confidence'))
                    if item.get('expected_mistakes') is not None:
                        md.setdefault('expected_mistakes', item.get('expected_mistakes'))

                    explanation_val = item.get('explanation') if item.get('explanation') is not None else md.get('explanation')
                    answer_brief_val = item.get('answer_brief') if item.get('answer_brief') is not None else md.get('answer_brief')
                    references_val = item.get('references') if item.get('references') is not None else md.get('references')
                    confidence_val = item.get('confidence') if item.get('confidence') is not None else md.get('confidence')
                    expected_mistakes_val = item.get('expected_mistakes') if item.get('expected_mistakes') is not None else md.get('expected_mistakes')

                    raw_chunks.append({
                        'stem': item.get('stem') or item.get('text') or json.dumps(item, ensure_ascii=False),
                        'normalized_text': item.get('normalized_text'),
                        'solution_outline': item.get('solution_outline', ''),
                        'metadata': md,
                        'stem_latex': item.get('stem_latex'),
                        'difficulty': item.get('difficulty'),
                        'difficulty_level': item.get('difficulty_level'),
                        'trickiness': item.get('trickiness'),
                        'explanation': explanation_val,
                        'answer_brief': answer_brief_val,
                        'references': references_val,
                        'confidence': confidence_val,
                        'expected_mistakes': expected_mistakes_val,
                        'source': payload.source or item.get('source') or 'json',
                        'raw_text': text,
                        'raw_json': json.dumps(item, ensure_ascii=False),
                    })
                else:
                    raw_chunks.append({'stem': str(item), 'solution_outline': ''})

    if raw_chunks is None:
        raw_chunks = rag.chunk_text(text)

    # raw_chunks is a list of dicts {'stem', 'solution_outline'} (or for backward compatibility may be strings)
    texts_for_index = []
    normalized_chunks = []
    for c in raw_chunks:
        if isinstance(c, dict):
            texts_for_index.append(c.get('stem', ''))
            normalized_chunks.append(c)
        else:
            texts_for_index.append(c)
            normalized_chunks.append({'stem': c, 'solution_outline': ''})

    # Auto-extract explanation/answer_brief from chunk text when missing so
    # frontend pastes (plain text or LaTeX) automatically populate these fields.
    for ch in normalized_chunks:
        try:
            # prefer explicit fields if already present
            if not ch.get('explanation') or not str(ch.get('explanation')).strip():
                # look for LaTeX answer blocks
                pt = ch.get('stem') or ''
                m = re.search(r"\\begin\{answer\}([\s\S]*?)\\end\{answer\}", pt, flags=re.I)
                if m:
                    ch['answer_brief'] = ch.get('answer_brief') or m.group(1).strip()
                    ch['explanation'] = ch.get('explanation') or m.group(1).strip()
                else:
                    # look for lines starting with 解答/解説 and take following paragraph
                    lines = pt.splitlines()
                    for i, ln in enumerate(lines):
                        s = ln.strip()
                        if s.startswith('解答') or s.startswith('解説'):
                            # collect next up-to-5 lines as explanation
                            snippet = '\n'.join([l for l in lines[i:i+6] if l.strip()])
                            ch['explanation'] = ch.get('explanation') or snippet
                            if not ch.get('answer_brief'):
                                ch['answer_brief'] = snippet if len(snippet) < 1000 else snippet[:1000]
                            break
                    # fallback: if metadata.expected_mistakes exists, join them
                    md = ch.get('metadata') or {}
                    if (not ch.get('explanation') or not str(ch.get('explanation')).strip()) and md.get('expected_mistakes'):
                        try:
                            if isinstance(md.get('expected_mistakes'), (list, tuple)):
                                ch['explanation'] = '\n'.join([str(x).strip() for x in md.get('expected_mistakes') if x])
                            else:
                                ch['explanation'] = str(md.get('expected_mistakes'))
                        except Exception:
                            pass
        except Exception:
            # best-effort: do not fail ingest on extraction errors
            pass

    vectorizer, mat = rag.build_index(texts_for_index)

    doc_id = str(uuid.uuid4())
    STORE[doc_id] = {
        'chunks': normalized_chunks,
        'vectorizer': vectorizer,
        'mat': mat,
        'text': text,
        'latex': payload.latex,
        'metadata': payload.metadata or {},
        'source': payload.source or 'json',
    }

    return {'doc_id': doc_id, 'chunks': len(normalized_chunks)}


@app.post('/api/assemble_prompt')
def assemble_prompt(payload: AssemblePromptRequest = Body(...)):
    """Retrieve top chunks via retriever and assemble a prompt that includes them.

    Returns JSON: {prompt: str, retrieved: List[dict]}
    """
    q = payload.question
    top_k = int(payload.top_k or 5)

    conn = None
    try:
        conn = connect_db()
    except Exception as e:
        return _dev_error_response('DB connection failed', e)

    model = None
    if payload.use_vector:
        try:
            model, _ = load_model()
        except Exception:
            # proceed without model (retriever will fallback to tfidf)
            model = None

    try:
        if retrieve_with_profile is None:
            logger.warning('retrieve_with_profile not available; using simple DB fallback for retrieval')
            # simple fallback: return most recent problems with minimal scoring
            cur = conn.cursor()
            if getattr(conn, '_is_sqlite', False):
                cur.execute("SELECT id, difficulty, trickiness, stem FROM problems ORDER BY id DESC LIMIT %s", (top_k,))
            else:
                cur.execute("SELECT id, difficulty, trickiness, stem FROM problems ORDER BY id DESC LIMIT %s", (top_k,))
            rows = cur.fetchall()
            cur.close()
            retrieved = []
            for r in rows:
                retrieved.append({'id': r[0], 'text_score': 0.0, 'difficulty': r[1], 'trickiness': r[2], 'final_score': 0.0, 'text': (r[3] or '')[:500]})
        else:
            retrieved = retrieve_with_profile(
                conn,
                q,
                top_k=top_k,
                target_difficulty=payload.target_difficulty,
                target_trickiness=payload.target_trickiness,
                alpha_text=(payload.text_weight if payload.text_weight is not None else 0.5),
                beta_difficulty=(payload.difficulty_match_weight if payload.difficulty_match_weight is not None else 0.5),
                gamma_trickiness=(payload.trickiness_weight if payload.trickiness_weight is not None else 0.5),
                use_vector=bool(payload.use_vector),
                model=model,
                tfidf_force_refresh=False,
            )
    except Exception as e:
        # Provide a clearer message for common DB schema issues
        msg = str(e or '')
        if 'no such table' in msg.lower() or 'relation "problems"' in msg.lower() or 'does not exist' in msg.lower():
            hint_lines = [
                'DB エラー: 必要なテーブルが見つかりません。マイグレーションを実行してください。',
                '',
                '例（Alembic / Postgres）:',
                '  alembic upgrade head',
                '  # 開発環境で alembic.ini を指定する場合: alembic -c alembic.ini upgrade head',
                '',
                '例（SQLite で手動適用）:',
                '  # 単一のファイルに適用: sqlite3 data/db/dev.db < data/db/migrations/001_init.sql',
                '  # すべてのマイグレーション SQL を連結して適用: cat data/db/migrations/*.sql | sqlite3 data/db/dev.db',
                '',
                '注意: `DATABASE_URL` 環境変数が正しく設定され、マイグレーション先の DB に接続できることを確認してください。'
            ]
            hint = '\n'.join(hint_lines)
            try:
                conn.close()
            except Exception:
                pass
            return JSONResponse({'error': 'retrieval failed', 'detail': hint}, status_code=500)
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return _dev_error_response('retrieval failed', e)

    # sanitize retrieved items: remove or mask any raw numeric vectors/embeddings
    def _sanitize_items(items):
        out = []
        for it in (items or []):
            if not isinstance(it, dict):
                out.append(it)
                continue
            nr = {}
            for k, v in it.items():
                # drop any large numeric lists/tuples (likely embeddings)
                if isinstance(v, (list, tuple)):
                    # check if elements are numeric
                    is_num = True
                    sample = v[:10]
                    for x in sample:
                        if not isinstance(x, (int, float)):
                            is_num = False
                            break
                    if is_num:
                        nr[k] = f"<removed vector len={len(v)}>"
                        continue
                # collapse nested dict metadata to a concise summary
                if isinstance(v, dict):
                    # keep only a few human-friendly keys if present
                    allowed = ['source', 'doc_id', 'author', 'title', 'difficulty', 'trickiness']
                    small = {}
                    for ak in allowed:
                        if ak in v:
                            small[ak] = v.get(ak)
                    # if small is empty, summarize by counting numeric entries to avoid dumping arrays
                    if small:
                        nr[k] = small
                    else:
                        # count numeric fields and provide an opaque redaction marker
                        num_fields = 0
                        total_fields = 0
                        for vv in v.values():
                            total_fields += 1
                            if isinstance(vv, (int, float)):
                                num_fields += 1
                        if total_fields == 0:
                            nr[k] = '<empty metadata>'
                        else:
                            nr[k] = f'<redacted metadata fields={total_fields} numeric={num_fields}>'
                    continue
                nr[k] = v
            # also explicitly remove common keys that may contain vectors
            for bad in ('embedding', 'vector', 'vec', 'embedding_vector'):
                if bad in nr:
                    nr[bad] = f"<removed vector>"
            out.append(nr)
        return out

    sanitized_retrieved = _sanitize_items(retrieved)
    # Limit the number of returned/embedded chunks to the requested top_k so
    # callers see at most that many reference chunks. Without this trim, some
    # retrievers may return a larger candidate set (e.g. top_k*3) which then
    # makes the assembled prompt list all candidates and appear as "all chunks"
    # being referenced. Trim here to keep returned payload and prompts concise.
    try:
        top_k = int(payload.top_k or 5)
    except Exception:
        top_k = 5
    if isinstance(sanitized_retrieved, list) and len(sanitized_retrieved) > top_k:
        sanitized_retrieved = sanitized_retrieved[:top_k]

    # build a human-friendly LLM prompt with clearly formatted reference chunks
    header = (
        "以下は参照用の教材チャンク（上位候補）です。これらを参照して、質問に対して簡潔かつ教育的な回答を作成してください。\n"
        "各チャンクは ID・スコア・難易度・引っ掛け度・スニペットを含みます。不要な情報は省略してください。\n\n"
    )

    chunk_lines = [header]
    for i, r in enumerate(sanitized_retrieved, start=1):
        cid = r.get('id')
        score = r.get('final_score') if r.get('final_score') is not None else r.get('text_score')
        diff = r.get('difficulty')
        trick = r.get('trickiness')
        snippet = (r.get('text') or '').strip().replace('\r', '')
        # limit snippet length to keep prompt concise
        if len(snippet) > 400:
            snippet = snippet[:400].rsplit('\n', 1)[0] + '...'

        chunk_lines.append(f"[{i}] ID={cid}  スコア={score:.3f}  難易度={diff}  引っ掛け度={trick}")
        chunk_lines.append("スニペット:")
        chunk_lines.append('"""')
        chunk_lines.append(snippet)
        chunk_lines.append('"""')
        chunk_lines.append("---")

    # final assembly: include the original question and a slot for the answer
    chunk_lines.append("\n質問:")
    chunk_lines.append(q)
    chunk_lines.append("\n回答（教育的で簡潔に、必要なら参照チャンクを引用してください）:")
    # guidance to avoid ambiguity when multiple candidate problems are present
    chunk_lines.append("注意: 参照チャンクが複数ある場合は、最も関連性の高い1つを選んで解き、その選択を JSON の selected_reference に index と要約で含めてください。選べない場合は [1] を選んで解いてください。")

    prompt = "\n".join(chunk_lines)
    
    # helper: create a short one-line summary from a snippet
    def summarize_snippet(s: str, max_len: int = 200) -> str:
        if not s:
            return ''
        # collapse whitespace
        one = ' '.join(s.split())
        # try to split into sentences (prefer Japanese/English punctuation)
        for sep in ['。', '．', '.', '！', '!', '？', '?', '\n']:
            if sep in one:
                parts = one.split(sep)
                first = parts[0].strip()
                if first:
                    summary = first
                    break
        else:
            summary = one
        # truncate to max_len preserving words
        if len(summary) > max_len:
            # try to cut at nearest space before max_len
            cut = summary[:max_len]
            if ' ' in cut:
                cut = cut.rsplit(' ', 1)[0]
            summary = cut + '...'
        return summary

    # replace snippet blocks with one-line summaries for LLM clarity
    # regenerate prompt_lines using summaries to keep both human and LLM friendly
    summarized_lines = [header]
    for i, r in enumerate(sanitized_retrieved, start=1):
        cid = r.get('id')
        score = r.get('final_score') if r.get('final_score') is not None else r.get('text_score')
        diff = r.get('difficulty')
        trick = r.get('trickiness')
        snippet = (r.get('text') or '').strip().replace('\r', '')
        summary = summarize_snippet(snippet, max_len=180)
        summarized_lines.append(f"[{i}] ID={cid}  スコア={score:.3f}  難易度={diff}  引っ掛け度={trick}  要約: {summary}")

    # keep both full prompt and summarized prompt in response
    prompt_summarized = "\n".join(summarized_lines + ["\n質問:", q, "\n回答（教育的で簡潔に、必要なら参照チャンクを引用してください）:"])

    response = {'prompt': prompt, 'prompt_summarized': prompt_summarized, 'retrieved': sanitized_retrieved}

    # Synthesize numeric variants if <NUM> appears (helps LLM when numbers are masked)
    def _contains_mask(s):
        try:
            return '<NUM>' in (s or '')
        except Exception:
            return False

    synth_vals = None
    variant_used = None
    # check prompt and retrieved snippets for masks
    if _contains_mask(prompt) or any(_contains_mask(r.get('text')) for r in sanitized_retrieved):
        # default simple candidate set; can be made configurable later
        synth_vals = [1, 2, 3]
        variant_used = synth_vals[0]
        # create a prompt variant where all <NUM> are replaced with the chosen representative value
        try:
            prompt_variant = prompt.replace('<NUM>', str(variant_used))
            prompt_summarized_variant = prompt_summarized.replace('<NUM>', str(variant_used))
            # expose these to the response so the frontend can inform the user
            response['synth_variants'] = synth_vals
            response['variant_used'] = variant_used
            response['variant_prompt'] = prompt_variant
            response['variant_prompt_summarized'] = prompt_summarized_variant
        except Exception:
            pass

    # If this assemble request is for tuning, produce a strict JSON-oriented prompt
    # that instructs the LLM to output a single JSON object including required fields
    # such as `final_answer` and `checks`. The client can pass `tuning_profile` to
    # influence the expected format (e.g., 'json_only').
    try:
        if payload.tuning_mode or (payload.tuning_profile is not None):
            prof = payload.tuning_profile or 'json_only'
            # include inline references if requested; prefer the summarized version for brevity
            ctx_lines = []
            if payload.tuning_include_refs:
                ctx_lines.append('参照チャンク（要約）:')
                for i, r in enumerate(sanitized_retrieved, start=1):
                    summary = (r.get('text') or '').strip().replace('\n', ' ')[:200]
                    ctx_lines.append(f'[{i}] ID={r.get("id")}  要約: {summary}')
            if 'variant_prompt' in response and response.get('variant_prompt'):
                ctx_lines.append('\n例（数値変換済みプロンプト）:\n')
                ctx_lines.append(response.get('variant_prompt_summarized') or response.get('variant_prompt'))
            context_text = '\n'.join(ctx_lines) if ctx_lines else None
            req_id = str(uuid.uuid4())
            strict = make_strict_prompt_with_context(q, request_id=req_id, context_text=context_text, profile=prof)
            response['strict_prompt'] = strict
            response['request_id'] = req_id
            response['tuning_profile'] = prof
            # backward-compat: frontend expects 'prompt_tuning' keys
            response['prompt_tuning'] = strict
            response['prompt_tuning_summarized'] = (response.get('variant_prompt_summarized') or response.get('prompt_summarized') or '')
    except Exception:
        # non-fatal: if strict prompt generation fails, keep returning the normal response
        pass

    return response


@app.post('/api/generate_similar')
def generate_similar(question: str = Body(...), top_k: int = 5, num: int = 10, use_vector: bool = True, auto_insert: bool = False, model_name: Optional[str] = None, min_difficulty: Optional[float] = None, max_difficulty: Optional[float] = None, generation_style: Optional[str] = None, prohibited_tags: Optional[list] = None, include_explanations: Optional[bool] = False):
    """Generate similar questions/concepts based on a prompt question.

    - question: The input question or prompt to base similarities on.
    - top_k: Number of top similar items to retrieve.
    - num: Number of variations to generate.
    - use_vector: Whether to use vector similarity search.
    - auto_insert: If true, automatically insert the generated items as new problems.
    - model_name: Optional specific model to use for generation.
    - min_difficulty, max_difficulty: Optional difficulty range filters for the generated items.
    - generation_style: Optional style or profile for generation (e.g., 'json_only').
    - prohibited_tags: Optional list of tags to exclude from the generated items.
    - include_explanations: Whether to include explanations in the generated output.
    """
    # Defensive check: ensure question is not empty
    if not question or question.strip() == "":
        raise HTTPException(status_code=400, detail="質問が空です")

    # Fallback to default model if not specified
    if model_name is None:
        model_name = "llama2"

    # Basic logging of the request
    logger.info("generate_similar request: question='%s', top_k=%d, num=%d, use_vector=%s, model_name='%s'", question, top_k, num, use_vector, model_name)

    conn = None
    try:
        conn = connect_db()
    except Exception as e:
        return _dev_error_response('DB connection failed', e)

    # Step 1: Retrieve top K similar items/concepts using the retriever
    try:
        if retrieve_with_profile is None:
            logger.warning('retrieve_with_profile not available; using simple DB fallback for retrieval')
            # simple fallback: return most recent problems with minimal scoring
            cur = conn.cursor()
            if getattr(conn, '_is_sqlite', False):
                cur.execute("SELECT id, difficulty, trickiness, stem FROM problems ORDER BY id DESC LIMIT %s", (top_k,))
            else:
                cur.execute("SELECT id, difficulty, trickiness, stem FROM problems ORDER BY id DESC LIMIT %s", (top_k,))
            rows = cur.fetchall()
            cur.close()
            retrieved = []
            for r in rows:
                retrieved.append({'id': r[0], 'text_score': 0.0, 'difficulty': r[1], 'trickiness': r[2], 'final_score': 0.0, 'text': (r[3] or '')[:500]})
        else:
            retrieved = retrieve_with_profile(
                conn,
                question,
                top_k=top_k,
                target_difficulty=min_difficulty,
                target_trickiness=max_difficulty,
                alpha_text=0.5,
                beta_difficulty=0.5,
                gamma_trickiness=0.5,
                use_vector=use_vector,
                model=model_name,
                tfidf_force_refresh=False,
            )
    except Exception as e:
        return _dev_error_response('retrieval failed', e)

    # Step 2: Sanitize and prepare the retrieved items
    sanitized_retrieved = []
    for item in retrieved:
        if isinstance(item, dict):
            # Mask or redact any sensitive or large numeric data
            item = {k: (v if not isinstance(v, (list, tuple)) else f"<removed vector len={len(v)}>" ) for k, v in item.items()}
            sanitized_retrieved.append(item)
        else:
            sanitized_retrieved.append(item)

    # Step 3: Generate variations based on the retrieved items
    variations = []
    for item in sanitized_retrieved:
        if isinstance(item, dict):
            base_text = item.get('text') or item.get('stem') or ''
            if base_text:
                # Simple variation by rephrasing the base text
                variations.append({
                    'text': f"【類似】{base_text}",
                    'metadata': item.get('metadata'),
                })

    # Step 4: Auto-insert the generated items as new problems if requested
    if auto_insert and variations:
        for var in variations:
            try:
                insert_problem(var['text'], var.get('metadata'))
            except Exception as e:
                logger.exception("Error inserting auto-generated problem: %s", e)

    # Step 5: Build the final response
    response = {
        'question': question,
        'top_k': top_k,
        'num': num,
        'use_vector': use_vector,
        'model_name': model_name,
        'min_difficulty': min_difficulty,
        'max_difficulty': max_difficulty,
        'generation_style': generation_style,
        'prohibited_tags': prohibited_tags,
        'include_explanations': include_explanations,
        'retrieved': sanitized_retrieved,
        'variations': variations,
    }

    return JSONResponse(response)


@app.get('/api/generate')
def api_generate(seed: Optional[int] = None, num: int = 3):
    """Generate a quiz (via backend/generator) and return LaTeX + plain_text preview.

    Query params: seed (optional), num (number of questions)
    """
    try:
        from backend import generator
    except Exception:
        import generator as generator

    quiz = generator.generate_quiz(num_questions=num, seed=seed)
    latex = generator.quiz_to_latex(quiz)
    plain = latex_to_plain(latex)
    return JSONResponse({'latex': latex, 'plain_text': plain, 'meta': quiz.get('meta')})


@app.post('/api/generate_and_upload')
def api_generate_and_upload(seed: Optional[int] = None, num: int = 3):
    """Generate a quiz and ingest it immediately (returns doc_id)."""
    try:
        from backend import generator
    except Exception:
        import generator as generator

    quiz = generator.generate_quiz(num_questions=num, seed=seed)
    latex = generator.quiz_to_latex(quiz)
    text = latex_to_plain(latex)

    if not text:
        raise HTTPException(status_code=500, detail='生成した LaTeX の変換に失敗しました')

    raw_chunks = rag.chunk_text(text)
    texts_for_index = []
    normalized_chunks = []
    for c in raw_chunks:
        if isinstance(c, dict):
            texts_for_index.append(c.get('stem', ''))
            normalized_chunks.append(c)
        else:
            texts_for_index.append(c)
            normalized_chunks.append({'stem': c, 'solution_outline': ''})

    vectorizer, mat = rag.build_index(texts_for_index)

    doc_id = str(uuid.uuid4())
    STORE[doc_id] = {
        'chunks': normalized_chunks,
        'vectorizer': vectorizer,
        'mat': mat,
        'text': text,
        'latex': latex,
        'metadata': {'source': 'generator', 'seed': seed, 'num': num},
    }
    return JSONResponse({'doc_id': doc_id, 'chunks': len(normalized_chunks)})


class RenderTemplateRequest(BaseModel):
    template_id: str
    subject: Optional[str] = ''
    difficulty: Optional[str] = ''
    num_questions: Optional[int] = 1
    doc_id: Optional[str] = None
    rag_inject: Optional[bool] = False
    use_llm_summary: Optional[bool] = False
    difficulty_match_weight: Optional[float] = 0.6
    trickiness_weight: Optional[float] = 0.0
    top_k: Optional[int] = 5
    # User-provided numeric hints (optional). These will be included in the
    # render context so templates/LLMs can consider both user hints and DB-derived
    # estimates. Range: 0.0 .. 1.0
    user_difficulty: Optional[float] = None
    user_trickiness: Optional[float] = None
    # When true, the renderer should include strict LaTeX output instructions
    # suitable for end-user generation (full document from \documentclass ... \end{document}).
    # Development-mode renders should NOT set this flag.
    user_mode: Optional[bool] = False
    # Subject filter: when set, only retrieve problems whose metadata contains this subject
    subject_filter: Optional[str] = None
    # Field filter: when set, only retrieve problems whose metadata contains this field
    field_filter: Optional[str] = None


@app.post('/api/render_template')
def api_render_template(req: RenderTemplateRequest = Body(...)):
    """Render a server-side template and optionally inject RAG snippets and difficulty metrics.

    Supported placeholders in templates:
      {subject}, {difficulty}, {num_questions}, {doc_snippets}, {rag_summary}, {chunk_count}
    New placeholders added here:
      {difficulty_score} (0..1), {difficulty_level} (1..5), {trickiness} (0..1), {difficulty_details}
    """
    tpl = TEMPLATES.get(req.template_id)
    if not tpl:
        return JSONResponse({'error': 'template not found'}, status_code=404)
    prompt = tpl.get('prompt', '')

    # base context
    ctx = {
        'subject': req.subject or '',
        'difficulty': req.difficulty or '',
        'num_questions': int(req.num_questions or 1),
        'doc_snippets': '',
        'rag_summary': '',
        'chunk_count': 0,
        'difficulty_score': '',
        'difficulty_level': '',
        'trickiness': '',
        'difficulty_details': '',
        # reflect user-provided numeric hints in context
        'user_difficulty': req.user_difficulty if hasattr(req, 'user_difficulty') else None,
        'user_trickiness': req.user_trickiness if hasattr(req, 'user_trickiness') else None,
    }

    # If RAG injection requested, prepare snippets/summary and difficulty metrics.
    # Support three modes:
    #  - doc_id provided: load that doc (STORE or DB fallback)
    #  - doc_id not provided: fall back to sampling recent problems from DB to build a temporary index
    #  - if nothing found, leave RAG fields empty
    if req.rag_inject:
        texts = []
        vectorizer = None
        mat = None
        full = ''
        doc = None
        candidates = []

        if req.doc_id:
            # Prefer in-memory STORE, but if doc_id not present (server restart / different process)
            # try to load chunks from the DB so templates can reference persisted problems.
            doc = STORE.get(req.doc_id)
            if doc:
                chunks = doc.get('chunks', []) or []
                full = doc.get('text', '')
                for c in chunks:
                    pt = c.get('stem') if isinstance(c, dict) else str(c)
                    texts.append(pt)
                    md = c.get('metadata') if isinstance(c, dict) else {}
                    # attempt to read difficulty/trickiness from chunk metadata
                    diff = None
                    trick = None
                    try:
                        if isinstance(md, dict):
                            diff = md.get('difficulty')
                            trick = md.get('trickiness')
                    except Exception:
                        pass
                    candidates.append({'id': md.get('doc_id') if isinstance(md, dict) else None, 'text': pt, 'difficulty': diff, 'trickiness': trick, 'metadata': md})
                vectorizer = doc.get('vectorizer')
                mat = doc.get('mat')
            else:
                # If doc not in STORE, attempt to reindex into STORE from DB so that
                # subsequent endpoints can rely on an in-memory copy.
                try:
                    # call helper that builds STORE[doc_id]
                    _reindex_doc_from_db(req.doc_id)
                    doc = STORE.get(req.doc_id)
                    if doc:
                        chunks = doc.get('chunks', []) or []
                        full = doc.get('text', '')
                        texts = [c.get('stem', '') if isinstance(c, dict) else str(c) for c in chunks]
                        vectorizer = doc.get('vectorizer')
                        mat = doc.get('mat')
                    else:
                        # fallback: leave texts empty
                        texts = []
                except Exception:
                    # reindex failed; leave texts empty
                    texts = []
        else:
            # No doc_id provided: sample recent problems from DB to create a temporary index
            # Apply subject/field filter if provided to avoid mixing unrelated topics
            try:
                conn = connect_db()
                cur = conn.cursor()

                # Build optional WHERE clause for subject/field filtering via metadata JSON
                subject_f = req.subject_filter or req.subject or ''
                field_f = getattr(req, 'field_filter', None) or ''
                where_parts = []
                params_list = []

                if subject_f and getattr(conn, '_is_sqlite', False):
                    # SQLite: metadata is stored as JSON text, use LIKE
                    where_parts.append("metadata LIKE %s")
                    params_list.append(f'%"subject"%{subject_f}%')
                elif subject_f:
                    # PostgreSQL: metadata is JSONB
                    where_parts.append("metadata->>'subject' = %s")
                    params_list.append(subject_f)

                if field_f and getattr(conn, '_is_sqlite', False):
                    where_parts.append("metadata LIKE %s")
                    params_list.append(f'%"field"%{field_f}%')
                elif field_f:
                    where_parts.append("metadata->>'field' = %s")
                    params_list.append(field_f)

                where_sql = ('WHERE ' + ' AND '.join(where_parts)) if where_parts else ''

                if getattr(conn, '_is_sqlite', False):
                    sql = f"SELECT id, stem, solution_outline, difficulty, trickiness, metadata FROM problems {where_sql} ORDER BY id DESC LIMIT %s"
                else:
                    sql = f"SELECT id, stem, solution_outline, difficulty, trickiness, metadata FROM problems {where_sql} ORDER BY created_at DESC LIMIT %s"
                params_list.append(200)
                cur.execute(sql, tuple(params_list))
                rows = cur.fetchall()

                # If subject filter returned too few results, fall back to unfiltered
                if len(rows) < 3 and (subject_f or field_f):
                    logger.info('Subject/field filter returned only %d rows, falling back to unfiltered', len(rows))
                    if getattr(conn, '_is_sqlite', False):
                        cur.execute("SELECT id, stem, solution_outline, difficulty, trickiness, metadata FROM problems ORDER BY id DESC LIMIT %s", (200,))
                    else:
                        cur.execute("SELECT id, stem, solution_outline, difficulty, trickiness, metadata FROM problems ORDER BY created_at DESC LIMIT %s", (200,))
                    rows = cur.fetchall()

                cur.close(); conn.close()
                for r in rows:
                    # row format will be (id, stem, solution_outline, difficulty, trickiness, metadata)
                    try:
                        pid = r[0]
                        pt = r[1] or ''
                        so = r[2] or ''
                        pdiff = r[3]
                        ptrick = r[4]
                        pmeta = r[5] if len(r) > 5 else {}
                    except Exception:
                        pid = None
                        pt = r[0] or ''
                        so = r[1] or ''
                        pdiff = None
                        ptrick = None
                        pmeta = {}
                    texts.append(pt)
                    candidates.append({'id': pid, 'text': pt, 'difficulty': pdiff, 'trickiness': ptrick, 'metadata': pmeta})
                    full += pt + '\n\n' + so + '\n\n'
                try:
                    vectorizer, mat = rag.build_index(texts)
                except Exception:
                    vectorizer, mat = None, None
            except Exception:
                texts = []

        ctx['chunk_count'] = len(texts)

        # Query for retrieval: combine subject, difficulty and a short template preview
        q_preview = (req.subject or '') + ' ' + (req.difficulty or '') + ' ' + (prompt[:400] if prompt else '')
        try:
            # perform retrieval
            top_k = min(int(req.top_k or 5), max(1, len(texts)))
            if vectorizer is not None and mat is not None:
                results = rag.search(q_preview, vectorizer, mat, texts, top_k=top_k*3)
            else:
                tv, tm = rag.build_index(texts)
                results = rag.search(q_preview, tv, tm, texts, top_k=top_k*3)

                # re-rank by combining sim score with difficulty/trickiness preferences
                # map difficulty string to numeric target
                def difficulty_to_num(s):
                    if not s: return None
                    s = str(s).lower()
                    if s.startswith('e') or 'easy' in s: return 0.2
                    if s.startswith('h') or 'hard' in s: return 0.8
                    if s.startswith('m') or 'med' in s: return 0.5
                    try:
                        return float(s)
                    except Exception:
                        return None

                target = difficulty_to_num(req.difficulty)
                alpha = float(req.difficulty_match_weight or 0.6)
                beta = float(req.trickiness_weight or 0.0)

                scored = []
                for rr in results:
                    if not rr: continue
                    idx = int(rr.get('idx', 0))
                    sim = float(rr.get('score', 0.0))
                    cand = candidates[idx] if idx < len(candidates) else {'id': None, 'text': texts[idx] if idx < len(texts) else '', 'difficulty': None, 'trickiness': None, 'metadata': {}}
                    pd = cand.get('difficulty')
                    pt = cand.get('trickiness')
                    try:
                        pdn = float(pdn) if pd is not None else 0.5
                    except Exception:
                        pdn = 0.5
                    try:
                        ptn = float(ptn) if pt is not None else 0.0
                    except Exception:
                        ptn = 0.0

                    diff_match = 0.5
                    if target is not None:
                        diff_match = max(0.0, 1.0 - abs(pdn - target))

                    base = alpha * sim + (1.0 - alpha) * diff_match
                    combined = (1.0 - beta) * base + beta * ptn
                    scored.append({'idx': idx, 'sim': sim, 'combined': combined, 'candidate': cand})

                # sort by combined score
                scored_sorted = sorted(scored, key=lambda x: -x['combined'])
                top_selected = scored_sorted[:top_k]

                # prepare doc_snippets and items
                items = []
                seen_texts = set()
                for s in top_selected:
                    c = s['candidate']
                    text_snip = (c.get('text') or '')
                    if text_snip in seen_texts:
                        continue
                    seen_texts.add(text_snip)
                    items.append({'id': c.get('id'), 'sim_score': s['sim'], 'combined_score': s['combined'], 'difficulty': c.get('difficulty'), 'trickiness': c.get('trickiness'), 'text': text_snip})

                ctx['doc_snippets_items'] = items
                ctx['doc_snippets'] = '\n\n'.join([it['text'] for it in items])
        except Exception:
            # fallback: first few chunks
            ctx['doc_snippets_items'] = []
            ctx['doc_snippets'] = '\n\n'.join(texts[:3])

        # build a compact rag_summary by concatenating the retrieved snippets (up to 800 chars)
        summary = ''
        # create a deduplicated list of snippet texts from the selected items (or fallback to texts)
        dedup = []
        if ctx.get('doc_snippets_items'):
            for it in ctx['doc_snippets_items']:
                t = (it.get('text') or '').strip()
                if t and t not in dedup:
                    dedup.append(t)
        else:
            for t in texts:
                tt = (t or '').strip()
                if tt and tt not in dedup:
                    dedup.append(tt)

        for s in dedup:
            if not s:
                continue
            if len(summary) + len(s) + 2 > 800:
                if not summary:
                    summary = s[:800]
                break
            if summary:
                summary += '\n\n' + s
            else:
                summary = s
        ctx['rag_summary'] = summary[:800]

        # difficulty metrics: prefer metadata.difficulty_details if present, else compute
        md = {}
        try:
            if doc:
                md = doc.get('metadata') or {}
            else:
                # try to fetch metadata from DB row(s) if available
                conn2 = connect_db()
                cur2 = conn2.cursor()
                if getattr(conn2, '_is_sqlite', False):
                    pattern = '"doc_id": "' + req.doc_id + '"'
                    cur2.execute("SELECT metadata FROM problems WHERE metadata LIKE %s LIMIT 1", (f'%{pattern}%',))
                else:
                    cur2.execute("SELECT metadata FROM problems WHERE metadata->>'doc_id' = %s LIMIT 1", (req.doc_id,))
                mr = cur2.fetchone()
                try:
                    if mr:
                        md = mr[0] or {}
                except Exception:
                    md = {}
                cur2.close(); conn2.close()
        except Exception:
            md = {}

        details = None
        if isinstance(md, dict) and 'difficulty_details' in md:
            details = md['difficulty_details']
            try:
                if isinstance(details, str):
                    import json as _json
                    details = _json.loads(details)
            except Exception:
                pass
        if not details:
            try:
                d_score, d_level, trick, details = estimate_difficulty_verbose(full)
            except Exception:
                details = None
        if details:
            try:
                # try to pick sensible fields
                d_score = details.get('sigmoid_mapped') if isinstance(details, dict) else None
                if d_score is None and isinstance(details, dict):
                    d_score = details.get('raw')
                if d_score is None and isinstance(details, dict):
                    # older style
                    d_score = details.get('diff')
                trick = details.get('trick_raw') if isinstance(details, dict) else None
                d_level = None
                # map sigmoid to level if available
                if d_score is not None:
                    try:
                        # if it's string, convert
                        d_score = float(d_score)
                    except Exception:
                        pass
                # if estimate_difficulty_verbose provided level earlier, try to read
                if isinstance(details, dict) and 'features' in details and 'sigmoid_mapped' in details:
                    ds = details.get('sigmoid_mapped')
                    try:
                        dsf = float(ds)
                        if dsf < 0.18:
                            d_level = 1
                        elif dsf < 0.36:
                            d_level = 2
                        elif dsf < 0.55:
                            d_level = 3
                        elif dsf < 0.75:
                            d_level = 4
                        else:
                            d_level = 5
                    except Exception:
                        d_level = None

                if d_score is not None:
                    ctx['difficulty_score'] = float(d_score)
                    # provide a numeric alias named 'difficulty_numeric' and if the
                    # request didn't provide a textual difficulty, populate 'difficulty'
                    # with a short numeric string for backward compatibility with callers
                    ctx['difficulty_numeric'] = float(d_score)
                    if not ctx.get('difficulty'):
                        # keep as string to remain compatible with template placeholders
                        ctx['difficulty'] = f"{float(d_score):.2f}"
                if d_level is not None:
                    ctx['difficulty_level'] = int(d_level)
                if trick is not None:
                    try:
                        ctx['trickiness'] = float(trick)
                        ctx['trickiness_numeric'] = float(trick)
                    except Exception:
                        ctx['trickiness'] = str(trick)
                import json as _json
                ctx['difficulty_details'] = _json.dumps(details, ensure_ascii=False)
            except Exception:
                # best-effort; ignore
                pass

    # If user provided numeric hints, also include them in the context and
    # synthesize a short merged guidance text that templates/LLMs can follow.
    try:
        ud = None
        ut = None
        try:
            ud = float(req.user_difficulty) if getattr(req, 'user_difficulty', None) is not None else None
        except Exception:
            ud = None
        try:
            ut = float(req.user_trickiness) if getattr(req, 'user_trickiness', None) is not None else None
        except Exception:
            ut = None
        if ud is not None:
            ctx['user_difficulty'] = ud
        if ut is not None:
            ctx['user_trickiness'] = ut

        # Build a merged guidance block describing how to combine user hints and DB estimates.
        # This makes it explicit for the LLM: prefer the user's explicit setting, but
        # consider DB-derived examples as supplementary evidence.
        merged_text_lines = []
        merged_text_lines.append('ユーザー指定の難易度/ひっかけ度と DB 推定の両方を参照してください。')
        if ud is not None:
            merged_text_lines.append(f'- ユーザー指定難易度(user_difficulty): {ud}  (0.0=易 → 1.0=難)')
        if ctx.get('difficulty_numeric') is not None:
            merged_text_lines.append(f'- DB 推定難易度(db_difficulty_numeric): {ctx.get("difficulty_numeric")}')
        if ut is not None:
            merged_text_lines.append(f'- ユーザー指定ひっかけ度(user_trickiness): {ut}  (0.0=ひっかけなし → 1.0=非常にひっかけ)')
        if ctx.get('trickiness_numeric') is not None:
            merged_text_lines.append(f'- DB 推定ひっかけ度(db_trickiness_numeric): {ctx.get("trickiness_numeric")}')

        merged_text_lines.append('\nルール（参考）: ユーザー指定が存在する場合は優先する。ただし DB の事例が示す典型的な出題形式やよくある誤答パターンは参照して、問題文や選択肢に反映すること。')

        ctx['difficulty_merged_guidance'] = '\n'.join(merged_text_lines)
    except Exception:
        pass

    # If template doesn't include RAG placeholders but RAG injection was requested,
    # append short fallbacks so injected RAG content and difficulty metrics appear
    # in the prompt for users who don't edit templates to include placeholders.
    try:
        if req.rag_inject and isinstance(prompt, str):
            if ('{doc_snippets}' not in prompt and '{rag_summary}' not in prompt):
                prompt = prompt + '\n\n参考資料:\n{rag_summary}\n'

            # difficulty/trickiness: provide a human-readable metadata block when
            # the template doesn't already reference these placeholders.
            diff_placeholders = ('{difficulty_score}' in prompt or '{difficulty_numeric}' in prompt or '{difficulty_level}' in prompt)
            trick_placeholders = ('{trickiness}' in prompt or '{trickiness_numeric}' in prompt)
            if not (diff_placeholders or trick_placeholders):
                # Provide a clearer, structured metadata block so the LLM can
                # unambiguously interpret and apply difficulty/trickiness hints.
                # Include both user-provided hints (if any) and DB-derived estimates
                # and a short guidance on how to combine them.
                prompt = prompt + (
                    "\n\n---\n"
                    "参照メタ情報（LLM が誤解しないように整理）:\n"
                    "※ 以下は参考情報です。問題を生成する際は必ず参照し、指定された難易度とひっかけ度を反映してください。\n\n"
                    "- difficulty_numeric (DB 推定): {difficulty_numeric}  (範囲 0.0=非常に易 ～ 1.0=非常に難)\n"
                    "- difficulty_level (DB 目安 1-5): {difficulty_level}  \n"
                    "- trickiness (DB 推定): {trickiness_numeric}  (範囲 0.0=ひっかけなし ～ 1.0=非常にひっかけが強い)\n"
                    "- difficulty_details (JSON): {difficulty_details}\n\n"
                    "- user_difficulty (ユーザー指定, 任意): {user_difficulty}\n"
                    "- user_trickiness (ユーザー指定, 任意): {user_trickiness}\n\n"
                    "統合ガイダンス（参考）:\n"
                    "1) ユーザーが数値で指定した場合は原則それを優先してください（例: user_difficulty=0.8）。\n"
                    "2) DB 推定は典型的な出題傾向や誤答パターンの参照用に使用し、問題のスタイルや解説に反映してください。\n"
                    "3) 優先ルールを明示的に適用した JSON 例（機械判別用）:\n"
                    "{\"user_difficulty\": {user_difficulty}, \"db_difficulty\": {difficulty_numeric}, \"user_trickiness\": {user_trickiness}, \"db_trickiness\": {trickiness_numeric}, \"details\": {difficulty_details}}\n"
                    "---\n"
                )
    except Exception:
        pass

    # If this render is for user-mode (frontend end-users), ensure we add a
    # strict LaTeX output instruction so downstream LLMs emit a complete,
    # compilable LaTeX document. Do NOT add this for development-mode renders.
    try:
        if getattr(req, 'user_mode', False):
            # Avoid duplicating if template already contains an explicit \documentclass
            if isinstance(prompt, str) and ('\\documentclass' not in prompt):
                orig_prompt_body = prompt
                
                # Pre-define the skeleton with a clear placeholder
                latex_skeleton = (
                    "\\documentclass[a4paper,11pt]{article}\n"
                    "\\usepackage[margin=22mm]{geometry}\n"
                    "\\usepackage{amsmath,amssymb}\n"
                    "\\usepackage{enumitem}\n"
                    "\\usepackage{parskip}\n"
                    "\\usepackage{fontspec}\n"
                    "\\usepackage{xeCJK}\n"
                    "\\setmainfont{TeX Gyre Termes}\n"
                    "\\setCJKmainfont{IPAexMincho}\n"
                    "\\usepackage{hyperref}\n"
                    "\\begin{document}\n\n"
                    "% --- 問題と解答の生成開始 ---\n"
                    "{{generated_body}}\n"
                    "% --- 問題と解答の生成終了 ---\n\n"
                    "\\end{document}\n"
                )

                # Instruction for the LLM
                latex_instr = (
                    "【重要: 出力ルール（ユーザーモード専用）】\n"
                    "以下を全て守ること。\n\n"
                    "A) インライン数式は $...$ のみ。(...) や [...] で囲むな。\n"
                    "B) ディスプレイ数式は \\\\[ ... \\\\] のみ。裸の [ ... ] や $$ は禁止。\n"
                    "C) align* 等の行末は \\\\\\\\ のみ。\\\\\\\\[2mm] 等は禁止。\n"
                    "D) スケルトンのパッケージだけ使え。unicode-math, CJKutf8 等の追加禁止。\n"
                    "E) フォントは \\\\setCJKmainfont{IPAexMincho} 固定。IfFontExistsTF 禁止。\n"
                    "F) 出力は .tex ソースのみ。Markdown や説明文は含めるな。\n"
                )

                # Reassemble the prompt: Skeleton first (as a target), then Instructions
                prompt = f"以下のLaTeXスケルトンを完成させてください:\n\n{latex_skeleton}\n\n{latex_instr}\n\n【指示内容】\n{orig_prompt_body}"
    except Exception as e:
        if 'logger' in globals():
            logger.error(f"Error in user_mode prompt enhancement: {e}")

    # safe placeholder replacement: replace {key} with str(ctx[key])
    def _replace_placeholders(s: str, context: dict) -> str:
        def repl(m):
            k = m.group(1)
            return str(context.get(k, ''))
        return re.sub(r"\{([a-zA-Z0-9_]+)\}", repl, s)

    rendered = _replace_placeholders(prompt, ctx)
    return JSONResponse({'rendered': rendered, 'context': ctx})


@app.get('/api/templates')
def api_list_templates():
    """Return available templates. Reloads from disk to pick up edits without restart."""
    try:
        _load_templates()
    except Exception:
        pass
    out = []
    # TEMPLATES may not be defined in some runtime contexts; fall back to {}
    tpls = globals().get('TEMPLATES') or {}
    for k, v in tpls.items():
        item = {'id': k}
        if isinstance(v, dict):
            item['name'] = v.get('name') or v.get('title') or ''
            item['description'] = v.get('description') or ''
            item['metadata'] = v.get('metadata') or {}
            item['prompt'] = v.get('prompt') or ''
        out.append(item)
    return JSONResponse({'templates': out})


@app.post('/api/template_render')
def api_template_render(req: RenderTemplateRequest = Body(...)):
    """Compatibility wrapper for older frontends that call `/api/template_render`.

    Delegates to `api_render_template` after reloading templates from disk.
    """
    try:
        _load_templates()
    except Exception:
        pass
    return api_render_template(req)


class ReindexRequest(BaseModel):
    doc_id: str


def _reindex_doc_from_db(doc_id: str) -> dict:
    """Read problems rows by metadata.doc_id and build an in-memory STORE entry.

    Returns a dict describing the stored entry (chunks, count) or raises on DB error.
    """
    texts = []
    chunks = []
    full = ''
    conn = connect_db()
    try:
        cur = conn.cursor()
        if getattr(conn, '_is_sqlite', False):
            pattern = '"doc_id": "' + doc_id + '"'
            q = "SELECT stem, solution_outline, metadata FROM problems WHERE metadata LIKE %s ORDER BY id"
            cur.execute(q, (f'%{pattern}%',))
        else:
            cur.execute("SELECT stem, solution_outline, metadata FROM problems WHERE metadata->>'doc_id' = %s ORDER BY id", (doc_id,))
        rows = cur.fetchall()
        cur.close()
    finally:
        try:
            conn.close()
        except Exception:
            pass

    if not rows:
        return {'doc_id': doc_id, 'chunks': 0}

    for r in rows:
        pt = r[0] or ''
        so = r[1] or ''
        md = {}
        try:
            md = r[2] or {}
        except Exception:
            md = {}
        texts.append(pt)
        chunks.append({'stem': pt, 'solution_outline': so, 'metadata': dict(md) if isinstance(md, dict) else {}})
        full += pt + '\n\n' + so + '\n\n'

    try:
        vectorizer, mat = rag.build_index(texts)
    except Exception:
        vectorizer, mat = None, None

    STORE[doc_id] = {
        'chunks': chunks,
        'vectorizer': vectorizer,
        'mat': mat,
        'text': full,
        'latex': None,
        'metadata': {'doc_id': doc_id, 'source': 'db'},
        'source': 'db',
    }
    return {'doc_id': doc_id, 'chunks': len(chunks)}


@app.post('/api/reindex_doc')
def api_reindex_doc(req: ReindexRequest = Body(...)):
    """Rebuild an in-memory index for a given doc_id by loading problems from the DB.

    This is useful when the server lost its in-memory STORE (restart) but problems exist in DB.
    """
    if not req.doc_id:
        return JSONResponse({'error': 'missing doc_id'}, status_code=400)
    try:
        res = _reindex_doc_from_db(req.doc_id)
        return JSONResponse({'status': 'ok', 'result': res})
    except Exception as e:
        logger.exception('reindex_doc failed for %s', req.doc_id)
        return _dev_error_response('reindex failed', e, status_code=500)


@app.post('/api/reindex_recent')
def api_reindex_recent(limit: int = 200):
    """Reindex a recent sample of problems from the DB into STORE under a generated doc_id.

    Returns {'doc_id': ..., 'chunks': N} on success.
    """
    try:
        conn = connect_db()
    except Exception as e:
        # In dev environments where no DB is configured, fall back to constructing
        # a small recent-sample from available templates so the UI can still demo RAG.
        try:
            logger.warning('DB unavailable; building recent-sample from templates (%s)', str(e))
            tpls = globals().get('TEMPLATES') or {}
            texts = []
            for k, v in (tpls.items() if isinstance(tpls, dict) else []):
                if isinstance(v, dict):
                    p = v.get('prompt') or ''
                    if p:
                        texts.append(p.strip()[:400])
            if not texts:
                texts = [
                    'Solve x^2 - 4x + 3 = 0. Provide steps and final answer.',
                    'Find the derivative of f(x)=x^2 and evaluate at x=2.',
                    'Compute the integral \int_0^1 2x dx and give result.'
                ]
            try:
                vectorizer, mat = rag.build_index(texts)
            except Exception:
                vectorizer, mat = None, None
            new_doc_id = 'recent-sample-' + str(uuid.uuid4())
            chunks = [{'stem': t, 'solution_outline': '', 'metadata': {}} for t in texts]
            STORE[new_doc_id] = {
                'chunks': chunks,
                'vectorizer': vectorizer,
                'mat': mat,
                'text': '\n\n'.join(texts),
                'latex': None,
                'metadata': {'source': 'templates_fallback'},
                'source': 'templates_fallback',
            }
            return JSONResponse({'doc_id': new_doc_id, 'chunks': len(chunks)})
        except Exception:
            return _dev_error_response('DB connection failed', e, status_code=500)
    try:
        cur = conn.cursor()
        if getattr(conn, '_is_sqlite', False):
            cur.execute("SELECT stem, solution_outline, metadata FROM problems ORDER BY id DESC LIMIT %s", (limit,))
        else:
            cur.execute("SELECT stem, solution_outline, metadata FROM problems ORDER BY created_at DESC LIMIT %s", (limit,))
        rows = cur.fetchall()
        cur.close(); conn.close()
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        return _dev_error_response('failed to query problems', e, status_code=500)

    if not rows:
        return JSONResponse({'doc_id': None, 'chunks': 0})

    texts = []
    chunks = []
    full = ''
    for r in rows:
        pt = r[0] or ''
        so = r[1] or ''
        md = {}
        try:
            md = r[2] or {}
        except Exception:
            md = {}
        texts.append(pt)
        chunks.append({'stem': pt, 'solution_outline': so, 'metadata': dict(md) if isinstance(md, dict) else {}})
        full += pt + '\n\n' + so + '\n\n'

    try:
        vectorizer, mat = rag.build_index(texts)
    except Exception:
        vectorizer, mat = None, None

    new_doc_id = 'recent-sample-' + str(uuid.uuid4())
    STORE[new_doc_id] = {
        'chunks': chunks,
        'vectorizer': vectorizer,
        'mat': mat,
        'text': full,
        'latex': None,
        'metadata': {'source': 'db_recent_sample'},
        'source': 'db_recent_sample',
    }
    return JSONResponse({'doc_id': new_doc_id, 'chunks': len(chunks)})


@app.post('/api/upload_json_raw')
def upload_json_raw(payload_raw: dict = Body(...)):
    """Fallback endpoint that accepts a raw JSON dict (no pydantic validation).

    Useful when client JSON may not conform to the `IngestJSON` model and
    causes validation errors (e.g. unexpected types or patterns). This route
    mirrors `upload_json` but operates on a plain dict to avoid pydantic
    pre-validation failures.
    """
    try:
        # copy-paste of upload_json core logic but using plain dict access
        text = None
        if payload_raw.get('plain_text'):
            text = payload_raw.get('plain_text')
        elif payload_raw.get('latex'):
            try:
                text = latex_to_plain(payload_raw.get('latex'))
            except Exception as e:
                logger.exception('latex_to_plain failed (raw)')
                raise HTTPException(status_code=400, detail=f'LaTeX 変換に失敗しました: {e}')
        else:
            raise HTTPException(status_code=400, detail='latex または plain_text を指定してください')
    except HTTPException:
        raise
    except Exception as e:
        sample = str(payload_raw)[:200]
        logger.exception('upload_json_raw unexpected error; sample payload start=%s', sample)
        raise _dev_error_response('upload processing failed', e, status_code=500)

    if not text:
        if payload_raw.get('latex'):
            text = payload_raw.get('latex')
        else:
            raise HTTPException(status_code=400, detail='変換結果が空です')

    if len(text.encode('utf-8')) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail='テキストが大きすぎます')

    # Reuse the same JSON-detection & chunking logic from upload_json
    def _try_parse_json_blob_dict(s: str):
        # identical to upload_json._try_parse_json_blob but local copy
        if not s:
            return None
        t = s.strip()
        # drop surrounding code fences ``` ```
        if t.startswith('```') and t.endswith('```'):
            lines = t.splitlines()
            if len(lines) >= 3:
                t = '\n'.join(lines[1:-1]).strip()

        # if wrapped in a quoted JSON string, try unquoting first
        if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
            try:
                unq = json.loads(t)
                # if unq is string containing JSON, try parse again
                try:
                    return json.loads(unq)
                except Exception:
                    return unq if isinstance(unq, (dict, list)) else None
            except Exception:
                pass

        # direct parse attempt
        try:
            return json.loads(t)
        except Exception:
            pass

        # fallback: prefer extracting the JSON object that contains a 'problem'
        # or other expected keys. Search for keyword positions and expand to
        # nearest enclosing braces to parse a coherent object.
        keywords = ['"problem"', "'problem'", '"stem"', '"solution_outline"', '"stem_latex"', '"metadata"']
        for kw in keywords:
            ki = t.find(kw)
            if ki != -1:
                # find opening brace before keyword
                start = t.rfind('{', 0, ki)
                if start == -1:
                    start = t.rfind('[', 0, ki)
                if start == -1:
                    continue
                # find matching closing brace
                opening = t[start]
                closing = '}' if opening == '{' else ']'
                depth = 0
                in_math = False
                i = start
                while i < len(t):
                    ch = t[i]
                    if ch == '$':
                        in_math = not in_math
                        i += 1; continue
                    if in_math:
                        i += 1; continue
                    if ch == '\\' and i + 1 < len(t):
                        i += 2; continue
                    if ch == opening:
                        depth += 1
                    elif ch == closing:
                        depth -= 1
                        if depth == 0:
                            snippet = t[start:i+1]
                            try:
                                parsed = json.loads(snippet)
                                # ensure parsed contains something useful
                                if isinstance(parsed, dict):
                                    # accept parsed JSON if it looks like a problem object
                                    if 'problem' in parsed or 'stem' in parsed or 'solution_outline' in parsed or 'stem_latex' in parsed:
                                        return parsed
                                # otherwise keep looking
                            except Exception:
                                pass
                            break
                    i += 1

        # last resort: attempt to parse any brace-delimited substring starting at any brace
        for idx in range(len(t)):
            if t[idx] in '{[':
                opening = t[idx]
                closing = '}' if opening == '{' else ']'
                depth = 0
                in_math = False
                i = idx
                while i < len(t):
                    ch = t[i]
                    if ch == '$':
                        in_math = not in_math
                        i += 1; continue
                    if in_math:
                        i += 1; continue
                    if ch == '\\' and i + 1 < len(t):
                        i += 2; continue
                    if ch == opening:
                        depth += 1
                    elif ch == closing:
                        depth -= 1
                        if depth == 0:
                            snippet = t[idx:i+1]
                            try:
                                parsed = json.loads(snippet)
                                return parsed
                            except Exception:
                                pass
                            break
                    i += 1
        return None

    parsed_json = _try_parse_json_blob_dict(text)
    raw_chunks = None
    if parsed_json is not None:
        raw_chunks = []
        if isinstance(parsed_json, dict):
            if isinstance(parsed_json.get('problem'), dict):
                p = parsed_json.get('problem')
                # prefer non-empty 'stem' string, else fall back to legacy keys or the whole JSON
                _stem_val = p.get('stem')
                if isinstance(_stem_val, str) and _stem_val.strip():
                    stem_text = _stem_val
                else:
                    stem_text = p.get('text') or json.dumps(parsed_json, ensure_ascii=False)
                raw_chunks.append({
                    'stem': stem_text,
                    'solution_outline': p.get('solution_outline') or '',
                    'metadata': p.get('metadata') or parsed_json.get('metadata') or {},
                    'stem_latex': p.get('stem_latex') or parsed_json.get('stem_latex'),
                    'difficulty': p.get('difficulty') if p.get('difficulty') is not None else parsed_json.get('difficulty'),
                    'difficulty_level': p.get('difficulty_level') if p.get('difficulty_level') is not None else parsed_json.get('difficulty_level'),
                    'trickiness': p.get('trickiness') if p.get('trickiness') is not None else parsed_json.get('trickiness'),
                    'explanation': p.get('explanation') if p.get('explanation') is not None else parsed_json.get('explanation'),
                    'answer_brief': p.get('answer_brief') if p.get('answer_brief') is not None else parsed_json.get('answer_brief'),
                    'references': p.get('references') if p.get('references') is not None else parsed_json.get('references'),
                    'confidence': p.get('confidence') if p.get('confidence') is not None else parsed_json.get('confidence'),
                    'source': payload_raw.get('source') or p.get('source') or parsed_json.get('source') or 'json',
                    'raw_text': text,
                    'raw_json': json.dumps(parsed_json, ensure_ascii=False),
                })
            # if parsed_json is a dict with no 'problem' sub-object, treat the whole JSON blob as context
            elif parsed_json:
                stem_text = parsed_json.get('stem') if isinstance(parsed_json.get('stem'), str) and parsed_json.get('stem').strip() else (parsed_json.get('text') or json.dumps(parsed_json, ensure_ascii=False))
                raw_chunks.append({
                    'stem': stem_text,
                    'solution_outline': parsed_json.get('solution_outline', ''),
                    'metadata': parsed_json.get('metadata') or {},
                    'stem_latex': parsed_json.get('stem_latex'),
                    'difficulty': parsed_json.get('difficulty'),
                    'difficulty_level': parsed_json.get('difficulty_level'),
                    'trickiness': parsed_json.get('trickiness'),
                    'explanation': parsed_json.get('explanation'),
                    'answer_brief': parsed_json.get('answer_brief'),
                    'references': parsed_json.get('references'),
                    'confidence': parsed_json.get('confidence'),
                    'source': payload_raw.get('source') or parsed_json.get('source') or 'json',
                    'raw_text': text,
                    'raw_json': json.dumps(parsed_json, ensure_ascii=False),
                })
        elif isinstance(parsed_json, list):
            # if the parsed top-level value is a list, treat each element as a chunk
            for item in parsed_json:
                if isinstance(item, dict):
                    _stem_val = item.get('stem')
                    if isinstance(_stem_val, str) and _stem_val.strip():
                        stem_text = _stem_val
                    else:
                        stem_text = item.get('text') or json.dumps(item, ensure_ascii=False)
                    raw_chunks.append({
                        'stem': stem_text,
                        'solution_outline': item.get('solution_outline', ''),
                        'metadata': item.get('metadata') or {},
                        'stem_latex': item.get('stem_latex'),
                        'difficulty': item.get('difficulty'),
                        'difficulty_level': item.get('difficulty_level'),
                        'trickiness': item.get('trickiness'),
                        'explanation': item.get('explanation'),
                        'answer_brief': item.get('answer_brief'),
                        'references': item.get('references'),
                        'confidence': item.get('confidence'),
                        'source': payload_raw.get('source') or item.get('source') or 'json',
                        'raw_text': text,
                        'raw_json': json.dumps(item, ensure_ascii=False),
                    })
                else:
                    raw_chunks.append({'stem': str(item), 'solution_outline': ''})

    if raw_chunks is None:
        try:
            raw_chunks = rag.chunk_text(text)
        except Exception:
            raw_chunks = [text]

    # proceed with indexing/inserting similar to upload_json: build index, store doc
    try:
        texts_for_index = [c['stem'] if isinstance(c, dict) else c for c in raw_chunks]
        vectorizer, mat = rag.build_index(texts_for_index)
    except Exception:
        vectorizer, mat = None, None

    new_doc_id = 'recent-raw-' + str(uuid.uuid4())
    STORE[new_doc_id] = {
        'chunks': raw_chunks,
        'vectorizer': vectorizer,
        'mat': mat,
        'text': text,
        'latex': payload_raw.get('latex'),
        'metadata': payload_raw.get('metadata') or {},
        'source': payload_raw.get('source') or 'raw',
    }
    return JSONResponse({'doc_id': new_doc_id, 'chunks': len(raw_chunks)})


@app.on_event('startup')
def _startup_reindex_on_start():
    """Optional startup hook: if REINDEX_ON_START is set (comma-separated doc_ids),
    attempt to reindex them into STORE. This runs synchronously during startup; keep list short.
    """
    env = os.environ.get('REINDEX_ON_START')
    if not env:
        return
    doc_ids = [d.strip() for d in env.split(',') if d.strip()]
    if not doc_ids:
        return
    logger.info('REINDEX_ON_START: warming up %d docs', len(doc_ids))
    for did in doc_ids:
        try:
            r = _reindex_doc_from_db(did)
            logger.info('Reindexed %s -> %s chunks', did, r.get('chunks'))
        except Exception:
            logger.exception('Failed to reindex on startup: %s', did)


@app.get("/api/ask")
def ask(req: AskRequest = Body(...)):
    doc = STORE.get(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="doc_id が見つかりません")

    chunks = doc["chunks"]
    vectorizer = doc["vectorizer"]
    mat = doc["mat"]

    # chunks is a list of dicts; search expects list of texts
    texts = [c['stem'] if isinstance(c, dict) else c for c in chunks]
    results = rag.search(req.question, vectorizer, mat, texts, top_k=req.top_k)

    contexts = [{"score": r["score"], "text": r["text"]} for r in results]

    # 回答生成: Ollama が指定されていれば叩く（簡易実装）、なければ連結で暫定回答
    ollama_url = os.getenv("OLLAMA_URL")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3")

    if ollama_url:
        # 非常に簡易的な実装
        context_str = "\n".join([c["text"] for c in contexts])
        prompt = f"Context:\n{context_str}\n\nQuestion:\n{req.question}"
        try:
            r = requests.post(f"{ollama_url}/api/generate", json={"model": ollama_model, "prompt": prompt, "stream": False}, timeout=15)
            answer = r.json().get("response", "回答の取得に失敗しました")
        except Exception:
            answer = "Ollama への接続に失敗しました"
    else:
        answer = "Ollama が設定されていないため、検索結果の連結のみを返します。"

    return {"answer": answer, "contexts": contexts}


@app.post('/api/generate_pdf')
def generate_pdf(payload: dict = Body(...), background: BackgroundTasks = None):
    """Generate a PDF from an array of generated items. Payload: { generated: [ {latex, stem, explanation?} ], title?: str }

    Returns application/pdf or JSON error.
    """
    try:
        # Accept either a list of generated items or a single raw latex string.
        generated = payload.get('generated') or []
        # backward/UX friendly: if client sent 'latex' as a raw string, wrap it
        if not generated and isinstance(payload.get('latex'), str):
            generated = [{
                'latex': payload.get('latex'),
                'stem': payload.get('stem'),
                'explanation': payload.get('explanation')
            }]
        title = payload.get('title') or 'Generated Problems'
        if not isinstance(generated, list) or not generated:
            return JSONResponse({'error': 'no_generated_items'}, status_code=400)
        # Validate and sanitize LaTeX
        for item in generated:
            if not isinstance(item, dict):
                return JSONResponse({'error': 'invalid_item'}, status_code=400)
            latex = item.get('latex')
            # If the client accidentally sent JSON-escaped content (e.g. containing literal "\\n"),
            # unescape it so LaTeX sees real newlines and commands.
            try:
                new = _unescape_latex(latex)
                if new != latex:
                    logger.info('Unescaped latex content in item')
                    latex = new
            except Exception:
                pass
            if not latex or not isinstance(latex, str):
                return JSONResponse({'error': 'missing_latex'}, status_code=400)
            # Normalize bracketed math only for short single-line fragments.
            # If the item appears to be a multi-line document or contains structural
            # LaTeX (\textbf, \section, environments), skip automatic bracket
            # normalization to avoid corrupting prose blocks produced by LLMs.
            if ('\n' not in latex) and (len(latex) < 400) and (not re.search(r"\\textbf|\\section|\\begin|\\item", latex)):
                try:
                    latex_norm = _normalize_bracket_math(latex)
                except Exception:
                    latex_norm = latex
                # If normalization changed the latex, update the item so later code uses the normalized version
                if latex_norm != latex:
                    item['latex'] = latex_norm

        # safety: reject obviously dangerous LaTeX in any item
        for item in generated:
            latex = item.get('latex')
            if not _latex_sanitize_check(latex):
                return JSONResponse({'error': 'latex_forbidden'}, status_code=400)

    # Build a conservative LaTeX document preamble (safe defaults).
        header = (
            "\\documentclass[12pt]{article}\n"
            "\\usepackage{iftex}\n"
            "\\usepackage{amsmath,amssymb,mathtools}\n"
            "\\usepackage{geometry}\n"
            "\\geometry{margin=1in}\n"
            "\\ifPDFTeX\n"
            "  \\usepackage[utf8]{inputenc}\n"
            "  \\usepackage[T1]{fontenc}\n"
            "  \\usepackage{CJKutf8}\n"
            "  \\AtBeginDocument{\\begin{CJK*}{UTF8}{min}}\n"
            "  \\AtEndDocument{\\end{CJK*}}\n"
            "\\else\n"
            "  \\usepackage{fontspec}\n"
            "  \\ifLuaTeX\n"
            "    \\usepackage{luatexja}\n"
            "    \\usepackage{luatexja-fontspec}\n"
            "    \\IfFontExistsTF{Hiragino Sans}{\\setmainjfont{Hiragino Sans}}{\\IfFontExistsTF{Noto Sans CJK JP}{\\setmainjfont{Noto Sans CJK JP}}{}}\n"
            "  \\else\n"
            "    \\usepackage{xeCJK}\n"
            "    \\IfFontExistsTF{Hiragino Sans}{\\setCJKmainfont{Hiragino Sans}}{\\IfFontExistsTF{Noto Sans CJK JP}{\\setCJKmainfont{Noto Sans CJK JP}}{}}\n"
            "  \\fi\n"
            "\\fi\n"
            "% avoid forcing system fonts here to reduce engine failures\n"
            "\\title{__TITLE__}\n"
            "\\begin{document}\n"
            "\\maketitle\n"
        )
        header = header.replace('__TITLE__', title.replace('%', '%%'))

        def _auto_wrap_inline_math(blob: str) -> str:
            """Best-effort: wrap math-like fragments with $...$ if missing.

            Avoid touching lines that already contain math delimiters or LaTeX environments.
            """
            if not isinstance(blob, str) or not blob.strip():
                return blob

            def _wrap_math_in_line(line: str) -> str:
                if not line or ('$' in line) or ('\\[' in line) or ('\\]' in line):
                    return line
                # skip LaTeX structure lines (except \item)
                if line.strip().startswith('\\') and not line.strip().startswith('\\item'):
                    return line
                # heuristic: if line contains alignment chars (&) or line breaks (\\), assume it's part of a structure and don't wrap
                if '&' in line or '\\\\' in line:
                    return line
                mathy = re.search(r'(=|\\ge|\\le|\\frac|\\sqrt|\\sum|\\int|\\lim|\^|_)', line)
                if not mathy:
                    return line
                # If line has Japanese text, wrap only math-like tokens
                has_ja = re.search(r'[ぁ-んァ-ン一-龥]', line)
                if has_ja:
                    return re.sub(r'([A-Za-z0-9\\\(\)\[\]\+\-\*/=\^_\.,]+)', r'$\1$', line)
                # Otherwise wrap the whole line (preserving \item prefix)
                m = re.match(r'(\s*\\item\s*)(.*)$', line)
                if m:
                    return f"{m.group(1)}${m.group(2).strip()}$"
                return f"${line.strip()}$"

            lines = blob.splitlines()
            return '\n'.join([_wrap_math_in_line(ln) for ln in lines])

        def _sanitize_fontspec_fonts(blob: str) -> str:
            if not isinstance(blob, str) or not blob.strip():
                return blob
            # Wrap CJK font declarations with IfFontExistsTF to avoid missing-font errors.
            # Skip declarations that are already inside an \IfFontExistsTF block.
            def _wrap_font(cmd: str, font: str) -> str:
                return f"\\IfFontExistsTF{{{font}}}{{\\{cmd}{{{font}}}}}{{}}"

            for cmd in ('setCJKmainfont', 'setCJKsansfont', 'setCJKmonofont'):
                # Match \setCJK...{Font} that is NOT already preceded by \IfFontExistsTF{...}{
                # We use a negative lookbehind for the pattern "}{" which appears right before
                # the command when it's already wrapped.
                pattern = rf"(?<!}})\\{cmd}\{{([^}}]+)\}}"
                blob = re.sub(pattern, lambda m: _wrap_font(cmd, m.group(1)), blob)
            return blob

        def _fix_left_right_delimiters(blob: str) -> str:
            """Fix \\left{ → \\left\\{ and \\right} → \\right\\} (Missing delimiter error).

            LLMs frequently write \\left{ instead of \\left\\{ when using
            curly braces as math delimiters. LaTeX requires an explicit
            backslash before the brace after \\left/\\right.
            """
            if not isinstance(blob, str) or not blob.strip():
                return blob
            # \left{ where { is NOT already escaped (i.e. not preceded by \)
            blob = re.sub(r'\\left\{', r'\\left\\{', blob)
            blob = re.sub(r'\\right\}', r'\\right\\}', blob)
            # Also fix the rarer \left} and \right{ typos
            blob = re.sub(r'\\left\}', r'\\left\\}', blob)
            blob = re.sub(r'\\right\{', r'\\right\\{', blob)
            # Prevent double-escaping: \\left\\\\{ → \\left\\{
            blob = re.sub(r'\\left\\\\\{', r'\\left\\{', blob)
            blob = re.sub(r'\\right\\\\\}', r'\\right\\}', blob)
            blob = re.sub(r'\\left\\\\\}', r'\\left\\}', blob)
            blob = re.sub(r'\\right\\\\\{', r'\\right\\{', blob)
            return blob

        def _normalize_latex_linebreaks(blob: str) -> str:
            if not isinstance(blob, str) or not blob.strip():
                return blob
            # Convert single backslash line breaks to LaTeX \\ when they appear at end-of-line
            return re.sub(r"(?m)(?<!\\)\\\s*$", r"\\\\", blob)

        def _convert_bracket_math_blocks(blob: str) -> str:
            """Convert bare bracket display-math  [ ... ]  →  \\[ ... \\]

            This is the most common LLM mistake: using [ ] instead of \\[ \\].
            We are aggressive here because bare brackets containing math or
            \\begin{aligned} are almost certainly intended as display math.
            We still skip option-argument brackets like \\documentclass[...].
            """
            if not isinstance(blob, str) or not blob.strip():
                return blob

            def _repl(m):
                inner = m.group(1)
                # Skip option brackets attached to LaTeX commands:
                # e.g. \documentclass[...], \usepackage[...], \setlist[...]
                prefix = blob[:m.start()]
                if re.search(r"\\[A-Za-z]+\*?\s*$", prefix):
                    return m.group(0)
                # Skip empty brackets or very short content that looks like list labels
                stripped = inner.strip()
                if len(stripped) < 2:
                    return m.group(0)

                # Detect math-like content: environments (aligned, cases, etc.),
                # math operators, relations, superscript/subscript, digits with operators
                math_indicators = (
                    r'\\begin\{|\\end\{|'           # \begin{aligned} etc.
                    r'\\frac|\\sqrt|\\left|\\right|'
                    r'\\therefore|\\because|\\implies|\\Rightarrow|'
                    r'\\ge|\\le|\\geq|\\leq|\\neq|'
                    r'\\sum|\\prod|\\int|\\lim|'
                    r'\\sin|\\cos|\\tan|\\log|\\exp|'
                    r'\\cdot|\\times|\\pm|\\mp|'
                    r'[=<>]|'                        # relation symbols
                    r'[\^_]|'                        # super/subscript
                    r'&'                             # alignment char (align/aligned)
                )
                if re.search(math_indicators, stripped):
                    # Preserve internal newlines for multi-line math (aligned env)
                    # but collapse leading/trailing whitespace
                    return '\\[' + '\n' + stripped + '\n' + '\\]'
                return m.group(0)

            # Match [ ... ] blocks that span one or more lines.
            # Use a non-greedy match but allow newlines.
            return re.sub(r"(?<![\\A-Za-z])\[\s*([\s\S]*?)\s*\]", _repl, blob)

        # create a temp dir for compilation artifacts
        td = tempfile.mkdtemp(prefix='generated_pdf_')
        tex_path = os.path.join(td, 'document.tex')
        pdf_path = os.path.join(td, 'document.pdf')

        header_lines = [header]
        # If the client provided a single multi-line LaTeX blob (likely a full
        # problem or document), include it verbatim rather than wrapping it in
        # an enumerate environment which can break valid LaTeX from the model.
        if len(generated) == 1:
            only = generated[0].get('latex','')
            try:
                only = _unescape_latex(only)
            except Exception:
                pass
            has_document = isinstance(only, str) and re.search(r"\\documentclass|\\begin\{document\}", only)
            if has_document:
                if isinstance(only, str) and "\\end{document}" not in only:
                    only = only.rstrip() + "\n\\end{document}"
                # Do NOT auto-wrap math in full documents (it breaks align/tabular environments)
                try:
                    only = _sanitize_fontspec_fonts(only)
                except Exception:
                    pass
                try:
                    only = _fix_left_right_delimiters(only)
                except Exception:
                    pass
                try:
                    only = _convert_bracket_math_blocks(only)
                except Exception:
                    pass
                try:
                    only = _collapse_internal_newlines(only)
                except Exception:
                    pass
                try:
                    only = _normalize_latex_linebreaks(only)
                except Exception:
                    pass
                body_lines = [only]
            elif isinstance(only, str) and ("\n" in only or re.search(r"\\section|\\textbf", only)):
                # Normalize bracketed math within multi-line blobs and collapse
                # internal newlines that split tokens like '^'. This converts
                # math-like [ ... ] blocks into proper display math while
                # avoiding changing clearly textual bracket blocks.
                try:
                    only = _fix_left_right_delimiters(only)
                except Exception:
                    pass
                try:
                    only = _convert_bracket_math_blocks(only)
                except Exception:
                    pass
                try:
                    only = _collapse_internal_newlines(only)
                except Exception:
                    pass
                try:
                    only = _normalize_latex_linebreaks(only)
                except Exception:
                    pass
                try:
                    only = _auto_wrap_inline_math(only)
                except Exception:
                    pass
                body_lines = [header, only, '\\end{document}']
            else:
                body_lines = [header]
                body_lines.append('\\begin{enumerate}')
                for it in generated:
                    latex = it.get('latex')
                    stem = it.get('stem')
                    explanation = it.get('explanation')
                    body_lines.append('\\item')
                    # heuristically wrap short inline math in display mode; don't wrap multi-line prose
                    ls = latex.strip()
                    if (not (ls.startswith('\\[') or ls.startswith('\\begin') or ls.startswith('$'))) and ('\n' not in latex) and (len(latex) < 400) and (not re.search(r"\\textbf|\\section|\\text|\\begin|\\item", latex)):
                        body_lines.append('\\[' + latex + '\\]')
                    else:
                        try:
                            body_lines.append(_auto_wrap_inline_math(latex))
                        except Exception:
                            body_lines.append(latex)
                    if explanation:
                        # explanation inserted as plain text (assume safe-ish), escape %
                        body_lines.append('\\\\\\textbf{解説}: ' + str(explanation).replace('%','%%'))
                body_lines.append('\\end{enumerate}')
                body_lines.append('\\end{document}')
        else:
            body_lines = [header]
            body_lines.append('\\begin{enumerate}')
            for it in generated:
                latex = it.get('latex')
                stem = it.get('stem')
                explanation = it.get('explanation')
                body_lines.append('\\item')
                ls = latex.strip()
                if (not (ls.startswith('\\[') or ls.startswith('\\begin') or ls.startswith('$'))) and ('\n' not in latex) and (len(latex) < 400) and (not re.search(r"\\textbf|\\section|\\text|\\begin|\\item", latex)):
                    body_lines.append('\\[' + latex + '\\]')
                else:
                    try:
                        body_lines.append(_auto_wrap_inline_math(latex))
                    except Exception:
                        body_lines.append(latex)
                if explanation:
                    body_lines.append('\\\\\\textbf{解説}: ' + str(explanation).replace('%','%%'))
            body_lines.append('\\end{enumerate}')
            body_lines.append('\\end{document}')
        # Join body and attempt to auto-fix common structural issues
        body_text = '\n'.join(body_lines)

        def _balance_envs_and_braces(s: str) -> str:
            """Attempt to fix common LaTeX structural issues:

            - Ensure every \begin{env} has a matching \end{env} (append missing ends at EOF).
            - Append missing closing '}' if braces are unbalanced (more '{' than '}').
            This is a best-effort fixer; avoid aggressive edits that might hide real issues.
            """
            if not isinstance(s, str) or not s:
                return s

            def _fix_math_env_braces(text: str) -> str:
                envs = ['align*', 'align', 'equation*', 'equation', 'gather*', 'gather', 'aligned']
                for env in envs:
                    pattern = rf"\\begin\{{{env}\}}([\s\S]*?)\\end\{{{env}\}}"

                    def _repl(m):
                        inner = m.group(1)
                        opens = inner.count('{')
                        closes = inner.count('}')
                        if opens > closes:
                            inner = inner + ('}' * (opens - closes))
                        return f"\\begin{{{env}}}" + inner + f"\\end{{{env}}}"

                    text = re.sub(pattern, _repl, text)
                return text

            s = _fix_math_env_braces(s)

            # Find begin/end tokens in order
            token_re = re.compile(r"\\(begin|end)\{([^}]+)\}")
            stack = []
            for m in token_re.finditer(s):
                kind = m.group(1)
                env = m.group(2)
                if kind == 'begin':
                    stack.append(env)
                else:  # end
                    # if matching top, pop; else try to remove unmatched end by ignoring
                    if stack and stack[-1] == env:
                        stack.pop()
                    else:
                        # unmatched end: ignore (cannot safely insert begin earlier)
                        continue

            # Append missing \end{env} in reverse order
            if stack:
                for env in reversed(stack):
                    s = s + '\n\\end{' + env + '}'

            # Balance braces: only append missing closing braces; do NOT try to add opens
            opens = s.count('{')
            closes = s.count('}')
            if opens > closes:
                s = s + ('}' * (opens - closes))

            return s

        fixed_body = _balance_envs_and_braces(body_text)

        # ── Comprehensive LaTeX sanitizer (failsafe for LLM output) ──
        def _comprehensive_latex_sanitize(tex: str) -> str:
            """Fix all known LLM LaTeX mistakes so XeLaTeX/LuaLaTeX compiles cleanly."""
            if not isinstance(tex, str) or not tex.strip():
                return tex

            # 1) Remove \usepackage{unicode-math} (conflicts with fontspec/xeCJK)
            tex = re.sub(r'\\usepackage(\[[^\]]*\])?\{unicode-math\}\s*\n?', '', tex)

            # 2) Remove \usepackage{CJKutf8} and CJK environment wrappers (XeLaTeX incompatible)
            tex = re.sub(r'\\usepackage(\[[^\]]*\])?\{CJKutf8\}\s*\n?', '', tex)
            tex = re.sub(r'\\begin\{CJK\}\{[^}]*\}\{[^}]*\}\s*\n?', '', tex)
            tex = re.sub(r'\\end\{CJK\}\s*\n?', '', tex)

            # 3) Remove \IfFontExistsTF blocks (replace with just the first choice)
            #    Pattern: \IfFontExistsTF{Font}{TrueBody}{FalseBody}
            def _simplify_iffont(m):
                true_body = m.group(2)
                return true_body
            # Iteratively resolve nested \IfFontExistsTF (up to 5 levels)
            for _ in range(5):
                prev = tex
                tex = re.sub(
                    r'\\IfFontExistsTF\{[^}]*\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}',
                    _simplify_iffont, tex
                )
                if tex == prev:
                    break

            # 4) Ensure fontspec and xeCJK are present (add if missing)
            if '\\usepackage{fontspec}' not in tex and '\\begin{document}' in tex:
                tex = tex.replace('\\begin{document}', '\\usepackage{fontspec}\n\\begin{document}')
            if '\\usepackage{xeCJK}' not in tex and '\\begin{document}' in tex:
                tex = tex.replace('\\usepackage{fontspec}', '\\usepackage{fontspec}\n\\usepackage{xeCJK}')

            # 5) Ensure \setCJKmainfont is present; fix bad font choices
            bad_cjk_fonts = ['Noto Sans CJK JP', 'Hiragino Sans', 'Hiragino Kaku Gothic']
            for bad in bad_cjk_fonts:
                tex = tex.replace(f'\\setCJKmainfont{{{bad}}}', '\\setCJKmainfont{IPAexMincho}')
                tex = tex.replace(f'\\setmainjfont{{{bad}}}', '\\setCJKmainfont{IPAexMincho}')
            if '\\setCJKmainfont' not in tex and '\\begin{document}' in tex:
                tex = tex.replace('\\begin{document}', '\\setCJKmainfont{IPAexMincho}\n\\begin{document}')

            # 6) Convert bare bracket display math [ ... ] → \[ ... \]
            #    This is the most common and critical LLM mistake.
            #    Strategy: process line by line. A line that is just "[" starts a
            #    display math block; a line that is just "]" ends it.
            #    Also handle single-line: [ f(x) = ... ]
            lines = tex.split('\n')
            result_lines = []
            in_bare_math = False
            for i, line in enumerate(lines):
                stripped = line.strip()

                # Skip lines inside \begin{...} ... \end{...} preamble or option args
                # Check if this is an option arg line (preceded by a command)
                if i > 0 and stripped.startswith('[') and re.search(r'\\[A-Za-z]+\*?\s*$', result_lines[-1] if result_lines else ''):
                    result_lines.append(line)
                    continue

                # Multi-line bare bracket math: line is just "["
                if stripped == '[' and not in_bare_math:
                    in_bare_math = True
                    result_lines.append('\\[')
                    continue
                # End of multi-line bare bracket math: line is just "]"
                if stripped == ']' and in_bare_math:
                    in_bare_math = False
                    result_lines.append('\\]')
                    continue

                # Single-line bare bracket math: [ math content ]
                # Match lines like "[ f(x) = x^2 - 4x + 3 ]"
                # but NOT option args like \documentclass[a4paper]
                if not in_bare_math:
                    m = re.match(r'^(\s*)\[\s*(.+?)\s*\]\s*$', line)
                    if m:
                        indent = m.group(1)
                        inner = m.group(2)
                        # Check it looks like math (has =, ^, _, \, digits with operators)
                        if re.search(r'[=^_\\]|\d.*[+\-*/]', inner):
                            result_lines.append(f'{indent}\\[ {inner} \\]')
                            continue

                result_lines.append(line)

            tex = '\n'.join(result_lines)

            # 7) Fix \\[2mm] style line breaks in align/gather environments
            #    Convert \\[<dimension>] to just \\ inside math environments
            tex = re.sub(r'\\\\(\[[\d.]+(?:mm|ex|pt|em|cm)\])', r'\\\\', tex)

            # 8) Remove %GEN_VALIDATION block if it appears AFTER \end{document}
            #    (it should be before \end{document} but LLMs sometimes put it after)
            m_end_doc = tex.rfind('\\end{document}')
            if m_end_doc >= 0:
                after = tex[m_end_doc + len('\\end{document}'):]
                if '%GEN_VALIDATION' in after:
                    # Move validation block before \end{document}
                    val_match = re.search(r'(%GEN_VALIDATION:.*?%GEN_VALIDATION: END)', after, re.S)
                    if val_match:
                        val_block = val_match.group(1)
                        after_cleaned = after[:val_match.start()] + after[val_match.end():]
                        tex = tex[:m_end_doc] + '\n' + val_block + '\n\\end{document}' + after_cleaned

            return tex

        fixed_body = _comprehensive_latex_sanitize(fixed_body)

        # Choose LaTeX engine early so we can adapt full-document user output
        # (which may include fontspec/xeCJK or \setCJKmainfont) to the
        # available engine. Prefer xelatex -> lualatex -> pdflatex.
        engine = None
        engine_name = None
        for cand in ('xelatex', 'lualatex', 'pdflatex'):
            path = shutil.which(cand)
            if path:
                engine = path
                engine_name = cand
                break

        # If the user provided a full document that requests fontspec/xeCJK
        # but the runtime only has pdflatex, attempt a conservative downgrade
        # to a pdfLaTeX-friendly preamble rather than blindly running pdflatex
        # on fontspec commands (which will fail). This is best-effort: it
        # removes fontspec/xeCJK and \setCJKmainfont/\setmainfont and inserts
        # a CJKutf8 wrapper used by pdfLaTeX.
        def _downgrade_for_pdflatex(tex: str) -> str:
            if not isinstance(tex, str):
                return tex
            # remove fontspec/xeCJK and setmain/setCJK lines
            tex = re.sub(r"\\usepackage(\[[^\]]*\])?\{fontspec\}\s*\n?", '', tex)
            tex = re.sub(r"\\usepackage(\[[^\]]*\])?\{xeCJK\}\s*\n?", '', tex)
            tex = re.sub(r"\\setmainfont\{[^}]*\}\s*\n?", '', tex)
            tex = re.sub(r"\\setCJKmainfont\{[^}]*\}\s*\n?", '', tex)
            # remove IfFontExistsTF wrappers entirely
            tex = re.sub(r'\\IfFontExistsTF\{[^}]*\}\{[^}]*\}\{[^}]*\}', '', tex)
            # Insert pdfLaTeX-compatible CJKutf8 block before \begin{document}
            cjk_block = (
                '\\usepackage[utf8]{inputenc}\n'
                "\\usepackage[T1]{fontenc}\n"
                "\\usepackage{CJKutf8}\n"
                "\\AtBeginDocument{\\begin{CJK*}{UTF8}{min}}\n"
                "\\AtEndDocument{\\end{CJK*}}\n"
            )
            if '\\begin{document}' in tex and 'CJKutf8' not in tex:
                tex = tex.replace('\\begin{document}', cjk_block + '\\begin{document}')
            return tex

        # If we only have pdflatex available, defensively downgrade any
        # fontspec/xeCJK usage in the user's full document to CJKutf8 style.
        if engine_name == 'pdflatex':
            # apply only when the document contains fontspec/xeCJK or explicit setCJKmainfont
            if re.search(r"\\usepackage\{fontspec\}|\\usepackage\{xeCJK\}|\\setCJKmainfont\{|\\setmainfont\{", fixed_body):
                try:
                    fixed_body = _downgrade_for_pdflatex(fixed_body)
                    logger.info('Downgraded user-supplied fontspec/xeCJK to CJKutf8 for pdflatex')
                except Exception:
                    logger.exception('Failed to downgrade fontspec for pdflatex; continuing without downgrade')

        with open(tex_path, 'w', encoding='utf-8') as f:
            f.write(fixed_body)

        if engine is None:
            # No LaTeX engine installed; as a fallback provide the raw .tex (zipped) for local compilation
            zip_path = os.path.join(td, 'generated_tex.zip')
            with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(tex_path, arcname='document.tex')
                # also include per-item simple tex files to allow quick inspection
                for idx, it in enumerate(generated):
                    item_tex = os.path.join(td, f'item_{idx+1}.tex')
                    with open(item_tex, 'w', encoding='utf-8') as f:
                        f.write('\n'.join([header, '\\begin{document}', it.get('latex',''), '\\end{document}']))
                    zf.write(item_tex, arcname=f'item_{idx+1}.tex')
            # schedule cleanup
            def _cleanup_zip(p):
                try:
                    shutil.rmtree(p)
                except Exception:
                    pass
            if background is not None:
                background.add_task(_cleanup_zip, td)
            return FileResponse(zip_path, media_type='application/zip', filename='generated_tex.zip')

        try:
            logger.info('Running LaTeX engine: %s on %s', engine_name, tex_path)
            subprocess.run([engine_name, '-interaction=nonstopmode', '-halt-on-error', '-output-directory', td, tex_path], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
            logger.info('LaTeX engine finished; checking PDF at %s', pdf_path)
        except subprocess.CalledProcessError as e:
            out = (e.stdout or b'').decode('utf-8', errors='ignore')
            err = (e.stderr or b'').decode('utf-8', errors='ignore')
            shutil.rmtree(td, ignore_errors=True)
            return JSONResponse({'error': 'latex_compile_failed', 'engine': engine_name, 'stdout': out, 'stderr': err}, status_code=500)
        # verify pdf
        if not os.path.exists(pdf_path):
            # try alternative filename (document.pdf vs document.pdf may vary)
            candidates = [p for p in os.listdir(td) if p.endswith('.pdf')]
            if candidates:
                pdf_path = os.path.join(td, candidates[0])
            else:
                shutil.rmtree(td, ignore_errors=True)
                return JSONResponse({'error': 'pdf_not_generated'}, status_code=500)
        # If client requested a URL, publish a short-lived token and return its URL so the
        # frontend can open it (useful to open in a new tab). Otherwise stream the PDF.
        if payload.get('return_url'):
            token = uuid.uuid4().hex
            GENERATED_PDFS[token] = {'path': pdf_path, 'dir': td}
            logger.info('Published generated PDF: token=%s path=%s', token, pdf_path)

            # schedule expiration of the generated pdf directory
            if background is not None:
                background.add_task(_expire_pdf_after, token, td, PDF_TTL_SECONDS)
            # return a relative URL clients can open in a new tab
            return JSONResponse({'pdf_url': f'/api/generated_pdf/{token}'})

        # schedule cleanup of transient dir (default behavior when streaming)
        def _cleanup(dirpath):
            try:
                shutil.rmtree(dirpath)
            except Exception:
                pass
        if background is not None:
            background.add_task(_cleanup, td)
        # Prefer inline display so browsers can preview the PDF instead of forcing download
        headers = {
            'Content-Disposition': 'inline; filename="generated.pdf"',
            'Cache-Control': f'private, max-age={PDF_TTL_SECONDS}',
            'X-Content-Type-Options': 'nosniff'
        }
        return FileResponse(pdf_path, media_type='application/pdf', headers=headers)
    except Exception as e:
        logger.exception('pdf generation failed')
        return JSONResponse({'error': 'pdf_generation_failed', 'detail': str(e)}, status_code=500)


class GenerateLatexRequest(BaseModel):
    prompt: str
    num: Optional[int] = 5
    min_difficulty: Optional[float] = None
    max_difficulty: Optional[float] = None
    generation_style: Optional[str] = None
    prohibited_tags: Optional[list] = None
    include_explanations: Optional[bool] = False
    model_name: Optional[str] = None
    auto_insert: Optional[bool] = False
    # New: desired response format from the server: 'json' (default, structured) or 'latex' (raw LaTeX strings)
    response_format: Optional[str] = 'json'


@app.post('/api/generate_latex')
def api_generate_latex(req: GenerateLatexRequest = Body(...)):
    """Server-side generation of LaTeX problems.

    Returns JSON with keys: generated (array of {latex, stem?, difficulty?, explanation?}), raw (raw LLM text), errors (if any), inserted_ids (if auto_insert).
    Supports two response formats:
      - 'json' (default): LLM is asked to return a single JSON object with a 'generated' array (current behavior)
      - 'latex': LLM is asked to return raw LaTeX items (no JSON); items are split by a delimiter and returned as generated[].
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail='prompt is required')

    # build strict generation prompt that requires latex fields
    try:
        from backend.llm_helpers import make_generation_prompt_with_context, run_llm_generation
    except Exception:
        raise HTTPException(status_code=500, detail='generation helper not available')

    fmt = (req.response_format or 'json').lower()

    if fmt == 'latex':
        # Craft a prompt that instructs the model to output N LaTeX problems as plain text,
        # separated by a clear delimiter so we can split them reliably.
        num = int(req.num or 5)
        delimiter = '---PROBLEM---'
        system = (
            f'You are a generator that outputs exactly {num} distinct problems and nothing else. '
            'Do not add any surrounding text, explanation, or markdown. Do NOT output JSON. '\
        )
        user = (
            f'{req.prompt}\n\n'
            f'Output requirements:\n- Produce exactly {num} problems.\n- For each problem, output valid LaTeX that fully specifies the problem (use $...$ or \\[...\\] or LaTeX environments as needed).\n- Separate problems using the delimiter line: "{delimiter}" on its own line.\n- Do not include any other commentary.\n'
        )
        prompt_to_send = f"SYSTEM:\n{system}\n\nUSER:\n{user}"

        res = run_llm_generation(prompt_to_send, model=req.model_name)
        raw = res.get('raw') if isinstance(res, dict) else None
        errors = res.get('errors') if isinstance(res, dict) else None

        generated = []
        if raw:
            # split by delimiter first; fallback to double-newline splitting if delimiter not present
            parts = []
            if delimiter in raw:
                parts = [p.strip() for p in raw.split(delimiter) if p.strip()]
            else:
                # try splitting by two or more newlines and filter those that look like LaTeX
                cand = [p.strip() for p in re.split(r'\n{2,}', raw) if p.strip()]
                parts = cand

            # normalize each part as a latex string
            for p in parts[:num]:
                generated.append({'latex': p})
        else:
            # No raw output: return an error
            return JSONResponse({'error': 'generation_failed', 'raw': raw, 'errors': errors}, status_code=500)

        inserted_ids = []
        if req.auto_insert and generated:
            try:
                conn = connect_db()
                from workers.ingest.ingest import insert_problem
                for it in generated:
                    try:
                        latex = it.get('latex') if isinstance(it.get('latex'), str) else None
                        stem_plain = ''
                        try:
                            stem_plain = latex_to_plain(latex) if latex else ''
                        except Exception:
                            stem_plain = ''
                        p = {
                            'stem': stem_plain or (latex[:300] if latex else ''),
                            'stem_latex': latex,
                            'metadata': {'generated_from': req.prompt}
                        }
                        pid = insert_problem(conn, p)
                        inserted_ids.append(pid)
                    except Exception:
                        logger.exception('failed to insert generated item')
            except Exception:
                logger.exception('auto_insert handling failed')
            finally:
                try:
                    if conn:
                        conn.close()
                except Exception:
                    pass

        return JSONResponse({'generated': generated, 'raw': raw, 'errors': errors or [], 'inserted_ids': inserted_ids})

    # default: json-structured generation (existing behavior)
    prompt_to_send = make_generation_prompt_with_context(
        req.prompt,
        num=req.num or 5,
        request_id=str(uuid.uuid4()),
        context_text=None,
        profile='latex_only',
        min_difficulty=req.min_difficulty,
        max_difficulty=req.max_difficulty,
        generation_style=req.generation_style,
        prohibited_tags=req.prohibited_tags,
        include_explanations=req.include_explanations,
    )

    res = run_llm_generation(prompt_to_send, model=req.model_name)
    parsed = res.get('parsed') if isinstance(res, dict) else None
    raw = res.get('raw') if isinstance(res, dict) else None
    errors = res.get('errors') if isinstance(res, dict) else None

    generated = []
    if isinstance(parsed, dict) and isinstance(parsed.get('generated'), list):
        generated = parsed.get('generated')
    else:
        # if parsing failed, return raw text to the client for debugging
        return JSONResponse({'error': 'generation_failed', 'raw': raw, 'errors': errors}, status_code=500)

    inserted_ids = []
    if req.auto_insert and generated:
        try:
            conn = connect_db()
            from workers.ingest.ingest import insert_problem
            for it in generated:
                try:
                    # prefer latex field; create a short plain stem from LaTeX for storage
                    latex = it.get('latex') if isinstance(it.get('latex'), str) else None
                    stem_plain = ''
                    try:
                        stem_plain = latex_to_plain(latex) if latex else (it.get('stem') or '')
                    except Exception:
                        stem_plain = it.get('stem') or ''
                    p = {
                        'stem': stem_plain or (latex[:300] if latex else ''),
                        'stem_latex': latex,
                        'difficulty': it.get('difficulty'),
                        'metadata': {'generated_from': req.prompt}
                    }
                    pid = insert_problem(conn, p)
                    inserted_ids.append(pid)
                except Exception:
                    logger.exception('failed to insert generated item')
        except Exception:
            logger.exception('auto_insert handling failed')
        finally:
            try:
                if conn:
                    conn.close()
            except Exception:
                pass

    return JSONResponse({'generated': generated, 'raw': raw, 'errors': errors or [], 'inserted_ids': inserted_ids})


# ephemeral store for generated PDF files so client can be redirected to a stable URL
GENERATED_PDFS: Dict[str, Dict[str, Any]] = {}
PDF_TTL_SECONDS = 60 * 5  # 5 minutes


def _expire_pdf_after(token: str, dirpath: str, ttl: int = PDF_TTL_SECONDS):
    import time
    try:
        time.sleep(ttl)
    except Exception:
        pass
    try:
        shutil.rmtree(dirpath)
    except Exception:
        pass
    try:
        GENERATED_PDFS.pop(token, None)
    except Exception:
        pass


@app.get('/api/generated_pdf/{token}')
def api_get_generated_pdf(token: str):
    entry = GENERATED_PDFS.get(token)
    if not entry:
        return JSONResponse({'error': 'not_found'}, status_code=404)
    path = entry.get('path')
    if not path or not os.path.exists(path):
        GENERATED_PDFS.pop(token, None)
        return JSONResponse({'error': 'not_found'}, status_code=404)
    headers = {
        'Content-Disposition': 'inline; filename="generated.pdf"',
        'Cache-Control': f'private, max-age={PDF_TTL_SECONDS}',
        'X-Content-Type-Options': 'nosniff'
    }
    return FileResponse(path, media_type='application/pdf', headers=headers)


# Template loader
def _load_templates():
    """Load templates from backend/templates.json into global TEMPLATES dict.

    Handles files that may accidentally contain multiple JSON objects concatenated.
    """
    global TEMPLATES
    TEMPLATES = {}
    cand_paths = [os.path.join(THIS_DIR, 'templates.json'), os.path.join(PROJECT_ROOT, 'backend', 'templates.json')]
    for p in cand_paths:
        try:
            if not os.path.exists(p):
                continue
            s = open(p, 'r', encoding='utf-8').read()
            try:
                data = json.loads(s)
                if isinstance(data, dict):
                    TEMPLATES = data
                    return TEMPLATES
            except Exception:
                # attempt to extract top-level JSON objects and merge
                objs = re.findall(r"\{[\s\S]*?\}(?=\s*\{|\s*$)", s)
                for o in objs:
                    try:
                        d = json.loads(o)
                        if isinstance(d, dict):
                            TEMPLATES.update(d)
                    except Exception:
                        continue
                if TEMPLATES:
                    return TEMPLATES
        except Exception:
            continue
    # if not found or parse failed, leave empty dict
    TEMPLATES = {}
    return TEMPLATES

# Load templates at import time so /api/templates has content on first call
try:
    _load_templates()
except Exception:
    pass

def _dev_error_response(message: str, exc: Optional[Exception] = None, status_code: int = 500):
    """Return a JSONResponse for development error handling and log the exception.

    This helper avoids NameError in exception handlers that previously attempted
    to call an undefined function. It logs the full exception for debugging and
    returns a concise JSON payload to the client.
    """
    try:
        if exc is not None:
            logger.exception(message + (": %s" % str(exc)))
        else:
            logger.error(message)
    except Exception:
        # ensure logging errors do not mask the original issue
        pass
    detail = message
    if exc is not None:
        try:
            detail = f"{message}: {str(exc)}"
        except Exception:
            pass
    return JSONResponse({'error': 'server_error', 'detail': detail}, status_code=status_code)


class TemplateSaveRequest(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@app.get('/api/template/{template_id}')
def api_get_template(template_id: str):
    try:
        _load_templates()
    except Exception:
        pass
    tpl = (globals().get('TEMPLATES') or {}).get(template_id)
    if not tpl:
        return JSONResponse({'error': 'not_found'}, status_code=404)
    return JSONResponse({'template': tpl})


@app.post('/api/template')
def api_save_template(req: TemplateSaveRequest = Body(...)):
    """Save or update a template to backend/templates.json (overwrites file atomically).

    Note: this endpoint is intended for local development / trusted use only.
    """
    if not req.id or not isinstance(req.id, str):
        return JSONResponse({'error': 'invalid_id'}, status_code=400)
    try:
        # load current templates and update in-memory dict
        tpls = _load_templates() or {}
        tpls = dict(tpls)  # make a shallow copy
        entry = tpls.get(req.id, {}) if isinstance(tpls.get(req.id), dict) else {}
        if req.name is not None:
            entry['name'] = req.name
        if req.description is not None:
            entry['description'] = req.description
        if req.prompt is not None:
            entry['prompt'] = req.prompt
        if req.metadata is not None:
            entry['metadata'] = req.metadata
        tpls[req.id] = entry

        # write atomically to backend/templates.json (create a backup first)
        target = os.path.join(THIS_DIR, 'templates.json')
        try:
            if os.path.exists(target):
                bak = target + '.bak'
                shutil.copyfile(target, bak)
        except Exception:
            logger.exception('Failed to backup templates.json')
        # write pretty-printed JSON
        try:
            with open(target, 'w', encoding='utf-8') as f:
                json.dump(tpls, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.exception('Failed to write templates.json')
            return _dev_error_response('failed_to_write_templates', e, status_code=500)

        # update in-memory TEMPLATES
        globals()['TEMPLATES'] = tpls
        return JSONResponse({'saved': True, 'id': req.id})
    except Exception as e:
        logger.exception('failed to save template')
        return _dev_error_response('template_save_failed', e, status_code=500)