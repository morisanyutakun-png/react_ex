import os
import uuid
import subprocess
import shutil
import zipfile
from typing import Optional, Dict, Any, List
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

from fastapi.middleware.cors import CORSMiddleware
import requests
import logging
import traceback
try:
    from backend.db import connect_db
except Exception:
    try:
        from db import connect_db  # type: ignore
    except Exception:
        connect_db = None  # type: ignore[assignment]
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10MB 制限

app = FastAPI(title="RAG LaTeX/JSON MVP")

# ── CORS ────────────────────────────────────────────
# CORS_ALLOW_ORIGINS: comma-separated list of allowed origins.
# Defaults to "*" for local dev.  Set to specific origins in production, e.g.
#   CORS_ALLOW_ORIGINS=https://your-app.vercel.app,http://localhost:3000
_cors_raw = os.environ.get('CORS_ALLOW_ORIGINS', '*')
_cors_origins = [o.strip() for o in _cors_raw.split(',') if o.strip()] if _cors_raw != '*' else ['*']

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store used by several endpoints (keeps session/sample docs in memory).
# Initialize it to avoid NameError in dev/test environments where DB isn't used.
STORE: Dict[str, Any] = {}


# ── Health check ────────────────────────────────────
_DEPLOY_VERSION = '2025-07-14-v3'  # bump this to verify Render deploys latest code

@app.get('/health')
def health_check():
    """Minimal health-check endpoint for Render / monitoring."""
    return {'status': 'ok', 'version': _DEPLOY_VERSION}


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

try:
    from backend.routers.db_editor import router as db_editor_router
    app.include_router(db_editor_router)
except Exception:
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
        s = re.sub(r"\\\[(.*?)\\\]", lambda m: '\\[' + m.group(1).replace('\n', ' ') + '\\]', s, flags=re.S)
    except Exception:
        pass

    # 2) Remove newlines immediately after '^' or before '^'
    s = re.sub(r"\^\s*\n\s*", "^", s)
    s = re.sub(r"\n\s*\^", "^", s)

    # 3) Remove newlines between a LONE backslash and letters (\ \n text -> \text)
    #    Use negative lookbehind (?<!\\) so that LaTeX line-breaks (\\)
    #    at end-of-line in align/aligned environments are NOT consumed.
    s = re.sub(r"(?<!\\)\\\s*\n\s*([a-zA-Z@]+)", r"\\\1", s)

    # 4) Collapse accidental ")\n^" -> ")^" (already handled by caret rules but safe)
    s = s.replace(')\n^', ')^')

    return s


def _unescape_latex(latex: str) -> str:
    """Heuristic unescape for LaTeX-like strings that were JSON-escaped

    Converts common escape sequences (\\n, \\r\\n, \\t) back to real newlines/tabs
    and collapses accidental doubled backslashes before letters (e.g. "\\\\\\\\bigskip"
    -> "\\\\bigskip"). This fixes cases where the client sent a string with
    literal escape sequences instead of raw newlines.

    IMPORTANT: We only collapse doubled backslashes when there is strong
    evidence the string was double-JSON-escaped (i.e. literal \\\\n or \\\\r\\\\n
    sequences were detected). Without that evidence, collapsing \\\\ before
    a letter would destroy intentional LaTeX line breaks (\\\\) that precede
    a command, e.g. ``\\\\ \\\\textbf{...}`` → ``\\\\textbf{...}``.
    """
    if not latex or not isinstance(latex, str):
        return latex
    s = latex
    # Track whether we find evidence of JSON double-escaping:
    # literal '\\n' (two chars: backslash + n that is NOT a LaTeX command)
    # or literal '\\r\\n' in the string.
    found_escaped_newlines = ('\\r\\n' in s or '\\n' in s)
    # quick heuristics: if we see literal \n or \r\n sequences, convert them
    # NOTE: we deliberately DO NOT convert "\\t" -> real tab here because
    # sequences like "\textbf" can be misinterpreted as "\\t" + "extbf"
    # during JSON unescaping; converting to a real tab can destroy TeX control
    # sequences (producing a tab character followed by "extbf"). Instead,
    # we only normalize newlines and leave any literal '\\t' alone. Any
    # real TAB characters in the final string are converted to a single space
    # below to avoid TeX receiving actual tab control characters (which show
    # up as ^^I in logs).
    #
    # CRITICAL: we must NOT replace \n when it is the start of a LaTeX
    # command such as \newpage, \newtcolorbox, \noindent, \neq, \neg,
    # \notag, \nonumber, etc.  Using a negative-lookahead (?![a-zA-Z])
    # ensures we only convert standalone \n (JSON-escaped newlines) and
    # leave LaTeX command prefixes intact.
    if found_escaped_newlines:
        s = re.sub(r'\\r\\n(?![a-zA-Z])', '\n', s)
        s = re.sub(r'\\n(?![a-zA-Z])', '\n', s)
    # Collapse doubled backslashes before letters into single backslash
    # ONLY when we detected double-escaping evidence.
    # e.g. "\\\\textbf" -> "\\textbf"  (this handles JSON-escaped
    # backslashes that became doubled during transmission).
    # Without evidence of double-escaping, \\textbf is a legitimate
    # LaTeX line-break (\\) followed by \textbf command — do NOT collapse.
    if found_escaped_newlines:
        # First collapse quadruple+ backslashes (heavily escaped): \\\\ → \\
        s = re.sub(r"\\\\\\\\([a-zA-Z@]+)", r"\\\\\1", s)
        # Then collapse remaining doubled backslashes before commands
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


# ── Text extraction from uploaded files (PDF, text, images) ──
@app.post('/api/extract_text')
async def extract_text_from_file(file: UploadFile = File(...)):
    """Extract text content from an uploaded file (PDF, .txt, .tex, .md).

    Returns the extracted text so the frontend can use it as source material
    for generating similar problems. Supports:
    - PDF: uses pdftotext (poppler) or falls back to reading raw text
    - LaTeX (.tex): returned as-is
    - Plain text (.txt, .md): returned as-is
    """
    if not file or not file.filename:
        return JSONResponse({'error': 'no_file'}, status_code=400)

    filename = file.filename.lower()
    content_bytes = await file.read()

    if len(content_bytes) > MAX_FILE_BYTES:
        return JSONResponse({'error': 'file_too_large', 'detail': f'Max {MAX_FILE_BYTES // (1024*1024)}MB'}, status_code=400)

    extracted = ''

    try:
        if filename.endswith('.pdf'):
            # Try pdftotext (poppler-utils)
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp.write(content_bytes)
                tmp_path = tmp.name
            try:
                pdftotext = shutil.which('pdftotext')
                if pdftotext:
                    result = subprocess.run(
                        [pdftotext, '-layout', tmp_path, '-'],
                        capture_output=True, text=True, timeout=30
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        extracted = result.stdout.strip()
                    else:
                        # fallback: try reading as text
                        extracted = content_bytes.decode('utf-8', errors='ignore').strip()
                else:
                    # No pdftotext available: try raw decode
                    extracted = content_bytes.decode('utf-8', errors='ignore').strip()
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        elif filename.endswith(('.tex', '.latex')):
            extracted = content_bytes.decode('utf-8', errors='ignore').strip()

        elif filename.endswith(('.txt', '.md', '.markdown', '.text')):
            extracted = content_bytes.decode('utf-8', errors='ignore').strip()

        elif filename.endswith(('.json',)):
            text = content_bytes.decode('utf-8', errors='ignore').strip()
            try:
                data = json.loads(text)
                if isinstance(data, dict):
                    # Extract problem-related fields
                    parts = []
                    for key in ('stem', 'problem', 'question', 'text', 'content', 'stem_latex'):
                        if key in data and data[key]:
                            parts.append(str(data[key]))
                    extracted = '\n\n'.join(parts) if parts else text
                else:
                    extracted = text
            except Exception:
                extracted = text
        else:
            # Try to decode as text
            extracted = content_bytes.decode('utf-8', errors='ignore').strip()

    except Exception as e:
        logger.exception('Failed to extract text from uploaded file')
        return JSONResponse({'error': 'extraction_failed', 'detail': str(e)}, status_code=500)

    if not extracted:
        return JSONResponse({'error': 'empty_extraction', 'detail': 'ファイルからテキストを抽出できませんでした'}, status_code=400)

    return JSONResponse({
        'extracted_text': extracted[:10000],  # Limit to 10K chars
        'filename': file.filename,
        'char_count': len(extracted),
        'truncated': len(extracted) > 10000,
    })


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
            # ── subject / field / topic フィルタを metadata から抽出 ──
            _subject_filter = None
            _field_filter = None  # field_id (int)
            _topic_filter = None  # topic text (str) e.g. "積分法"
            if payload.metadata:
                _subject_filter = (payload.metadata.get('subject') or '').strip() or None
                _field_name = (payload.metadata.get('field') or '').strip()
                # topic テキストフィルタ: field 名をそのまま topic として使う
                _topic_filter = _field_name or (payload.metadata.get('topic') or '').strip() or None
                if _field_name and not getattr(conn, '_is_sqlite', False):
                    try:
                        _cur_f = conn.cursor()
                        _cur_f.execute(
                            "SELECT id FROM fields WHERE field_name = %s OR field_code = %s LIMIT 1",
                            (_field_name, _field_name),
                        )
                        _fr = _cur_f.fetchone()
                        _cur_f.close()
                        if _fr:
                            _field_filter = _fr[0]
                    except Exception:
                        pass

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
                field_filter=_field_filter,
                subject_filter=_subject_filter,
                topic_filter=_topic_filter,
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
    # Source text: user-provided problem text (extracted from PDF/image/text) to use as
    # reference for generating similar problems. The LLM will analyze this and create variants.
    source_text: Optional[str] = None
    # LaTeX output format preset: controls prompt instructions and PDF preamble
    latex_preset: Optional[str] = 'exam'
    # Optional extra LaTeX packages to include (e.g. ['tikz', 'circuitikz', 'pgfplots'])
    extra_packages: Optional[List[str]] = []


@app.post('/api/render_template')
def api_render_template(req: RenderTemplateRequest = Body(...)):
    """Render a server-side template and optionally inject RAG snippets and difficulty metrics.

    Supported placeholders in templates:
      {subject}, {difficulty}, {num_questions}, {doc_snippets}, {rag_summary}, {chunk_count}
    New placeholders added here:
      {difficulty_score} (0..1), {difficulty_level} (1..5), {trickiness} (0..1), {difficulty_details}
    """
    _ensure_templates()
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
            # No doc_id provided: query DB directly for problems, then optionally rank with TF-IDF.
            # This is a simple, reliable approach that guarantees results if DB has any problems.
            try:
                conn = connect_db()
                _is_sq = getattr(conn, '_is_sqlite', False)

                subject_f = req.subject_filter or req.subject or ''
                field_f = getattr(req, 'field_filter', None) or ''
                top_k = int(req.top_k or 5)

                logger.info('RAG: starting DB query — subject=%r, field=%r, top_k=%d, is_sqlite=%s',
                            subject_f, field_f, top_k, _is_sq)

                # ── Direct DB query with cascading WHERE ──
                # Try narrowest filter first, broaden until we get results
                cur = conn.cursor()
                _order = 'id DESC' if _is_sq else 'created_at DESC'
                _found_rows = []
                _used_tier = 'none'

                # Build cascading WHERE attempts
                _attempts = []

                # Tier 1: subject + topic (field name used as topic)
                if subject_f and field_f:
                    _attempts.append((
                        "(subject = %s OR subject LIKE %s) AND topic = %s",
                        [subject_f, subject_f + '%', field_f],
                        'subject+topic',
                    ))

                # Tier 2: subject only
                if subject_f:
                    _attempts.append((
                        "(subject = %s OR subject LIKE %s)",
                        [subject_f, subject_f + '%'],
                        'subject-only',
                    ))

                # Tier 3: global (all problems)
                _attempts.append(("1=1", [], 'global'))

                for _where, _params, _tier in _attempts:
                    _sql = (
                        f"SELECT id, stem, solution_outline, difficulty, trickiness, subject, topic "
                        f"FROM problems "
                        f"WHERE {_where} AND stem IS NOT NULL AND stem != '' "
                        f"ORDER BY {_order} LIMIT %s"
                    )
                    cur.execute(_sql, tuple(_params + [200]))
                    _found_rows = cur.fetchall()
                    logger.info('RAG DB tier=%s: %d rows', _tier, len(_found_rows))
                    if _found_rows:
                        _used_tier = _tier
                        break

                cur.close()

                # Convert rows to candidates
                for r in _found_rows:
                    pt = (r[1] or '').strip()
                    if pt:
                        texts.append(pt)
                        candidates.append({
                            'id': r[0],
                            'text': pt,
                            'difficulty': r[3],
                            'trickiness': r[4],
                            'search_tier': _used_tier,
                            'metadata': {},
                        })
                        sol = (r[2] or '').strip()
                        full += pt + '\n\n' + (sol + '\n\n' if sol else '')

                logger.info('RAG: %d texts from DB (tier=%s)', len(texts), _used_tier)

                # Optional: rank using TF-IDF similarity if we have more than top_k texts
                if len(texts) > top_k:
                    try:
                        _rag_query = ' '.join(filter(None, [
                            subject_f, field_f, req.difficulty or '',
                            (prompt[:400] if prompt else ''),
                        ]))
                        if rag and hasattr(rag, 'build_index'):
                            _vz, _mt = rag.build_index(texts)
                            if _vz and _mt is not None:
                                from sklearn.metrics.pairwise import cosine_similarity as _cs
                                _qv = _vz.transform([_rag_query])
                                _sims = _cs(_qv, _mt)[0]
                                # Attach similarity scores to candidates
                                for i, c in enumerate(candidates):
                                    c['sim_score'] = float(_sims[i]) if i < len(_sims) else 0.0
                                # Sort by sim_score desc
                                candidates.sort(key=lambda x: -x.get('sim_score', 0.0))
                                texts = [c['text'] for c in candidates]
                                logger.info('RAG: TF-IDF ranking applied, top score=%.3f',
                                            candidates[0].get('sim_score', 0) if candidates else 0)
                    except Exception as rank_err:
                        logger.warning('RAG: TF-IDF ranking failed (non-fatal): %s', rank_err)

                try:
                    conn.close()
                except Exception:
                    pass

                # Build TF-IDF index on the retrieved texts (for rag_summary etc.)
                if texts:
                    try:
                        vectorizer, mat = rag.build_index(texts)
                    except Exception:
                        vectorizer, mat = None, None

                logger.info('RAG(render_template): final %d texts (subject=%r, field=%r, tier=%s)',
                            len(texts), subject_f, field_f, _used_tier)
            except Exception as outer_exc:
                import traceback
                logger.warning('RAG: DB query failed: %s\n%s', outer_exc, traceback.format_exc())
                texts = []
                _used_tier = 'error'

        ctx['chunk_count'] = len(texts)
        ctx['rag_method'] = 'db_direct'
        ctx['rag_retrieved'] = len(texts)
        # _used_tier is set in the DB query section; default to 'none' if doc_id path was taken
        _used_tier_val = locals().get('_used_tier', 'none')

        # ── Build doc_snippets directly from candidates (already ranked) ──
        top_k = int(req.top_k or 5)
        items = []
        seen_texts = set()
        for c in candidates[:top_k]:
            text_snip = (c.get('text') or '').strip()
            if not text_snip or text_snip in seen_texts:
                continue
            seen_texts.add(text_snip)
            items.append({
                'id': c.get('id'),
                'sim_score': c.get('sim_score', 0.0),
                'combined_score': 0.0,
                'difficulty': c.get('difficulty'),
                'trickiness': c.get('trickiness'),
                'text': text_snip,
                'search_tier': c.get('search_tier', _used_tier_val),
            })

        ctx['doc_snippets_items'] = items
        ctx['doc_snippets'] = '\n\n'.join([it['text'] for it in items])
        ctx['rag_retrieved'] = len(items)
        # Determine rag_status based on results
        if items:
            ctx['rag_status'] = 'ok'  # We have results — always report as OK
        elif len(texts) == 0:
            ctx['rag_status'] = 'no_data'  # DB is empty
        else:
            ctx['rag_status'] = 'empty'
        logger.info('RAG: final doc_snippets=%d items, %d chars, status=%s, tier=%s',
                     len(items), len(ctx['doc_snippets']), ctx['rag_status'], _used_tier_val)

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
            if len(summary) + len(s) + 2 > 2400:
                if not summary:
                    summary = s[:2400]
                break
            if summary:
                summary += '\n\n' + s
            else:
                summary = s
        ctx['rag_summary'] = summary[:2400]

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
                # Use doc_snippets (full ranked items) when available, else rag_summary
                if ctx.get('doc_snippets'):
                    prompt = prompt + '\n\n【RAG参照問題（{chunk_count}件中上位抜粋）】\n{doc_snippets}\n'
                else:
                    prompt = prompt + '\n\n【参考資料】\n{rag_summary}\n'

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

                # If source_text was provided (extracted from user-uploaded PDF/text),
                # prepend it as reference material for the LLM
                source_text = getattr(req, 'source_text', None) or ''
                source_block = ''
                if source_text and isinstance(source_text, str) and source_text.strip():
                    source_block = (
                        "\n\n【参照元の問題（ユーザー提供）】\n"
                        "以下はユーザーがアップロードした問題文です。この問題の内容・形式・難易度を分析し、\n"
                        "同じ出題傾向・形式・難易度で類題を生成してください。\n"
                        "元の問題をそのままコピーせず、数値や条件を変えた新しい問題を作成すること。\n\n"
                        f"--- 参照元 ---\n{source_text.strip()}\n--- 参照元ここまで ---\n"
                    )

                # If RAG retrieved items exist, append them as a supplementary reference block.
                # When source_text is also provided, RAG items serve as additional examples.
                rag_items = ctx.get('doc_snippets_items') or []
                if rag_items:
                    rag_lines = []
                    for i, it in enumerate(rag_items, 1):
                        t = (it.get('text') or '').strip()
                        if not t:
                            continue
                        diff_label = ''
                        if it.get('difficulty') is not None:
                            diff_label = f' [難易度:{it["difficulty"]:.2f}]'
                        rag_lines.append(f'参照問題 {i}{diff_label}:\n{t}')
                    if rag_lines:
                        if source_block:
                            # source_text が既にある場合: RAGは補助参考として追加
                            source_block += (
                                "\n\n【補助参照（データベースから検索した類似問題）】\n"
                                "上記のユーザー提供問題を最優先とし、以下のDB問題も形式・難易度の参考にしてください。\n\n"
                                + '\n\n---\n'.join(rag_lines)
                                + '\n'
                            )
                        else:
                            source_block = (
                                "\n\n【RAG参照問題（データベースから検索・ランク付け済み）】\n"
                                "以下はデータベースから検索した類似問題です。これらの出題形式・難易度・語彙・解法パターンを参考にして、\n"
                                "新しい問題を生成してください。参照問題をそのままコピーしないこと。\n\n"
                                + '\n\n---\n'.join(rag_lines)
                                + '\n'
                            )

                # --- Load LaTeX preset prompt instruction if available ---
                preset_id = getattr(req, 'latex_preset', 'exam') or 'exam'
                preset_data = _load_latex_preset(preset_id)
                preset_prompt_instr = ''
                preset_name = '試験問題'
                if preset_data and preset_data.get('prompt_instruction'):
                    preset_prompt_instr = preset_data['prompt_instruction']
                    preset_name = preset_data.get('name', preset_id)

                # --- Build preset-specific skeleton and structural rules ---
                # Presets that use problem/answer section structure
                _EXAM_LIKE = {'exam', 'report', 'mock_exam'}

                # Common CJK-aware preamble base (iftex-safe, works on all engines)
                _cjk_preamble = (
                    "\\documentclass[a4paper,11pt]{article}\n"
                    "\\usepackage{amsmath,amssymb,mathtools}\n"
                    "\\usepackage{enumitem}\n"
                    "\\usepackage{geometry}\n"
                    "\\geometry{top=20mm,bottom=25mm,left=22mm,right=22mm}\n"
                    "\\usepackage{setspace}\n"
                    "\\usepackage{iftex}\n"
                    "\\ifPDFTeX\n"
                    "  \\usepackage[utf8]{inputenc}\\usepackage[T1]{fontenc}\n"
                    "  \\usepackage{CJKutf8}\n"
                    "  \\AtBeginDocument{\\begin{CJK*}{UTF8}{min}}\n"
                    "  \\AtEndDocument{\\end{CJK*}}\n"
                    "\\else\n"
                    "  \\usepackage{fontspec}\n"
                    "  \\ifLuaTeX\n"
                    "    \\usepackage{luatexja}\\usepackage{luatexja-fontspec}\n"
                    "  \\else\n"
                    "    \\usepackage{xeCJK}\n"
                    "    \\IfFontExistsTF{IPAexMincho}{\\setCJKmainfont{IPAexMincho}}"
                    "{\\IfFontExistsTF{Noto Serif CJK JP}{\\setCJKmainfont{Noto Serif CJK JP}}"
                    "{\\IfFontExistsTF{Noto Sans CJK JP}{\\setCJKmainfont{Noto Sans CJK JP}}{}}}\\relax\n"
                    "  \\fi\n"
                    "\\fi\n"
                )

                if preset_id in _EXAM_LIKE:
                    latex_skeleton = (
                        _cjk_preamble +
                        "\\usepackage{parskip}\n"
                        "\\usepackage{fancyhdr}\n"
                        "\\usepackage{titlesec}\n"
                        "\\usepackage{xcolor}\n"
                        "\\definecolor{mainblue}{HTML}{1A5276}\n"
                        "\\pagestyle{fancy}\\fancyhf{}\n"
                        "\\renewcommand{\\headrulewidth}{0.8pt}\n"
                        "\\fancyhead[L]{\\small\\textsf{\\textbf{類題演習}}}\n"
                        "\\fancyhead[R]{\\small\\textsf{\\thepage}}\n"
                        "\\setlength{\\headheight}{14pt}\n"
                        "\\newcommand{\\problem}[1]{\\subsection*{\\textbf{問題 #1}}}\n"
                        "\\newcommand{\\answer}[1]{\\noindent\\rule{\\linewidth}{0.4pt}\\subsection*{問題 #1 の解答}}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "\\section*{問題}\n\n"
                        "{{problems_section}}\n\n"
                        "\\newpage\n\n"
                        "\\section*{解答・解説}\n\n"
                        "{{answers_section}}\n\n"
                        "\\end{document}\n"
                    )
                    if preset_id == 'mock_exam':
                        struct_rules = (
                            "=== レイアウトルール ===\n"
                            "- {{problems_section}} の冒頭に模試ヘッダーを入れる:\n"
                            "  {\\large\\bfseries 模擬試験} \\hfill 制限時間: 60分 \\quad 満点: 100点\n"
                            "  注意事項を \\begin{itemize} で3〜5項目。\n"
                            "- 大問は \\section*{第1問}（配点: XX点）形式。小問は \\begin{enumerate}[(1)]。\n"
                            "- {{answers_section}} には \\answer{N} で解答。配点内訳を明記。\n"
                            "- 問題と解答は \\newpage で分離。\n\n"
                        )
                    elif preset_id == 'report':
                        struct_rules = (
                            "=== レイアウトルール ===\n"
                            "- {{problems_section}} に \\problem{N} で問題を列挙。\n"
                            "- {{answers_section}} は各問3部構成:\n"
                            "  \\answer{N} → \\paragraph{解法}（step-by-step）→ \\paragraph{ポイント}（箇条書き）\n"
                            "- align* で計算過程を揃える。\n"
                            "- 問題と解説は \\newpage で分離。\n\n"
                        )
                    else:  # exam
                        struct_rules = (
                            "=== レイアウトルール ===\n"
                            "- 前半: \\section*{問題}、後半: \\section*{解答・解説}、\\newpage で分離。\n"
                            "- 各問題は \\problem{N} で始め、末尾に [XX点] と配点。\n"
                            "  小問は \\begin{enumerate}[(1)] の \\item。\n"
                            "- 各解答は \\answer{N} で始める。途中式・考え方を含む。\n\n"
                        )

                elif preset_id == 'worksheet':
                    latex_skeleton = (
                        _cjk_preamble +
                        "\\usepackage{ulem}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "\\begin{flushright}\n"
                        "名前：\\underline{\\hspace{5cm}} \\quad 日付：\\underline{\\hspace{3cm}}\n"
                        "\\end{flushright}\n"
                        "\\begin{center}{\\Large\\bfseries {{title}}}\\end{center}\n"
                        "\\vspace{1em}\n\n"
                        "% 問題と解答スペースをここに生成\n"
                        "{{problems_section}}\n\n"
                        "\\newpage\n\n"
                        "\\begin{center}{\\large\\bfseries 解答}\\end{center}\n\n"
                        "{{answers_section}}\n\n"
                        "\\end{document}\n"
                    )
                    struct_rules = (
                        "=== レイアウトルール ===\n"
                        "- 冒頭に名前欄・日付欄（スケルトン通り、変更しない）。\n"
                        "- {{problems_section}} に問題を \\begin{enumerate}[leftmargin=*] で列挙。\n"
                        "  各啎の後に \\vspace{3cm} で解答スペースを設ける。\n"
                        "- {{answers_section}} に番号順に解答を \\begin{enumerate} で記載。\n"
                        "- \\problem, \\answer 等の独自コマンドは使わない。\n\n"
                    )

                elif preset_id == 'flashcard':
                    latex_skeleton = (
                        _cjk_preamble +
                        "\\usepackage{array}\n"
                        "\\usepackage{longtable}\n"
                        "\\usepackage{booktabs}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "\\begin{center}{\\Large\\bfseries {{title}}}\\end{center}\n"
                        "\\vspace{1em}\n\n"
                        "% 一問一答カード: longtable で問題と解答を左右に並べる\n"
                        "{{problems_section}}\n\n"
                        "\\end{document}\n"
                    )
                    struct_rules = (
                        "=== レイアウトルール ===\n"
                        "- {{problems_section}} を以下の longtable で置き換える:\n"
                        "\\begin{longtable}{|p{0.47\\textwidth}|p{0.47\\textwidth}|}\n"
                        "\\hline\n"
                        "\\textbf{問題} & \\textbf{解答} \\\\\n"
                        "\\hline\n"
                        "\\endfirsthead\n"
                        "\\hline\n"
                        "\\textbf{問題} & \\textbf{解答} \\\\\n"
                        "\\hline\n"
                        "\\endhead\n"
                        "\\hline\n"
                        "\\endlastfoot\n"
                        "問題文 & 解答文 \\\\\n"
                        "\\hline\n"
                        "\\end{longtable}\n\n"
                        "- 左列=問題のみ、右列=解答のみ。混在禁止。\n"
                        "- 各行末: \\\\ → 次行に \\hline\n"
                        "- セル内数式: $...$ のみ。\n"
                        "- \\begin{tabular}, \\section, \\newpage は使わない。\n\n"
                    )

                else:  # minimal
                    latex_skeleton = (
                        _cjk_preamble +
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "% コンテンツをここに記述\n"
                        "{{problems_section}}\n\n"
                        "\\end{document}\n"
                    )
                    struct_rules = (
                        "=== レイアウトルール ===\n"
                        "- 問題: \\begin{enumerate}[leftmargin=*] の \\item で番号付きリスト。\n"
                        "- 解答: \\section*{解答} の下に \\begin{enumerate} で番号順。\n"
                        "- 独自コマンド（\\problem, \\answer）は使わない。\n\n"
                    )

                # Build modular LaTeX instructions based on subject
                _subject_for_rules = getattr(req, 'subject', '') or ctx.get('subject', '') or ''
                latex_instr = _build_latex_instructions(
                    subject=_subject_for_rules,
                    prompt_text=orig_prompt_body,
                    struct_rules=struct_rules,
                    preset_name=preset_name,
                    preset_prompt_instr=preset_prompt_instr,
                )

                # --- Inject extra diagram/utility packages ---
                extra_pkgs = getattr(req, 'extra_packages', None) or []
                if extra_pkgs:
                    pkg_usepackage_lines = ""
                    pkg_hints = "\n=== 利用可能な追加パッケージ（必要に応じて使用すること） ===\n"
                    for pkg_id in extra_pkgs:
                        pkg_def = DIAGRAM_PACKAGES.get(pkg_id)
                        if pkg_def:
                            pkg_usepackage_lines += pkg_def['usepackage'] + "\n"
                            pkg_hints += f"P-{pkg_id}) {pkg_def['prompt_hint']}\n"
                        else:
                            # custom package name (free text)
                            pkg_usepackage_lines += f"\\usepackage{{{pkg_id}}}\n"
                            pkg_hints += f"P-{pkg_id}) \\usepackage{{{pkg_id}}} が利用可能。\n"
                    # Inject before \begin{document}
                    latex_skeleton = latex_skeleton.replace(
                        "\\begin{document}", pkg_usepackage_lines + "\\begin{document}", 1
                    )
                    latex_instr += pkg_hints

                # Assemble: skeleton (target structure) + instructions + user prompt body
                prompt = f"以下のLaTeXスケルトンを完成させてください:\n\n{latex_skeleton}\n\n{latex_instr}{source_block}\n\n【指示内容】\n{orig_prompt_body}"
    except Exception as e:
        if 'logger' in globals():
            logger.error(f"Error in user_mode prompt enhancement: {e}")

    # safe placeholder replacement: replace {key} with str(ctx[key])
    # IMPORTANT: only replace keys that actually exist in the context dict.
    # Unknown {word} patterns (like LaTeX \begin{document}, \usepackage{fontspec})
    # must be preserved as-is to avoid destroying LaTeX commands in the prompt.
    def _replace_placeholders(s: str, context: dict) -> str:
        def repl(m):
            k = m.group(1)
            if k in context:
                return str(context[k])
            return m.group(0)  # preserve unknown {key} as-is
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


@app.get('/api/latex_presets')
def api_list_latex_presets():
    """Return available LaTeX output format presets."""
    # Hardcoded fallback for SQLite or when DB table doesn't exist
    fallback_presets = [
        {'id': 'exam', 'name': '試験問題', 'description': '定期テスト・入試形式（配点・解答欄付き）'},
        {'id': 'worksheet', 'name': '学習プリント', 'description': '演習用ワークシート（名前欄・日付欄付き）'},
        {'id': 'flashcard', 'name': '一問一答カード', 'description': 'フラッシュカード形式'},
        {'id': 'mock_exam', 'name': '模試', 'description': '模擬試験形式（制限時間・注意事項・大問構成）'},
        {'id': 'report', 'name': 'レポート・解説', 'description': '解説重視のレポート形式'},
        {'id': 'minimal', 'name': 'シンプル', 'description': '最小限のプレーンな形式'},
    ]
    try:
        conn = connect_db()
        if not getattr(conn, '_is_sqlite', False):
            cur = conn.cursor()
            cur.execute("""
                SELECT id, name, description, metadata
                FROM latex_presets
                WHERE is_active = true
                ORDER BY created_at
            """)
            rows = cur.fetchall()
            if rows:
                presets = []
                for r in rows:
                    meta = r[3] or {}
                    if isinstance(meta, str):
                        try:
                            meta = json.loads(meta)
                        except Exception:
                            meta = {}
                    presets.append({'id': r[0], 'name': r[1], 'description': r[2] or '', 'metadata': meta})
                cur.close()
                conn.close()
                return JSONResponse({'presets': presets})
            cur.close()
        conn.close()
    except Exception as e:
        logger.warning('Failed to load latex presets from DB: %s', e)
    return JSONResponse({'presets': fallback_presets})


# ── 科目分類 & モジュラー・プロンプト部品 ────────────────────────────────────
# 科目ごとに数式ルールの要否を判定し、プロンプトを柔軟に構成する。

_STEM_SUBJECTS = frozenset({
    '数学', '数学IA', '数学IIB', '数学III', '数学I', '数学II', '数学A', '数学B', '数学C',
    '物理', '化学', '生物', '情報', '理科',
})
_STEM_KEYWORDS = frozenset({
    '数学', '物理', '化学', '生物', '情報', '理科',
    '微分', '積分', '関数', '方程式', '確率', '統計', 'ベクトル', '行列', '三角関数',
    '電気', '回路', '力学', 'エネルギー', '波動', '原子',
    '二次関数', '指数', '対数', '数列', '極限', '複素数',
    'math', 'physics', 'chemistry', 'biology', 'science',
})
_NON_STEM_SUBJECTS = frozenset({
    '英語', '国語', '社会', '日本史', '世界史', '地理', '公民', '倫理', '政経',
    '現代文', '古文', '漢文', '小論文',
    'english', 'japanese', 'history', 'geography',
})


def _is_stem_subject(subject: str, prompt_text: str = '') -> bool:
    """科目名やプロンプト文から理系（数式が必要）かどうか判定。"""
    if not subject and not prompt_text:
        return True  # 判定不能な場合はSafetyのため数式ルールを含める
    s = (subject or '').strip()
    if s in _STEM_SUBJECTS:
        return True
    if s in _NON_STEM_SUBJECTS:
        return False
    # キーワードマッチ
    combined = (s + ' ' + (prompt_text or '')[:500]).lower()
    for kw in _STEM_KEYWORDS:
        if kw in combined:
            return True
    return False  # デフォルトは非STEM（不要なルールを含めない）


def _is_english_subject(subject: str, prompt_text: str = '') -> bool:
    """科目名やプロンプト文から英語科目かどうか判定。"""
    s = (subject or '').strip().lower()
    if s in ('英語', 'english'):
        return True
    combined = (s + ' ' + (prompt_text or '')[:500]).lower()
    english_keywords = {'英語', 'english', '長文読解', '英作文', 'リスニング', '文法',
                        'reading comprehension', 'grammar', 'vocabulary', 'idiom',
                        '語彙', 'イディオム'}
    for kw in english_keywords:
        if kw in combined:
            return True
    return False


# --- プロンプト部品: コアルール（全科目共通）---
_LATEX_CORE_RULES = (
    "=== LaTeX 出力の基本ルール（全科目共通・厳守） ===\n"
    "1. 出力は LaTeX ソースコードのみ。Markdown (``` 等) や説明文は含めない。\n"
    "2. インライン数式: $...$ を使用。\n"
    "3. ディスプレイ数式: \\[ ... \\] を使用。$$ は使わない。\n"
    "4. align* 等の行末改行は \\\\ のみ。\\\\[2mm] 等の寸法付き改行は使わない。\n"
    "5. パッケージはスケルトンに含まれているものだけ使う。追加しない。\n"
    "6. CJK フォント指定はスケルトンの iftex 分岐に従う。独自のフォント設定は書かない。\n"
    "7. tcolorbox, mdframed, fbox, \\mbox{}, \\hbox{} は使わない。\n"
    "8. 中括弧 {} のバランスを必ず確認する。開き { の数 = 閉じ } の数。\n"
    "9. 装飾用の記号行（===, ---, ***, ~~~ 等）は絶対に出力しない。\n"
    "   区切りには \\vspace{1em} や \\hrulefill を使う。\n"
    "\n"
    "=== ネスト・改行ルール（厳守） ===\n"
    "N1. \\begin{} と \\end{} は必ず対応させる。\n"
    "N2. enumerate, itemize の入れ子は最大 2 階層。\n"
    "N3. 各環境の開始・終了はそれぞれ単独の行に書く。\n"
    "N4. 改行のタイミング:\n"
    "    - 大問と大問: \\vspace{1em}\n"
    "    - 問題文と選択肢: \\vspace{0.5em}\n"
    "    - 本文と問題: \\vspace{1em} + \\noindent\n"
    "N5. インデントはネスト深さに応じて一貫する。\n"
    "\n"
    "=== 数式関数の記述ルール（厳守） ===\n"
    "F1. 三角関数・逆三角関数・双曲線関数・対数等は必ずバックスラッシュ付きで書く:\n"
    "    \\sin, \\cos, \\tan, \\arcsin, \\arccos, \\arctan,\n"
    "    \\sinh, \\cosh, \\tanh, \\log, \\ln, \\exp, \\lim,\n"
    "    \\max, \\min, \\sup, \\inf, \\det, \\gcd, \\deg, \\arg\n"
    "    × 誤: $arctan(x)$  ○ 正: $\\arctan(x)$\n"
    "F2. \\frac{分子}{分母} は必ず分子・分母の両方を記述する。\n"
    "    空の分子 \\frac{}{x} や空の分母 \\frac{x}{} は禁止。\n"
    "\n"
    "=== テキスト折り返し・行間ルール ===\n"
    "W1. 長いテキストは LaTeX の自動折り返しに任せる。\n"
    "W2. \\mbox{}, \\hbox{} でテキストを囲まない。\n"
    "W3. 表のセル幅は p{} で指定し、\\textwidth を超えない。\n"
    "S1. 行間は setspace + \\setstretch{1.3} で設定済み。\n"
)

# --- プロンプト部品: 数式ルール（理系科目のみ追加）---
_LATEX_MATH_RULES = (
    "\n=== 数式の記述ルール（理系科目用） ===\n"
    "M1. 分数: \\frac{分子}{分母}。必ず {分子}{分母} の2つの中括弧を書く。\n"
    "    分子・分母が空の \\frac{}{} は絶対禁止。\n"
    "    入れ子: \\frac{\\frac{a}{b}}{c} のように中括弧を完全に対応。\n"
    "M2. 掛け算: \\times または \\cdot。\n"
    "M3. 根号: \\sqrt{x}。\n"
    "M4. 関数: 必ずバックスラッシュ付き。\n"
    "    \\sin, \\cos, \\tan, \\arcsin, \\arccos, \\arctan,\n"
    "    \\log, \\ln, \\exp, \\lim, \\max, \\min\n"
    "    × 誤: arctan x  ○ 正: \\arctan x\n"
    "M5. 添字2文字以上は中括弧: $x_{10}$, $a_{ij}$\n"
    "M6. 区間は数式内: $[0,1)$, $[a,b]$\n"
)

# --- プロンプト部品: 品質ルール ---
_LATEX_QUALITY_RULES = (
    "\n=== 品質ルール ===\n"
    "Q1. 塾の配布プリントとして使える教材品質で作成する。\n"
    "Q2. 難易度の指示に正確に従う。\n"
)

# --- プロンプト部品: 品質ルール（理系用追加） ---
_LATEX_QUALITY_RULES_STEM = (
    "Q3. 数式の正確性を検算で確認する。計算ミスは許されない。\n"
)

# --- プロンプト部品: 文系科目向け補足 ---
_LATEX_HUMANITIES_HINTS = (
    "\n=== 文系科目向けの注意事項 ===\n"
    "H1. 問題文・解説は自然な日本語で記述する。\n"
    "H2. 数式コマンド（\\frac, \\sqrt 等）は必要な場合のみ使用する。\n"
    "H3. 長文の説明には \\paragraph{} や itemize 環境を活用する。\n"
    "H4. 英語科目の場合、\\textit{} は使わない。英文はそのままローマン体（デフォルト）で記述する。\n"
)

# --- プロンプト部品: 英語科目専用ルール ---
_LATEX_ENGLISH_RULES = (
    "\n=== 英語問題の書式ルール（英語科目の場合厳守） ===\n"
    "E1. 英文は \\textit{} で斜体にしない。ローマン体（\\textrm{} またはそのまま）で記述する。\n"
    "E2. 長文読解問題の構成:\n"
    "    - 本文（英文パッセージ）を先に記述。\n"
    "    - 本文の前後には \\vspace{1em} を入れて問題部分と明確に分離。\n"
    "    - 本文は\u300cNext, read the following passage and answer the questions below.\u300d等の指示文の後に置く。\n"
    "    - 本文は \\begin{quotation} ... \\end{quotation} で囲む。\n"
    "E3. 英文の下線部:\n"
    "    - \\underline{word} を使用。\\textit{} は使わない。\n"
    "E4. 英文問題の解答選択肢:\n"
    "    - \\begin{enumerate}[(A)] または \\begin{enumerate}[(1)] で番号付きリスト。\n"
    "    - 各選択肢は \\item で記述。\n"
    "E5. 和訳問題:\n"
    "    - 英文をそのままローマン体で提示し、「次の英文を日本語に訳しなさい。」のように指示。\n"
    "E6. 英作文問題:\n"
    "    - 日本語の指示文をそのまま記述し、解答欄を \\vspace{3cm} で確保。\n"
    "E7. 問題番号と配点:\n"
    "    - 大問: \\textbf{\\large 問N} または \\section*{問N} で明示。\n"
    "    - 小問: \\begin{enumerate}[(1)]\n"
    "    - 配点: 各問の末尾に [XX点] を記載。\n"
    "E8. レイアウト:\n"
    "    - 問題部分と解答部分を \\newpage で分離。\n"
    "    - 各大問の間に \\vspace{1.5em} を入れる。\n"
)


def _build_latex_instructions(subject: str = '', prompt_text: str = '', struct_rules: str = '',
                               preset_name: str = '', preset_prompt_instr: str = '') -> str:
    """科目・プリセットに応じて最適なLaTeX指示を組み立てる。"""
    is_stem = _is_stem_subject(subject, prompt_text)

    parts = ["【LaTeX 出力ルール】\n以下を守ること。違反するとコンパイルエラーになる。\n"]

    # Core rules (always)
    parts.append(_LATEX_CORE_RULES)

    # Math rules (STEM only)
    if is_stem:
        parts.append(_LATEX_MATH_RULES)
    else:
        parts.append(_LATEX_HUMANITIES_HINTS)

    # English-specific rules
    if _is_english_subject(subject, prompt_text):
        parts.append(_LATEX_ENGLISH_RULES)

    # Structural rules (preset-specific layout)
    if struct_rules:
        parts.append(struct_rules)

    # Quality rules
    parts.append(_LATEX_QUALITY_RULES)
    if is_stem:
        parts.append(_LATEX_QUALITY_RULES_STEM)

    # Preset-specific format instruction
    if preset_prompt_instr:
        parts.append(f"\n=== 出力形式: {preset_name} ===\n{preset_prompt_instr}\n")

    return ''.join(parts)


def _build_groq_system_prompt(subject: str = '', prompt_text: str = '',
                               preset_instr: str = '') -> str:
    """Groq API 用のシステムプロンプトを科目に応じて構築する。"""
    is_stem = _is_stem_subject(subject, prompt_text)

    # 科目に応じた役割記述
    if is_stem:
        role_desc = 'あなたは理系教科の問題を LaTeX 形式で出力する教材作成アシスタントです。'
    else:
        role_desc = 'あなたは教科の問題を LaTeX 形式で出力する教材作成アシスタントです。'

    parts = [
        f'{role_desc}\n'
        '以下のルールを守ってください:\n\n'
    ]

    # Core rules (concise, non-contradictory)
    parts.append(
        '【基本ルール】\n'
        '1. 出力は \\documentclass から \\end{document} までの完全な LaTeX 文書のみ。\n'
        '2. 余分な説明・マークダウン（``` 等）・装飾行（===, --- 等）は出力しない。\n'
        '3. 日本語を含む場合は \\usepackage{iftex} でエンジンを判定し、\n'
        '   PDFTeX なら CJKutf8、LuaTeX なら luatexja、XeTeX なら xeCJK を使用。\n'
        '4. インライン数式は $...$、ディスプレイ数式は \\[...\\]。$$ は使わない。\n'
        '5. tcolorbox, mdframed, fbox, \\mbox{}, \\hbox{} は使わない。\n'
        '6. 中括弧 {} は必ず対応させる。\n'
        '7. \\begin{} / \\end{} は必ず対応。enumerate/itemize の入れ子は最大2階層。\n'
        '8. 大問間は \\vspace{1em}、問題文と選択肢間は \\vspace{0.5em}。\n'
        '9. 長いテキストは LaTeX に折り返しを任せる。\n\n'
    )

    # Math-specific rules (STEM only)
    if is_stem:
        parts.append(
            '【数式ルール（理系科目）】\n'
            '- \\frac{分子}{分母}: 分子・分母は必ず両方記述。空禁止。\n'
            '  入れ子: \\frac{\\frac{a}{b}}{c+d} のように中括弧を完全に対応。\n'
            '- 関数は必ず \\付き: \\sin, \\cos, \\tan, \\arcsin, \\arccos, \\arctan,\n'
            '  \\log, \\ln, \\exp, \\lim, \\max, \\min\n'
            '  × 誤: arctan x  ○ 正: \\arctan x\n'
            '- 積分記号の微分子（dx, dt等）の前にカンマやピリオドを絶対に入れない。\\int ... dx のように書く。\n'
            '- 掛け算: \\times / \\cdot。根号: \\sqrt{x}。\n'
            '- 添字2文字以上は中括弧: $x_{10}$。\n\n'
        )

    # Diagram rules
    parts.append(
        '【図の座標ルール（TikZ 使用時）】\n'
        '- 座標 (x,y) は数値で指定。閉じた図形は cycle で閉じる。\n\n'
    )

    # English-specific rules
    if _is_english_subject(subject, prompt_text):
        parts.append(
            '【英語問題の書式ルール（厳守）】\n'
            '- 英文は斜体にしない（\\textit{} 禁止）。ローマン体で記述。\n'
            '- 設問文（Next, Read the following... など指示文）は必ず \\textbf{\\large ...} で囲み、本文や選択肢と明確に区別すること。\n'
            '- 長文は \\begin{quotation}...\\end{quotation} で囲み、前後に \\vspace{1em}。\n'
            '- \\mbox{}, \\hbox{}, \\fbox{}, tcolorbox, mdframed は使わない。\n'
            '- 自動折り返しに任せる。手動改行(\\\\)で英文を折り返さない。\n'
            '- 下線部: \\underline{word} のみ使用。入れ子禁止:\n'
            '  × \\underline{\\underline{text}} は絶対に書かない\n'
            '  × \\underline{...\\underline{...}...} のようなネストも禁止\n'
            '  ○ \\underline{This is the underlined part} のようにフラットに書く\n'
            '- インデントは最大2段階。enumerate/itemize のネストは最大2階層。\n'
            '  \\begin{enumerate}[(1)] の中にさらに \\begin{enumerate}[(a)] は可。\n'
            '  3階層以上のネストは絶対に行わない。\n'
            '- 選択肢: \\begin{enumerate}[(A)] または \\begin{enumerate}[(1)]。\n'
            '- 問題ページと解答ページは \\newpage で分離。\n\n'
        )

    if preset_instr:
        parts.append(f'{preset_instr}\n')

    return ''.join(parts)


# Fallback preset definitions used when DB is unavailable (SQLite dev or missing table).
# prompt_instruction values mirror 009_add_latex_presets.sql.
_LATEX_PRESET_FALLBACKS: Dict[str, Dict[str, str]] = {
    'exam': {
        'name': '試験問題',
        'prompt_instruction': (
            '■ 構造:\n'
            '- \\section*{問題} の下に \\problem{N} で各問題を番号順に列挙\n'
            '- 各問題文の末尾に配点 [XX点] を明記\n'
            '- 小問: \\begin{enumerate}[(1)] の \\item\n'
            '- \\newpage で問題ページと解答ページを分離\n'
            '- \\section*{解答・解説} の下に \\answer{N} で各解答を記載\n'
            '- 解答には途中式・考え方を含める\n'
        ),
    },
    'worksheet': {
        'name': '学習プリント',
        'prompt_instruction': (
            '■ 構造:\n'
            '- 冒頭に名前欄・日付欄（スケルトンの通り、変更しない）\n'
            '- 問題: \\begin{enumerate}[leftmargin=*] の \\item で番号付きリスト\n'
            '- 各問の後に \\vspace{3cm} で解答スペースを設ける\n'
            '- \\newpage で問題と解答を分離\n'
            '- 解答: \\begin{enumerate} で番号順に記載\n'
            '■ このプリセット固有:\n'
            '- \\problem, \\answer 等の独自コマンドは使わない（enumerate のみ）\n'
        ),
    },
    'flashcard': {
        'name': '一問一答カード',
        'prompt_instruction': (
            '■ longtable の完全なフォーマット（この通りに出力）:\n'
            '\\begin{longtable}{|p{0.47\\textwidth}|p{0.47\\textwidth}|}\n'
            '\\hline\n'
            '\\textbf{問題} & \\textbf{解答} \\\\\n'
            '\\hline\n'
            '\\endfirsthead\n'
            '\\hline\n'
            '\\textbf{問題} & \\textbf{解答} \\\\\n'
            '\\hline\n'
            '\\endhead\n'
            '\\hline\n'
            '\\endlastfoot\n'
            '問題文 & 解答文 \\\\\n'
            '\\hline\n'
            '\\end{longtable}\n'
            '\n'
            '■ ルール:\n'
            '- 左列=問題のみ、右列=解答のみ（混在禁止）\n'
            '- 各行末: \\\\ → 次行に \\hline\n'
            '- セル内の数式: $...$ のみ（\\[...\\] はセル内で使わない）\n'
            '- \\begin{tabular} は使わない（longtable のみ）\n'
            '- \\section, \\newpage, \\problem, \\answer は使わない\n'
        ),
    },
    'mock_exam': {
        'name': '模試',
        'prompt_instruction': (
            '■ 問題ページの構造:\n'
            '1. ヘッダー: {\\Large\\bfseries 模擬試験} \\hfill 制限時間: XX分 \\quad 満点: XX点\n'
            '2. 注意事項: \\begin{itemize} で3〜5項目\n'
            '3. 大問: \\section*{第1問}（XX点）形式\n'
            '   小問: \\begin{enumerate}[(1)] の \\item\n'
            '\n'
            '■ 解答ページの構造:\n'
            '- \\answer{N} で大問ごとに区切り\n'
            '- 配点内訳・採点基準を明記\n'
            '- 途中式・考え方を詳述\n'
        ),
    },
    'report': {
        'name': 'レポート・解説',
        'prompt_instruction': (
            '■ 問題ページ: \\problem{N} で各問題を列挙（問題文のみ）\n'
            '\n'
            '■ 解説ページ: 各問につき以下の3部構成:\n'
            '  \\answer{N}\n'
            '  \\paragraph{解法} 途中計算を step-by-step で。align* で式を揃える。\n'
            '  \\paragraph{ポイント} \\begin{itemize} で箇条書き。\n'
        ),
    },
    'minimal': {
        'name': 'シンプル',
        'prompt_instruction': (
            '■ 構造:\n'
            '- 問題: \\begin{enumerate}[leftmargin=*] の \\item で番号付きリスト\n'
            '- 解答: \\section*{解答} の下に \\begin{enumerate} で番号順\n'
            '- 独自コマンド（\\problem, \\answer）は使わない\n'
            '- 装飾なし・最小限の構成\n'
        ),
    },
}


# ── 図表パッケージカタログ ───────────────────────────────────────────────────
# extra_packages パラメータで指定できるパッケージの定義。
# usepackage: LaTeXプリアンブルに挿入するコマンド列
# prompt_hint: LLMへのプロンプトに追加する使い方の説明
DIAGRAM_PACKAGES: Dict[str, Dict[str, str]] = {
    'tikz': {
        'name': 'TikZ（図形・図解）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usetikzlibrary{arrows.meta,positioning,calc,shapes.geometric,patterns}'
        ),
        'prompt_hint': (
            'TikZ が利用可能。\\begin{tikzpicture}...\\end{tikzpicture} で図を描く。\n'
            '【厳密な座標計算ルール — 必ず守ること】\n'
            '1. すべてのノード・描画に明示的な座標 (x,y) を cm 単位で指定する。相対配置 (right=of ...) だけに頼らない。\n'
            '2. 閉じた図形（多角形・閉領域）は最後に -- cycle を付けるか、始点の座標に正確に戻る。\n'
            '3. 座標計算の検算: 直角三角形なら三平方の定理、正三角形なら辺の長さが同じか確認。\n'
            '4. \\draw (0,0) -- (3,0) -- (3,4) -- cycle; のように閉路を明記。\n'
            '5. ノード間の配線では、接続元と接続先の座標が一致しているか必ず確認する。\n'
            '6. 座標の一覧表を先にコメントで書いてから描画コードを書く（例: % A=(0,0), B=(3,0), C=(3,4)）。\n'
        ),
    },
    'circuitikz': {
        'name': 'CircuiTikZ（回路図）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usepackage[siunitx]{circuitikz}'
        ),
        'prompt_hint': (
            'CircuiTikZ が利用可能。\\begin{circuitikz}...\\end{circuitikz} で電気回路図を描く。\n'
            '素子: 抵抗 to[R,l=$R$], コンデンサ to[C,l=$C$], インダクタ to[L,l=$L$], '
            '電圧源 to[V,l=$V$], 電流源 to[I,l=$I$], ダイオード to[D]。\n'
            '配線は -- で接続し、ノードラベルは node[above]{ラベル} で付ける。\n\n'
            '【回路図の厳密な座標計算ルール — 必ず守ること】\n'
            '1. ★閉回路の保証★: 回路は必ず閉じたループを形成すること。\n'
            '   最後の配線の終点座標は、始点の座標と正確に一致しなければならない。\n'
            '2. 正確な座標を使い、各配線パスの (始点) to[素子] (終点) で始点と終点を明記。\n'
            '3. 配線例（閉回路の直列RLC回路）:\n'
            '   \\draw (0,0) to[V,l=$E$] (0,3)  % 左辺: 上昇\n'
            '         to[R,l=$R$] (3,3)          % 上辺: 右へ\n'
            '         to[C,l=$C$] (3,0)          % 右辺: 下降\n'
            '         -- (0,0);                   % 下辺: 始点に戻る（閉回路完成）\n'
            '4. 並列回路は分岐点の座標を明確にし、各枝の上端・下端座標を一致させる。\n'
            '5. 接地記号: node[ground]{} を使用する場合も座標を明記。\n'
            '6. 描画前にまず座標一覧をコメントで書く:\n'
            '   % ノード座標: A=(0,0), B=(0,3), C=(3,3), D=(3,0)\n'
            '   % パス: A→B (電圧源), B→C (抵抗), C→D (コンデンサ), D→A (配線)\n'
            '7. 座標が矩形ならば y座標・x座標がそれぞれ揃っているか確認:\n'
            '   左辺は x=0 で統一、右辺は x=3 で統一、上辺は y=3 で統一、下辺は y=0 で統一。\n'
        ),
    },
    'pgfplots': {
        'name': 'PGFPlots（グラフ・関数プロット）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usepackage{pgfplots}\n'
            '\\pgfplotsset{compat=1.18}'
        ),
        'prompt_hint': (
            'PGFPlots が利用可能。\\begin{tikzpicture}\\begin{axis}[...options...]...\\end{axis}\\end{tikzpicture} でグラフを描く。'
            '関数プロット: \\addplot[domain=-3:3,samples=100,blue]{x^2};'
            'データプロット: \\addplot coordinates {(0,0)(1,1)(2,4)};'
            'axis options: xlabel={$x$}, ylabel={$y$}, xmin=-3, xmax=3, grid=both 等。'
        ),
    },
    'tikz-cd': {
        'name': 'TikZ-CD（可換図式）',
        'usepackage': (
            '\\usepackage{tikz-cd}'
        ),
        'prompt_hint': (
            'TikZ-CD が利用可能。\\begin{tikzcd}...\\end{tikzcd} で可換図式を描く。'
            '例: A \\arrow[r, "f"] \\arrow[d, "g"] & B \\arrow[d, "h"] \\\\ C \\arrow[r, "k"] & D'
        ),
    },
    'forest': {
        'name': 'Forest（樹形図・確率の木）',
        'usepackage': (
            '\\usepackage{forest}'
        ),
        'prompt_hint': (
            'Forest が利用可能。\\begin{forest}...\\end{forest} で樹形図を描く。'
            '例: [ROOT [A [C][D]] [B [E][F]]]'
            '確率の樹形図: edge label={node[midway,left]{$p$}} 等でラベルを付ける。'
        ),
    },
    'listings': {
        'name': 'Listings（ソースコード表示）',
        'usepackage': (
            '\\usepackage{listings}\n'
            '\\usepackage{xcolor}\n'
            '\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,'
            'frame=single,numbers=left,numberstyle=\\tiny,'
            'keywordstyle=\\color{blue}\\bfseries,'
            'commentstyle=\\color{gray}\\itshape,'
            'stringstyle=\\color{orange}}'
        ),
        'prompt_hint': (
            'Listings が利用可能。\\begin{lstlisting}[language=Python]...\\end{lstlisting} でコードを表示。'
            'language には Python, Java, C, JavaScript, SQL, bash 等が指定できる。'
            '行番号は lstset で設定済み。インラインコードは \\lstinline|code| で記述。'
        ),
    },
    'tabularx': {
        'name': 'Tabularx（自動幅調整表）',
        'usepackage': (
            '\\usepackage{tabularx}\n'
            '\\usepackage{booktabs}'
        ),
        'prompt_hint': (
            'Tabularx が利用可能。\\begin{tabularx}{\\linewidth}{l X r} で幅を自動調整した表を作る。'
            'X 列は残り幅を自動配分。booktabs も有効: \\toprule, \\midrule, \\bottomrule で罫線を引く。'
        ),
    },
}


def _load_latex_preset(preset_id: str) -> Optional[Dict[str, Any]]:
    """Load a single LaTeX preset from DB (PostgreSQL or SQLite), with fallback to built-in definitions.

    Returns dict with keys: preamble, document_wrapper, prompt_instruction, name.
    Never returns None — falls back to _LATEX_PRESET_FALLBACKS.
    """
    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT preamble, document_wrapper, prompt_instruction, name
            FROM latex_presets
            WHERE id = %s AND is_active
        """, (preset_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {
                'preamble': row[0],
                'document_wrapper': row[1],
                'prompt_instruction': row[2],
                'name': row[3],
            }
    except Exception as e:
        logger.warning('Failed to load latex preset %s from DB, using fallback: %s', preset_id, e)
    # Fallback: built-in definitions (works in SQLite dev, Neon without migration 009, etc.)
    return _LATEX_PRESET_FALLBACKS.get(preset_id) or _LATEX_PRESET_FALLBACKS['exam']


@app.get('/api/fields')
def api_list_fields():
    """Return available fields for filtering, grouped by subject."""
    try:
        conn = connect_db()
        cur = conn.cursor()
        if not getattr(conn, '_is_sqlite', False):
            cur.execute("""
                SELECT f.id, f.field_code, f.subject, f.field_name,
                       COUNT(p.id) as problem_count
                FROM fields f
                LEFT JOIN problems p ON p.field_id = f.id
                WHERE f.is_active = true
                GROUP BY f.id, f.field_code, f.subject, f.field_name
                ORDER BY f.subject, f.field_name
            """)
            rows = cur.fetchall()
            fields = [
                {'id': r[0], 'code': r[1], 'subject': r[2], 'name': r[3], 'problem_count': r[4]}
                for r in rows
            ]
        else:
            # SQLite fallback: use subject/topic from problems
            cur.execute("""
                SELECT subject, topic, COUNT(*) as cnt
                FROM problems
                WHERE subject IS NOT NULL AND subject != ''
                GROUP BY subject, topic
                ORDER BY subject, topic
            """)
            rows = cur.fetchall()
            fields = [
                {'id': i + 1, 'code': f"{r[0]}_{r[1] or 'general'}", 'subject': r[0],
                 'name': r[1] if r[1] else r[0] + '（全般）', 'problem_count': r[2]}
                for i, r in enumerate(rows)
            ]
        cur.close()
        conn.close()
        return JSONResponse({'fields': fields})
    except Exception as e:
        logger.warning('Failed to load fields: %s', e)
        return JSONResponse({'fields': []})


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
    # Load templates on first startup (moved from module-level to avoid boot timeout)
    _ensure_templates()

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


# ── Groq Cloud LLM → PDF ワンクリック生成 ──────────────────────────
class LlmGenerateRequest(BaseModel):
    prompt: str
    latex_preset: Optional[str] = 'exam'
    title: Optional[str] = 'Generated Problems'
    extra_packages: Optional[List[str]] = []
    subject: Optional[str] = ''
    field: Optional[str] = ''


@app.post('/api/generate_with_llm')
def generate_with_llm(req: LlmGenerateRequest = Body(...)):
    """Call Groq Cloud (Llama 3.3 70B) to generate LaTeX from a prompt, then compile to PDF.

    Returns JSON with keys: latex (raw LaTeX), pdf_url (if compilation succeeded), error (if any).
    """
    groq_key = os.getenv('GROQ_API_KEY')
    if not groq_key:
        return JSONResponse({'error': 'GROQ_API_KEY が設定されていません。.env に GROQ_API_KEY を追加してください。'}, status_code=500)

    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail='prompt is required')

    groq_model = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')

    # Load latex preset to build format-specific system instruction
    preset_id = req.latex_preset or 'exam'
    preset_data = _load_latex_preset(preset_id)
    preset_name = preset_data.get('name', preset_id) if preset_data else preset_id
    preset_instr = preset_data.get('prompt_instruction', '') if preset_data else ''

    # Build system instruction for LaTeX generation (subject-aware)
    system_instruction = _build_groq_system_prompt(
        subject=req.subject or '',
        prompt_text=req.prompt,
        preset_instr=preset_instr,
    )

    # Append extra package usage hints so Groq knows what's available
    extra_pkgs = req.extra_packages or []
    if extra_pkgs:
        system_instruction += '\n【利用可能な追加パッケージ（プリアンブルに既に追加済み）】\n'
        for pkg_id in extra_pkgs:
            pkg_def = DIAGRAM_PACKAGES.get(pkg_id)
            if pkg_def:
                system_instruction += f'- {pkg_def["name"]}: {pkg_def["prompt_hint"]}\n'
            else:
                system_instruction += f'- \\usepackage{{{pkg_id}}} が利用可能。\n'

    # Call Groq Cloud API (OpenAI-compatible)
    groq_url = 'https://api.groq.com/openai/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {groq_key}',
    }
    groq_payload = {
        'model': groq_model,
        'messages': [
            {'role': 'system', 'content': system_instruction},
            {'role': 'user', 'content': req.prompt},
        ],
        'temperature': 0.3,
        'max_tokens': 8192,
    }

    resp = None
    try:
        resp = requests.post(
            groq_url,
            headers=headers,
            json=groq_payload,
            timeout=120
        )
        resp.raise_for_status()
        body = resp.json()
    except requests.exceptions.Timeout:
        return JSONResponse({'error': 'Groq API がタイムアウトしました。再度お試しください。'}, status_code=504)
    except requests.exceptions.RequestException as e:
        logger.exception('Groq API call failed')
        error_detail = str(e)
        try:
            if resp is not None:
                error_body = resp.json()
                error_detail = error_body.get('error', {}).get('message', str(e))
        except Exception:
            pass
        return JSONResponse({'error': f'Groq API エラー: {error_detail}'}, status_code=502)

    # Extract text from Groq response (OpenAI format)
    try:
        choices = body.get('choices', [])
        if not choices:
            return JSONResponse({'error': 'Groq からの応答が空です', 'raw': body}, status_code=500)
        raw_text = choices[0].get('message', {}).get('content', '').strip()
    except Exception as e:
        return JSONResponse({'error': f'Groq レスポンスの解析に失敗: {e}', 'raw': body}, status_code=500)

    if not raw_text:
        return JSONResponse({'error': 'Groq からのテキスト出力が空です'}, status_code=500)

    # Strip markdown code fences if present
    latex_text = raw_text
    if latex_text.startswith('```'):
        lines = latex_text.split('\n')
        # Remove first line (```latex or ```) and last line (```)
        if lines[-1].strip() == '```':
            lines = lines[1:-1]
        elif lines[0].strip().startswith('```'):
            lines = lines[1:]
        latex_text = '\n'.join(lines).strip()

    # Also strip markdown fences that appear mid-stream (e.g. ```latex ... ```)
    latex_text = re.sub(r'^```(?:latex|tex)?\s*$', '', latex_text, flags=re.MULTILINE)
    latex_text = re.sub(r'^```\s*$', '', latex_text, flags=re.MULTILINE)
    latex_text = latex_text.strip()

    # Pre-sanitize the LLM output before passing to generate_pdf:
    # 1) Unescape JSON-escaped sequences (if the LLM produced literal \n etc.)
    try:
        latex_text = _unescape_latex(latex_text)
    except Exception:
        pass
    # 2) Collapse internal newlines that split math tokens
    try:
        latex_text = _collapse_internal_newlines(latex_text)
    except Exception:
        pass
    # 3) Strip LLM preamble/postamble text around the LaTeX document
    #    (e.g. "Here is the LaTeX code:" before \documentclass)
    dc_match = re.search(r'\\documentclass', latex_text)
    if dc_match and dc_match.start() > 0:
        before_dc = latex_text[:dc_match.start()]
        # If text before \documentclass is not LaTeX (no backslash commands), strip it
        if not re.search(r'\\[a-zA-Z]', before_dc):
            latex_text = latex_text[dc_match.start():]
    # Strip text after \end{document}
    end_doc_match = re.search(r'\\end\{document\}', latex_text)
    if end_doc_match:
        latex_text = latex_text[:end_doc_match.end()]

    # Now compile LaTeX to PDF via the existing generate_pdf infrastructure
    # We reuse the same logic by calling the endpoint internally
    try:
        from fastapi.testclient import TestClient
        internal = TestClient(app)
        pdf_resp = internal.post('/api/generate_pdf', json={
            'latex': latex_text,
            'title': req.title or 'Generated Problems',
            'return_url': True,
        })
        pdf_data = pdf_resp.json() if pdf_resp.headers.get('content-type', '').startswith('application/json') else {}
    except Exception as e:
        logger.exception('Internal PDF generation failed')
        pdf_data = {'error': f'PDF 生成失敗: {e}'}

    result = {
        'latex': latex_text,
        'pdf_url': pdf_data.get('pdf_url'),
        'pdf_error': pdf_data.get('error'),
        'model': groq_model,
    }
    return JSONResponse(result)


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
            "\\usepackage{setspace}\n"
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
            "\\setstretch{1.3}\n"
            "\\maketitle\n"
        )
        header = header.replace('__TITLE__', title.replace('%', '%%'))

        def _auto_wrap_inline_math(blob: str) -> str:
            """Best-effort: wrap math-like fragments with $...$ if missing.

            Avoid touching lines that already contain math delimiters or LaTeX environments.
            For lines with Japanese text, we use a smarter heuristic that detects
            actual math expressions rather than naively wrapping every ASCII token.
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
                # If line has Japanese text, wrap only genuine math-like expressions
                # (not plain English words or short labels)
                has_ja = re.search(r'[ぁ-んァ-ン一-龥]', line)
                if has_ja:
                    # Strategy: find contiguous math-like fragments that contain
                    # at least one operator/relation/command, and wrap those.
                    # This avoids wrapping plain words like "Point", "ra", "the" etc.
                    def _maybe_wrap_token(m):
                        tok = m.group(0)
                        # Only wrap if the token contains a math indicator:
                        # operator (+,-,*,/,=,^,_), digit+operator combo,
                        # or LaTeX command (\frac, \sqrt, etc.)
                        has_math = re.search(
                            r'[=\+\-\*/\^_<>]|'    # operators / relations
                            r'\d.*[+\-*/=^]|'        # digit followed by operator
                            r'[+\-*/=^].*\d|'        # operator followed by digit
                            r'\\[a-zA-Z]|'           # LaTeX command
                            r'\d+\.\d+|'             # decimal numbers
                            r'[a-zA-Z]\d|'           # variable with subscript-like: x2
                            r'\d[a-zA-Z]',           # 2x
                            tok
                        )
                        if has_math:
                            return f'${tok}$'
                        return tok
                    return re.sub(
                        r'([A-Za-z0-9\\\(\)\[\]\+\-\*/=\^_\.,]+(?:\s*[A-Za-z0-9\\\(\)\[\]\+\-\*/=\^_\.,]+)*)',
                        _maybe_wrap_token, line
                    )
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

            Key fix: we first protect inline-math spans ($...$) with
            placeholders so that constructs like ``$[0,\\infty)$`` don't
            interfere with our bracket-matching regex (previously the ``[``
            inside ``$[0,\\infty)$`` would match all the way to a display-math
            ``]``, and the inner ``$`` would cause the block to be skipped).
            """
            if not isinstance(blob, str) or not blob.strip():
                return blob

            # --- Phase 1: protect inline math $...$ with placeholders ---
            _inline_stash = []
            def _stash_inline(m):
                _inline_stash.append(m.group(0))
                return f"__ILMATH{len(_inline_stash)-1}__"
            # Match non-greedy $...$ (no embedded newlines to avoid matching
            # across paragraphs; ignore escaped \$).
            protected = re.sub(r'(?<!\\)\$([^\$\n]*?)(?<!\\)\$', _stash_inline, blob)

            # --- Phase 2: convert bare bracket display math ---
            def _repl(m):
                inner = m.group(1)
                # Skip option brackets attached to LaTeX commands:
                # e.g. \documentclass[...], \usepackage[...], \setlist[...]
                prefix = protected[:m.start()]
                if re.search(r"\\[A-Za-z]+\*?\s*$", prefix):
                    return m.group(0)
                # Also skip option brackets after closing braces (e.g. \begin{enumerate}[...])
                if re.search(r"\}\s*$", prefix):
                    return m.group(0)
                # Skip empty brackets or very short content that looks like list labels
                stripped = inner.strip()
                if len(stripped) < 2:
                    return m.group(0)
                # Skip if content contains a placeholder (bracket spans inline math boundary)
                if '__ILMATH' in inner:
                    return m.group(0)
                # Skip enumitem / list option arguments (label=, ref=, start=, etc.)
                if re.search(r'label\s*=|ref\s*=|start\s*=|\\arabic|\\roman|\\alph|\\Roman|\\Alph', stripped):
                    return m.group(0)
                # Skip title=... option arguments for tcolorbox etc.
                if re.search(r'title\s*=', stripped):
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
                    return '\\[' + '\n' + stripped + '\n' + '\\]'
                return m.group(0)

            # Match [ ... ] blocks that span one or more lines.
            # Use a non-greedy match but allow newlines.
            result = re.sub(r"(?<![\\A-Za-z])\[\s*([\s\S]*?)\s*\]", _repl, protected)

            # --- Phase 3: restore inline math placeholders ---
            for i, orig in enumerate(_inline_stash):
                result = result.replace(f"__ILMATH{i}__", orig)

            return result

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

            # 0a) ★ Remove duplicate \\documentclass ★
            #     If the header is already prepended AND the LLM also output its own
            #     \\documentclass, we end up with two preambles. Keep only the first.
            dc_matches = list(re.finditer(r'\\documentclass', tex))
            if len(dc_matches) > 1:
                # Keep everything from the FIRST \documentclass.
                # Find the second \documentclass and its \begin{document}
                second_dc = dc_matches[1].start()
                first_begin_doc = tex.find('\\begin{document}')
                if first_begin_doc >= 0 and first_begin_doc < second_dc:
                    # The first preamble is complete; the second is redundant.
                    # Find second \begin{document} and keep only the body from it
                    second_begin_doc = tex.find('\\begin{document}', second_dc)
                    if second_begin_doc >= 0:
                        # Remove everything between first \begin{document}\n...second \begin{document}
                        # i.e. keep: first preamble + first \begin{document} + content after second \begin{document}
                        after_first_begin = first_begin_doc + len('\\begin{document}')
                        after_second_begin = second_begin_doc + len('\\begin{document}')
                        tex = tex[:after_first_begin] + tex[after_second_begin:]

            # 0b) ★ Convert $$ ... $$ display math to \\[ ... \\] ★
            #     $$ is deprecated/problematic in LaTeX; convert to \\[...\\]
            tex = re.sub(r'\$\$([\s\S]*?)\$\$', r'\\[\1\\]', tex)

            # 0c) ★ Convert \\( ... \\) to $ ... $ ★
            #     \\(...\\) is valid LaTeX but some engines/packages handle it
            #     poorly; normalize to $...$
            tex = re.sub(r'\\\((.*?)\\\)', r'$\1$', tex, flags=re.S)

            # 0d) ★ Fix stray backslash-letter sequences that aren't real commands ★
            #     LLMs sometimes produce \Ra, \Le etc. that aren't real commands.
            #     Map common wrong ones to correct commands.
            typo_cmds = {
                r'\\Ra\b': r'\\Rightarrow',
                r'\\La\b': r'\\Leftarrow',
                r'\\ra\b': r'\\rightarrow',
                r'\\la\b': r'\\leftarrow',
                r'\\mark\b': r'\\checkmark',
                r'\\del\b': r'\\partial',
            }
            for pat, repl in typo_cmds.items():
                tex = re.sub(pat, repl, tex)

            # 0e) ★ Remove decorative separator lines ★
            #     LLMs sometimes generate lines of ===, ---, ***, ~~~ etc.
            #     as section dividers. These are not valid LaTeX and break compilation.
            #     Remove lines that are mostly repeated =, -, *, ~ (5+ chars).
            tex = re.sub(r'^\s*[=]{5,}\s*$', '', tex, flags=re.MULTILINE)
            tex = re.sub(r'^\s*[-]{5,}\s*$', '', tex, flags=re.MULTILINE)
            tex = re.sub(r'^\s*[*]{5,}\s*$', '', tex, flags=re.MULTILINE)
            tex = re.sub(r'^\s*[~]{5,}\s*$', '', tex, flags=re.MULTILINE)
            tex = re.sub(r'^\s*[_]{5,}\s*$', '', tex, flags=re.MULTILINE)
            # Also remove inline decorative runs (e.g. "===問題===" → "問題")
            tex = re.sub(r'={3,}', '', tex)
            tex = re.sub(r'-{5,}', '', tex)

            # 0f) ★ Convert plain-text math functions to LaTeX commands ★
            #     LLMs sometimes write "arctan", "arcsin" etc. as plain text
            #     instead of \arctan, \arcsin. Fix inside math mode.
            _math_funcs = {
                'arctan': r'\\arctan',
                'arcsin': r'\\arcsin',
                'arccos': r'\\arccos',
                'sinh': r'\\sinh',
                'cosh': r'\\cosh',
                'tanh': r'\\tanh',
                'log': r'\\log',
                'ln': r'\\ln',
                'exp': r'\\exp',
                'sin': r'\\sin',
                'cos': r'\\cos',
                'tan': r'\\tan',
                'sec': r'\\sec',
                'csc': r'\\csc',
                'cot': r'\\cot',
                'lim': r'\\lim',
                'max': r'\\max',
                'min': r'\\min',
                'sup': r'\\sup',
                'inf': r'\\inf',
                'det': r'\\det',
                'gcd': r'\\gcd',
                'deg': r'\\deg',
                'dim': r'\\dim',
                'ker': r'\\ker',
                'hom': r'\\hom',
                'arg': r'\\arg',
            }
            # Process math environments to convert plain-text function names.
            # Match inside $...$ and \[...\] and math envs (align*, equation*, gather*).
            def _fix_math_functions_in_segment(seg):
                """Replace plain math function names with backslash commands in a math segment."""
                result = seg
                for func_name, latex_cmd in _math_funcs.items():
                    # Match the function name NOT preceded by a backslash
                    # and followed by typical math patterns: (, {, ^, _, space, digit
                    result = re.sub(
                        r'(?<!\\)\b' + func_name + r'(?=\s*[\({^_\d\\]|\s*$)',
                        latex_cmd, result
                    )
                return result

            # Fix in inline math $...$
            tex = re.sub(
                r'(?<!\$)\$(?!\$)(.*?)\$(?!\$)',
                lambda m: '$' + _fix_math_functions_in_segment(m.group(1)) + '$',
                tex
            )
            # Fix in display math \[...\]
            tex = re.sub(
                r'\\\[(.*?)\\\]',
                lambda m: '\\[' + _fix_math_functions_in_segment(m.group(1)) + '\\]',
                tex, flags=re.S
            )
            # Fix in align*, equation*, gather* environments
            for env_name in ('align', 'align*', 'equation', 'equation*', 'gather', 'gather*', 'multline', 'multline*'):
                env_esc = re.escape(env_name)
                tex = re.sub(
                    r'(\\begin\{' + env_esc + r'\})(.*?)(\\end\{' + env_esc + r'\})',
                    lambda m: m.group(1) + _fix_math_functions_in_segment(m.group(2)) + m.group(3),
                    tex, flags=re.S
                )

            # 0g) ★ Fix empty fraction numerators/denominators ★
            #     \frac{}{denominator} → remove the broken fraction, keep denominator
            #     \frac{numerator}{} → remove the broken fraction, keep numerator
            #     \frac{}{} → remove entirely
            tex = re.sub(r'\\d?frac\s*\{\s*\}\s*\{\s*\}', '', tex)  # \frac{}{} → empty
            tex = re.sub(r'\\d?frac\s*\{\s*\}\s*\{([^}]+)\}', r'\1', tex)  # \frac{}{x} → x
            tex = re.sub(r'\\d?frac\s*\{([^}]+)\}\s*\{\s*\}', r'\1', tex)  # \frac{x}{} → x

            # 0h) ★ Remove \mbox{} and \hbox{} wrapping around text ★
            #     These prevent line-wrapping. Convert \mbox{content} → content.
            #     Use brace-counting to handle nested braces correctly.
            def _unwrap_box(tex_str, cmd):
                """Remove \\mbox{...} or \\hbox{...} keeping content."""
                result = []
                pat = '\\' + cmd + '{'
                i = 0
                n = len(tex_str)
                while i < n:
                    if tex_str[i:i+len(pat)] == pat:
                        j = i + len(pat)
                        depth = 1
                        while j < n and depth > 0:
                            if tex_str[j] == '{' and (j == 0 or tex_str[j-1] != '\\'):
                                depth += 1
                            elif tex_str[j] == '}' and (j == 0 or tex_str[j-1] != '\\'):
                                depth -= 1
                            j += 1
                        inner = tex_str[i+len(pat):j-1]
                        result.append(inner)
                        i = j
                    else:
                        result.append(tex_str[i])
                        i += 1
                return ''.join(result)
            tex = _unwrap_box(tex, 'mbox')
            tex = _unwrap_box(tex, 'hbox')
            tex = re.sub(r'\\usepackage(\[[^\]]*\])?\{unicode-math\}\s*\n?', '', tex)

            # 0i) ★ Flatten nested \underline ★
            #     \underline{\underline{text}} → \underline{text}
            #     Also handles deeper nesting by iterating
            for _ in range(5):
                prev = tex
                tex = re.sub(
                    r'\\underline\{((?:[^{}]|\{[^{}]*\})*?)\\underline\{((?:[^{}]|\{[^{}]*\})*?)\}((?:[^{}]|\{[^{}]*\})*?)\}',
                    r'\\underline{\1\2\3}',
                    tex
                )
                if tex == prev:
                    break

            # 0j) ★ Remove \textit wrapping around English text ★
            #     English exam problems should NOT use italic for body text.
            #     \textit{some english text} → some english text
            #     Only unwrap when the content looks like English (ASCII-dominant).
            def _unwrap_textit(m):
                inner = m.group(1)
                # Only unwrap if content is mostly ASCII (English text)
                ascii_count = sum(1 for c in inner if ord(c) < 128)
                if len(inner) > 0 and ascii_count / len(inner) > 0.7:
                    return inner
                return m.group(0)  # Keep for non-English text
            tex = re.sub(
                r'\\textit\{((?:[^{}]|\{[^{}]*\})*?)\}',
                _unwrap_textit, tex
            )

            # 0k) ★ Limit enumerate/itemize nesting depth ★
            #     Count nesting depth of enumerate/itemize environments and
            #     remove the innermost begin/end when depth exceeds 2.
            def _limit_list_nesting(tex_str, max_depth=2):
                """Remove list environments nested deeper than max_depth."""
                lines = tex_str.split('\n')
                result = []
                depth = 0
                skip_depth = None
                for line in lines:
                    stripped = line.strip()
                    # Check for \begin{enumerate} or \begin{itemize}
                    begin_match = re.match(r'^\s*\\begin\{(enumerate|itemize)\}', stripped)
                    end_match = re.match(r'^\s*\\end\{(enumerate|itemize)\}', stripped)
                    if begin_match:
                        depth += 1
                        if depth > max_depth:
                            if skip_depth is None:
                                skip_depth = depth
                            continue  # Skip this \begin
                        result.append(line)
                    elif end_match:
                        if skip_depth is not None and depth >= skip_depth:
                            depth -= 1
                            if depth < skip_depth:
                                skip_depth = None
                            continue  # Skip this \end
                        depth -= 1
                        result.append(line)
                    else:
                        result.append(line)
                return '\n'.join(result)
            tex = _limit_list_nesting(tex)

            # 0y) ★ 積分の dx 前のカンマ・ピリオド混入を修正 ★
            #   \int ... , dx → \int ... \,dx （数式環境内のみ）
            def _fix_integral_comma(seg):
                """Remove stray comma/period before differential dx/dt/dy in math."""
                return re.sub(r',\s*(d[xtysuvw])\b', r' \\,\1', seg)
            # inline math $...$
            tex = re.sub(
                r'(?<!\$)\$(?!\$)(.*?)\$(?!\$)',
                lambda m: '$' + _fix_integral_comma(m.group(1)) + '$',
                tex
            )
            # display math \[...\]
            tex = re.sub(
                r'\\\[(.*?)\\\]',
                lambda m: '\\[' + _fix_integral_comma(m.group(1)) + '\\]',
                tex, flags=re.S
            )
            # align*, equation*, gather* environments
            for _env_name_y in ('align', 'align*', 'equation', 'equation*', 'gather', 'gather*', 'multline', 'multline*'):
                _env_esc_y = re.escape(_env_name_y)
                tex = re.sub(
                    r'(\\begin\{' + _env_esc_y + r'\})(.*?)(\\end\{' + _env_esc_y + r'\})',
                    lambda m: m.group(1) + _fix_integral_comma(m.group(2)) + m.group(3),
                    tex, flags=re.S
                )

            # 0z) ★ 英語設問文の自動強調 ★
            #   Next, Read the following... など指示文を \textbf{\large ...} で囲む
            def _emphasize_english_instructions(text):
                _instr_patterns = [
                    r'^(Next,\s.+)$',
                    r'^(Read the following .+)$',
                    r'^(Answer the following .+)$',
                    r'^(Choose the (?:best|correct|most) .+)$',
                    r'^(Which of the following .+)$',
                    r'^(Select the .+)$',
                    r'^(Write your answer .+)$',
                    r'^(Fill in .+)$',
                    r'^(Complete the .+)$',
                    r'^(Translate the following .+)$',
                    r'^(Look at the .+)$',
                ]
                lines = text.split('\n')
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if not stripped or stripped.startswith('\\'):
                        continue
                    for pat in _instr_patterns:
                        m = re.match(pat, stripped)
                        if m and '\\textbf' not in line:
                            lines[i] = '\\textbf{\\large ' + stripped + '}'
                            break
                return '\n'.join(lines)
            tex = _emphasize_english_instructions(tex)

            # 2) Remove \usepackage{CJKutf8} and CJK environment wrappers (XeLaTeX incompatible)
            tex = re.sub(r'\\usepackage(\[[^\]]*\])?\{CJKutf8\}\s*\n?', '', tex)
            tex = re.sub(r'\\begin\{CJK\}\{[^}]*\}\{[^}]*\}\s*\n?', '', tex)
            tex = re.sub(r'\\end\{CJK\}\s*\n?', '', tex)

            # 3) Remove \IfFontExistsTF blocks (replace with just the first choice)
            #    Pattern: \IfFontExistsTF{Font}{TrueBody}{FalseBody}
            def _simplify_iffont(m):
                true_body = m.group(1)
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

            # 4) Extract and remove ALL \setmainfont / \setCJKmainfont / \setmainjfont
            #    lines from their current positions. We will re-insert them in
            #    the correct position (after fontspec/xeCJK, before \begin{document}).
            tex = re.sub(r'\\setmainfont\{[^}]*\}\s*\n?', '', tex)
            tex = re.sub(r'\\setCJKmainfont\{[^}]*\}\s*\n?', '', tex)
            tex = re.sub(r'\\setmainjfont\{[^}]*\}\s*\n?', '', tex)
            tex = re.sub(r'\\setsansfont\{[^}]*\}\s*\n?', '', tex)

            # 5) Ensure fontspec and xeCJK are present (add if missing).
            #    fontspec MUST be loaded before xeCJK. Remove any existing
            #    fontspec/xeCJK declarations and re-insert them in the correct
            #    order right before \begin{document}.
            tex = re.sub(r'\\usepackage(\[[^\]]*\])?\{fontspec\}\s*\n?', '', tex)
            tex = re.sub(r'\\usepackage(\[[^\]]*\])?\{xeCJK\}\s*\n?', '', tex)
            if '\\begin{document}' in tex:
                font_preamble = '\\usepackage{fontspec}\n\\usepackage{xeCJK}\n'
                tex = tex.replace('\\begin{document}', font_preamble + '\\begin{document}')

            # 6) Insert safe CJK font declaration right before \begin{document}
            #    Use \IfFontExistsTF so it works on any OS.
            safe_font_block = (
                '\\IfFontExistsTF{Hiragino Mincho ProN}'
                '{\\setCJKmainfont{Hiragino Mincho ProN}}'
                '{\\IfFontExistsTF{IPAexMincho}'
                '{\\setCJKmainfont{IPAexMincho}}'
                '{\\IfFontExistsTF{Noto Serif CJK JP}'
                '{\\setCJKmainfont{Noto Serif CJK JP}}'
                '{}}}\n'
            )
            if '\\setCJKmainfont' not in tex and '\\begin{document}' in tex:
                tex = tex.replace('\\begin{document}', safe_font_block + '\\begin{document}')

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
                # Check if this is an option arg line (preceded by a command or closing brace)
                if i > 0 and stripped.startswith('['):
                    prev = (result_lines[-1] if result_lines else '').rstrip()
                    if re.search(r'\\[A-Za-z]+\*?\s*$', prev) or prev.endswith('}'):
                        result_lines.append(line)
                        continue

                # Skip lines that contain option args on the same line as a command
                # e.g. \begin{enumerate}[label=\arabic*.]
                if re.search(r'\\[A-Za-z]+\*?(\{[^}]*\})?\[', stripped):
                    result_lines.append(line)
                    continue

                # Skip [ that is inside inline math $...$
                # Count unescaped $ before the first [ in the line;
                # if odd, the [ is inside inline math (e.g. $[0,1)$)
                if stripped.startswith('[') and not in_bare_math:
                    # Check the cumulative $ parity from all previous lines
                    preceding_text = '\n'.join(result_lines)
                    dollar_count = len(re.findall(r'(?<!\\)\$', preceding_text))
                    if dollar_count % 2 == 1:
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
                        # Skip enumitem/list option patterns
                        if re.search(r'label\s*=|ref\s*=|start\s*=|\\arabic|\\roman|\\alph|\\Roman|\\Alph', inner):
                            result_lines.append(line)
                            continue
                        # Skip if line contains $ (likely interval inside inline math)
                        if '$' in line:
                            result_lines.append(line)
                            continue
                        # Check it looks like math (has =, ^, _, \, digits with operators)
                        if re.search(r'[=^_\\]|\d.*[+\-*/]', inner):
                            result_lines.append(f'{indent}\\[ {inner} \\]')
                            continue

                result_lines.append(line)

            tex = '\n'.join(result_lines)

            # 7) Fix \\[2mm] style line breaks in align/gather environments
            #    Convert \\[<dimension>] to just \\ inside math environments
            tex = re.sub(r'\\\\(\[[\d.]+(?:mm|ex|pt|em|cm)\])', r'\\\\', tex)

            # 7b) Fix common \frac breakage from LLM output
            #  a) \frac followed by bare single chars without braces: \frac 1 2 → \frac{1}{2}
            tex = re.sub(r'\\frac\s+([A-Za-z0-9])\s+([A-Za-z0-9])', r'\\frac{\1}{\2}', tex)
            tex = re.sub(r'\\dfrac\s+([A-Za-z0-9])\s+([A-Za-z0-9])', r'\\dfrac{\1}{\2}', tex)
            #  b) \frac with first arg braced but second bare: \frac{a} b → \frac{a}{b}
            tex = re.sub(r'\\frac\{([^}]*)\}\s+([A-Za-z0-9])\b', r'\\frac{\1}{\2}', tex)
            tex = re.sub(r'\\dfrac\{([^}]*)\}\s+([A-Za-z0-9])\b', r'\\dfrac{\1}{\2}', tex)
            #  b2) \frac with slash inside single braces: \frac{1/2} → \frac{1}{2}
            tex = re.sub(r'\\frac\{(\w+)/(\w+)\}(?!\s*\{)', r'\\frac{\1}{\2}', tex)
            tex = re.sub(r'\\dfrac\{(\w+)/(\w+)\}(?!\s*\{)', r'\\dfrac{\1}{\2}', tex)
            #  b3) \frac with only one brace group (missing second): \frac{a} → \frac{a}{1}
            #      Only when followed by whitespace/newline/end, not by {
            tex = re.sub(r'\\frac\{([^}]+)\}\s*(?=[^{\\]|$)', r'\\frac{\1}{1}', tex)
            #  b4) Bare \frac without any braces followed by expressions: \frac ab → \frac{a}{b}
            tex = re.sub(r'\\frac\s+(\{[^}]+\}|[A-Za-z0-9])\s*(\{[^}]+\}|[A-Za-z0-9])', 
                         lambda m: '\\frac' + (m.group(1) if m.group(1).startswith('{') else '{'+m.group(1)+'}') + (m.group(2) if m.group(2).startswith('{') else '{'+m.group(2)+'}'), tex)
            tex = re.sub(r'\\dfrac\s+(\{[^}]+\}|[A-Za-z0-9])\s*(\{[^}]+\}|[A-Za-z0-9])', 
                         lambda m: '\\dfrac' + (m.group(1) if m.group(1).startswith('{') else '{'+m.group(1)+'}') + (m.group(2) if m.group(2).startswith('{') else '{'+m.group(2)+'}'), tex)

            # 7c) ★ Robust nested fraction brace fixer ★
            #     Walk through the tex and find every \frac or \dfrac, then
            #     ensure it's followed by exactly two brace-delimited groups.
            #     If braces are mismatched (nested \frac inside), repair them.
            def _fix_nested_fractions(tex_str):
                """Parse \frac / \dfrac commands and ensure each has exactly two
                properly balanced brace-delimited arguments {num}{den}.
                This handles nested fracs that simple regex cannot correctly process."""
                result = []
                i = 0
                n = len(tex_str)
                while i < n:
                    # Look for \frac or \dfrac
                    if tex_str[i] == '\\' and i + 1 < n:
                        # Check for \frac or \dfrac
                        rest = tex_str[i:]
                        m = re.match(r'\\(d?frac)\b', rest)
                        if m:
                            cmd = m.group(0)  # \frac or \dfrac
                            j = i + len(cmd)
                            # skip whitespace after command
                            while j < n and tex_str[j] in ' \t\n\r':
                                j += 1
                            # Extract two brace groups
                            args = []
                            for _arg_idx in range(2):
                                while j < n and tex_str[j] in ' \t\n\r':
                                    j += 1
                                if j < n and tex_str[j] == '{':
                                    # Match balanced braces
                                    depth = 0
                                    start = j
                                    while j < n:
                                        if tex_str[j] == '{' and (j == 0 or tex_str[j-1] != '\\'):
                                            depth += 1
                                        elif tex_str[j] == '}' and (j == 0 or tex_str[j-1] != '\\'):
                                            depth -= 1
                                            if depth == 0:
                                                args.append(tex_str[start:j+1])
                                                j += 1
                                                break
                                        j += 1
                                    else:
                                        # Reached end without closing brace — add missing }
                                        args.append(tex_str[start:] + '}')
                                        j = n
                                elif j < n and tex_str[j] not in '\\{}':
                                    # Bare character: wrap in braces
                                    args.append('{' + tex_str[j] + '}')
                                    j += 1
                                else:
                                    # Missing argument — insert {1} as placeholder
                                    args.append('{1}')
                            # Ensure we have exactly 2 args
                            while len(args) < 2:
                                args.append('{1}')
                            result.append(cmd + args[0] + args[1])
                            i = j
                            continue
                    result.append(tex_str[i])
                    i += 1
                return ''.join(result)

            tex = _fix_nested_fractions(tex)

            # 7d) Slash fractions in math mode: convert a/b patterns to \frac{a}{b}
            #     Only inside math environments ($...$, \[...\], align, etc.)
            def _fix_slash_fractions(tex_str):
                """Convert common slash fractions to \\frac inside math contexts."""
                def _replace_in_math(m):
                    content = m.group(0)
                    # Replace patterns like 1/2, a/b (single tokens) — not URL-like paths
                    content = re.sub(
                        r'(?<![/\\A-Za-z])(\d+)\s*/\s*(\d+)(?![/\d])',
                        r'\\frac{\1}{\2}', content
                    )
                    # Replace single-letter/single-letter: a/b, x/y
                    content = re.sub(
                        r'(?<![/\\])([A-Za-z])\s*/\s*([A-Za-z0-9])(?![/])',
                        r'\\frac{\1}{\2}', content
                    )
                    # Replace (expr)/(expr)
                    content = re.sub(
                        r'\(([^()]+)\)\s*/\s*\(([^()]+)\)',
                        r'\\frac{\1}{\2}', content
                    )
                    return content

                # Process inline math $...$
                tex_str = re.sub(r'(?<!\\)\$([^$]+)\$', _replace_in_math, tex_str)
                # Process display math \[...\]
                tex_str = re.sub(r'\\\[(.+?)\\\]', _replace_in_math, tex_str, flags=re.S)
                # Process align/aligned/gather environments
                tex_str = re.sub(
                    r'(\\begin\{(?:align\*?|aligned|gather\*?|equation\*?)\})(.*?)(\\end\{(?:align\*?|aligned|gather\*?|equation\*?)\})',
                    lambda m: m.group(1) + _replace_in_math(type('M', (), {'group': lambda self, n=0: m.group(2)})()) + m.group(3),
                    tex_str, flags=re.S
                )
                return tex_str
            tex = _fix_slash_fractions(tex)

            # 7e) ★ Final nested fraction brace balance audit ★
            #     After all frac fixes, do a final pass to ensure every \frac / \dfrac
            #     has balanced braces within its arguments.
            def _audit_frac_braces(tex_str):
                """Final audit: for each \\frac/\\dfrac, verify that the two brace-groups
                are individually balanced. If not, insert missing closing braces."""
                result = []
                i = 0
                n = len(tex_str)
                while i < n:
                    if tex_str[i] == '\\' and i + 1 < n:
                        m = re.match(r'\\(d?frac)\b', tex_str[i:])
                        if m:
                            cmd = m.group(0)
                            j = i + len(cmd)
                            # Skip whitespace
                            while j < n and tex_str[j] in ' \t\n\r':
                                j += 1
                            # Read two brace groups and balance them
                            for _k in range(2):
                                while j < n and tex_str[j] in ' \t\n\r':
                                    j += 1
                                if j < n and tex_str[j] == '{':
                                    depth = 0
                                    start = j
                                    while j < n:
                                        c = tex_str[j]
                                        if c == '{' and (j == start or tex_str[j-1] != '\\'):
                                            depth += 1
                                        elif c == '}' and (j == 0 or tex_str[j-1] != '\\'):
                                            depth -= 1
                                            if depth == 0:
                                                j += 1
                                                break
                                        j += 1
                                    # If we exhausted the string without finding closing
                                    # brace, this means braces are unbalanced
                                elif j < n:
                                    j += 1  # bare char
                            result.append(tex_str[i:j])
                            # Check brace balance in what we just appended
                            segment = tex_str[i:j]
                            opens = segment.count('{')
                            closes = segment.count('}')
                            if opens > closes:
                                result.append('}' * (opens - closes))
                            i = j
                            continue
                    result.append(tex_str[i])
                    i += 1
                return ''.join(result)

            tex = _audit_frac_braces(tex)

            # 7f) ★ CircuiTikZ closed-loop fixer ★
            #     Detect circuitikz environments and ensure paths form closed loops.
            #     If the last coordinate doesn't return to the first, append -- (first_coord).
            def _fix_circuitikz_closed_loops(tex_str):
                """For each \\begin{circuitikz}...\\end{circuitikz}, ensure \\draw paths
                that start and end at different coordinates are closed by appending the
                starting coordinate at the end."""
                pattern = r'(\\begin\{circuitikz\}(?:\[.*?\])?)([\s\S]*?)(\\end\{circuitikz\})'

                def _fix_env(m):
                    begin = m.group(1)
                    body = m.group(2)
                    end = m.group(3)

                    # Find all \draw commands in the body
                    # Each \draw ... ;  is a separate path
                    draw_pattern = r'(\\draw\b[^;]*;)'
                    def _fix_draw(dm):
                        draw_cmd = dm.group(1)
                        # Extract all coordinates (x,y) from the draw command
                        coords = re.findall(r'\(([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\)', draw_cmd)
                        if len(coords) < 2:
                            return draw_cmd
                        first = coords[0]
                        last = coords[-1]
                        # Check if the path already closes (last coord == first coord or has 'cycle')
                        if 'cycle' in draw_cmd:
                            return draw_cmd
                        try:
                            fx, fy = float(first[0]), float(first[1])
                            lx, ly = float(last[0]), float(last[1])
                        except (ValueError, IndexError):
                            return draw_cmd

                        # If the path has circuit elements (to[...]) it's likely meant to be
                        # a closed circuit. Check if first != last.
                        has_circuit_elements = bool(re.search(r'to\s*\[', draw_cmd))
                        if not has_circuit_elements:
                            return draw_cmd

                        # If first and last are different, the circuit is open — close it
                        if abs(fx - lx) > 0.01 or abs(fy - ly) > 0.01:
                            # Insert -- (first_x, first_y) before the semicolon
                            close_str = f' -- ({first[0]},{first[1]})'
                            # Find the last semicolon
                            idx = draw_cmd.rfind(';')
                            if idx >= 0:
                                draw_cmd = draw_cmd[:idx] + close_str + draw_cmd[idx:]
                        return draw_cmd

                    body = re.sub(draw_pattern, _fix_draw, body, flags=re.S)
                    return begin + body + end

                return re.sub(pattern, _fix_env, tex_str, flags=re.S)

            tex = _fix_circuitikz_closed_loops(tex)

            # 7g) ★ TikZ coordinate consistency checker ★
            #     For tikzpicture environments, verify that paths using -- connect
            #     declared/used coordinates consistently. Fix common issue of
            #     disconnected segments by ensuring node names used in paths exist.
            def _fix_tikz_coordinate_closure(tex_str):
                """For \\begin{tikzpicture}...\\end{tikzpicture}, ensure \\draw paths
                that appear to be closed shapes (polygons, etc.) actually close.
                Detect paths with -- cycle or paths that should close but don't."""
                pattern = r'(\\begin\{tikzpicture\}(?:\[.*?\])?)([\s\S]*?)(\\end\{tikzpicture\})'

                def _fix_tikz_env(m):
                    begin = m.group(1)
                    body = m.group(2)
                    end = m.group(3)

                    draw_pattern = r'(\\draw\b[^;]*;)'
                    def _fix_draw_path(dm):
                        draw_cmd = dm.group(1)
                        # Already has cycle — skip
                        if 'cycle' in draw_cmd:
                            return draw_cmd
                        # Extract numeric coordinates
                        coords = re.findall(r'\(([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\)', draw_cmd)
                        if len(coords) < 3:  # Need at least 3 points for a polygon
                            return draw_cmd
                        first = coords[0]
                        last = coords[-1]
                        try:
                            fx, fy = float(first[0]), float(first[1])
                            lx, ly = float(last[0]), float(last[1])
                        except (ValueError, IndexError):
                            return draw_cmd
                        # If the path has 3+ points, looks like it connects most of them
                        # with --, and ends close to the start (within 2cm), it's probably
                        # meant to be closed but the LLM forgot to close it.
                        double_dash_count = len(re.findall(r'--', draw_cmd))
                        if double_dash_count >= 2:
                            distance = ((fx - lx)**2 + (fy - ly)**2) ** 0.5
                            # If points differ and distance is reasonable, close the path
                            if distance > 0.01 and distance < 10:
                                idx = draw_cmd.rfind(';')
                                if idx >= 0:
                                    draw_cmd = draw_cmd[:idx] + ' -- cycle' + draw_cmd[idx:]
                        return draw_cmd

                    body = re.sub(draw_pattern, _fix_draw_path, body, flags=re.S)
                    return begin + body + end

                return re.sub(pattern, _fix_tikz_env, tex_str, flags=re.S)

            tex = _fix_tikz_coordinate_closure(tex)

            # 7h) ★ Indentation normalizer for LaTeX environments ★
            #     Re-indent \begin{...} / \end{...} blocks with consistent
            #     2-space indent per nesting level. This makes the source
            #     cleaner and helps catch mismatched environments.
            def _normalize_indentation(tex_str):
                """Normalize indentation of LaTeX environments.

                Lines between \\begin{...} and \\end{...} are indented by
                2 spaces per nesting level. Content INSIDE the preamble
                (before \\begin{document}) is left as-is. Only the document
                body is re-indented.
                """
                # Find the body start
                doc_start = tex_str.find('\\begin{document}')
                if doc_start < 0:
                    return tex_str  # No document body to indent

                # Find end of \begin{document} line
                after_doc_start = tex_str.find('\n', doc_start)
                if after_doc_start < 0:
                    return tex_str

                preamble = tex_str[:after_doc_start + 1]
                body = tex_str[after_doc_start + 1:]

                lines = body.split('\n')
                result = []
                depth = 0
                INDENT = '  '
                # Environments that should not be re-indented internally
                # (their content is whitespace-sensitive)
                verbatim_envs = {'verbatim', 'lstlisting', 'minted', 'Verbatim'}
                in_verbatim = False
                verbatim_env_name = None

                for line in lines:
                    stripped = line.strip()

                    # Handle verbatim environments — pass through as-is
                    if in_verbatim:
                        result.append(line)
                        if re.match(rf'\\end\{{{re.escape(verbatim_env_name)}\}}', stripped):
                            in_verbatim = False
                            verbatim_env_name = None
                        continue

                    # Check for verbatim environment start
                    vm = re.match(r'\\begin\{(\w+)\}', stripped)
                    if vm and vm.group(1) in verbatim_envs:
                        result.append(INDENT * depth + stripped)
                        in_verbatim = True
                        verbatim_env_name = vm.group(1)
                        continue

                    # Empty lines: pass through
                    if not stripped:
                        result.append('')
                        continue

                    # \end{...} decreases depth BEFORE this line
                    if stripped.startswith('\\end{'):
                        depth = max(0, depth - 1)
                        result.append(INDENT * depth + stripped)
                        continue

                    # Normal line: add current indent
                    result.append(INDENT * depth + stripped)

                    # \begin{...} increases depth AFTER this line
                    if stripped.startswith('\\begin{') and not stripped.startswith('\\begin{document}'):
                        depth += 1

                return preamble + '\n'.join(result)

            tex = _normalize_indentation(tex)

            # 7i) ★ Strip raw LLM artifacts ★
            #     LLMs sometimes include non-LaTeX text like "Here is the LaTeX:",
            #     "```latex", explanatory comments in natural language outside of
            #     %-comments, or stray markdown. Remove them.
            def _strip_llm_artifacts(tex_str):
                """Remove common LLM artifacts that aren't valid LaTeX."""
                # Remove any remaining markdown code fences
                tex_str = re.sub(r'^```(?:latex|tex)?\s*$', '', tex_str, flags=re.MULTILINE)
                tex_str = re.sub(r'^```\s*$', '', tex_str, flags=re.MULTILINE)

                # Remove common LLM preamble/postamble text OUTSIDE document body
                doc_start = tex_str.find('\\begin{document}')
                if doc_start >= 0:
                    before = tex_str[:doc_start]
                    # Remove lines before \documentclass that look like natural language
                    dc_pos = before.find('\\documentclass')
                    if dc_pos > 0:
                        pre_dc = before[:dc_pos]
                        # Keep only lines that start with % (comments) or are empty
                        cleaned_lines = []
                        for ln in pre_dc.split('\n'):
                            s = ln.strip()
                            if not s or s.startswith('%') or s.startswith('\\'):
                                cleaned_lines.append(ln)
                            # else: discard natural language line
                        tex_str = '\n'.join(cleaned_lines) + before[dc_pos:] + tex_str[doc_start:]

                # Remove text after \end{document} (except %GEN_VALIDATION blocks)
                end_doc = tex_str.rfind('\\end{document}')
                if end_doc >= 0:
                    after = tex_str[end_doc + len('\\end{document}'):]
                    # Keep %GEN_VALIDATION blocks
                    val_match = re.search(r'(%GEN_VALIDATION:.*?%GEN_VALIDATION: END)', after, re.S)
                    kept = ''
                    if val_match:
                        kept = '\n' + val_match.group(1)
                    tex_str = tex_str[:end_doc] + kept + '\n\\end{document}'

                return tex_str

            tex = _strip_llm_artifacts(tex)

            # 7j-pre) ★ Fix \textit for English exam text ★
            #     LLMs often wrap English sentences in \textit{} making them italic.
            #     For English exam/problem documents, English text should be in
            #     roman (upright) style, not italic. Convert \textit{text} → text
            #     when the content is primarily English prose (not short emphasis).
            def _fix_english_italic(tex_str):
                """Convert \\textit{...} to plain text when content is English prose."""
                def _replace_textit(m):
                    inner = m.group(1)
                    # Keep \textit for very short content (likely intentional emphasis)
                    if len(inner.strip()) < 5:
                        return m.group(0)
                    # Check if content is primarily English/ASCII
                    ascii_ratio = sum(1 for c in inner if c.isascii()) / max(len(inner), 1)
                    if ascii_ratio > 0.7:
                        # English prose — remove italic
                        return inner
                    return m.group(0)

                # Match \textit{...} with balanced braces
                result = []
                i = 0
                n = len(tex_str)
                textit_pat = '\\textit{'
                while i < n:
                    if tex_str[i:i+len(textit_pat)] == textit_pat:
                        # Find matching closing brace
                        j = i + len(textit_pat)
                        depth = 1
                        while j < n and depth > 0:
                            if tex_str[j] == '{' and (j == 0 or tex_str[j-1] != '\\'):
                                depth += 1
                            elif tex_str[j] == '}' and (j == 0 or tex_str[j-1] != '\\'):
                                depth -= 1
                            j += 1
                        inner = tex_str[i+len(textit_pat):j-1]
                        # Check if this is English prose
                        if len(inner.strip()) >= 5:
                            ascii_ratio = sum(1 for c in inner if c.isascii()) / max(len(inner), 1)
                            if ascii_ratio > 0.7:
                                result.append(inner)
                            else:
                                result.append(tex_str[i:j])
                        else:
                            result.append(tex_str[i:j])
                        i = j
                    else:
                        result.append(tex_str[i])
                        i += 1
                return ''.join(result)

            tex = _fix_english_italic(tex)

            # 7j) ★ Environment nesting validator ★
            #     Verify all \begin{env} / \end{env} are properly nested.
            #     Fix common issues: misordered ends, missing ends, duplicate ends.
            def _validate_env_nesting(tex_str):
                """Validate and repair environment nesting.

                - Remove orphan \\end{env} that have no matching \\begin{env}
                - Add missing \\end{env} for unclosed environments (before \\end{document})
                """
                # Build a list of (position, 'begin'|'end', env_name, full_match)
                token_re = re.compile(r'\\(begin|end)\{([^}]+)\}')
                tokens = [(m.start(), m.group(1), m.group(2), m.group(0)) for m in token_re.finditer(tex_str)]

                stack = []
                orphan_ends = []  # positions of \end{...} to remove

                for pos, kind, env, full in tokens:
                    if kind == 'begin':
                        stack.append((pos, env))
                    else:  # end
                        if stack and stack[-1][1] == env:
                            stack.pop()
                        elif stack:
                            # Check if there's a matching begin deeper in the stack
                            # (indicates a missing \end for an inner environment)
                            found = False
                            for idx in range(len(stack) - 1, -1, -1):
                                if stack[idx][1] == env:
                                    # Pop everything above it (those are unclosed)
                                    # and the matching begin
                                    for _ in range(len(stack) - 1 - idx):
                                        stack.pop()
                                    stack.pop()
                                    found = True
                                    break
                            if not found:
                                orphan_ends.append((pos, full))
                        else:
                            orphan_ends.append((pos, full))

                # Remove orphan \end{...} (process in reverse to preserve positions)
                result = tex_str
                for pos, full in reversed(orphan_ends):
                    # Remove the orphan \end{env} and its trailing newline if any
                    end_pos = pos + len(full)
                    if end_pos < len(result) and result[end_pos] == '\n':
                        end_pos += 1
                    result = result[:pos] + result[end_pos:]

                # Add missing \end{env} for unclosed environments
                if stack:
                    # Find position right before \end{document}
                    end_doc = result.rfind('\\end{document}')
                    insert_pos = end_doc if end_doc >= 0 else len(result)
                    missing = '\n'.join(f'\\end{{{env}}}' for _, env in reversed(stack))
                    result = result[:insert_pos] + '\n' + missing + '\n' + result[insert_pos:]

                return result

            tex = _validate_env_nesting(tex)

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
        #
        # CLOUD_LATEX_ONLY=1 or running on Render (RENDER=true): skip local
        # engine and use cloud compilation (latex.ytotech.com).
        # Render free tier (512 MB) cannot run xelatex without OOM kill.
        _cloud_only = (
            os.environ.get('CLOUD_LATEX_ONLY', '').strip() in ('1', 'true', 'yes')
            or os.environ.get('RENDER', '').strip().lower() in ('true', '1', 'yes')
        )
        engine = None
        engine_name = None
        if not _cloud_only:
            for cand in ('xelatex', 'lualatex', 'pdflatex'):
                path = shutil.which(cand)
                if path:
                    engine = path
                    engine_name = cand
                    break
        else:
            logger.info('Cloud-only mode (CLOUD_LATEX_ONLY or RENDER detected) – skipping local engine')

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

        # ── Helper: cloud compilation via latex.ytotech.com ──
        def _try_cloud_compilation(body_tex: str) -> 'Response | None':
            """Attempt cloud LaTeX compilation. Returns a Response on success, None on failure."""
            logger.info('Attempting cloud compilation via latex.ytotech.com...')
            try:
                cloud_resp = requests.post(
                    'https://latex.ytotech.com/builds/sync',
                    json={
                        'compiler': 'xelatex',
                        'resources': [{'main': True, 'content': body_tex}],
                    },
                    timeout=60,
                )
                if cloud_resp.status_code in (200, 201) and cloud_resp.headers.get('Content-Type', '').startswith('application/pdf'):
                    with open(pdf_path, 'wb') as pf:
                        pf.write(cloud_resp.content)
                    logger.info('Cloud LaTeX compilation succeeded (%d bytes)', len(cloud_resp.content))
                    return None  # signal success – pdf_path is now populated
                else:
                    cloud_err = cloud_resp.text[:1000] if cloud_resp.text else 'empty response'
                    logger.error('Cloud LaTeX failed: status=%s body=%s', cloud_resp.status_code, cloud_err)
                    return JSONResponse(
                        {'error': 'cloud_latex_failed', 'detail': cloud_err},
                        status_code=500,
                    )
            except Exception as cloud_exc:
                logger.exception('Cloud LaTeX request failed')
                return JSONResponse(
                    {'error': 'cloud_latex_failed',
                     'detail': f'クラウドコンパイルに失敗しました: {cloud_exc}'},
                    status_code=500,
                )

        if engine is None:
            # No local LaTeX engine – try cloud compilation via latex.ytotech.com API
            logger.info('No local LaTeX engine found. Using cloud compilation...')
            cloud_result = _try_cloud_compilation(fixed_body)
            if cloud_result is not None:
                # cloud failed – return the error
                shutil.rmtree(td, ignore_errors=True)
                return cloud_result
            # cloud succeeded – pdf_path is populated, skip local subprocess
        else:
            # ── Local LaTeX compilation ──
            try:
                logger.info('Running LaTeX engine: %s on %s', engine_name, tex_path)
                subprocess.run([engine_name, '-interaction=nonstopmode', '-halt-on-error', '-output-directory', td, tex_path], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
                logger.info('LaTeX engine finished; checking PDF at %s', pdf_path)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
                out = getattr(e, 'stdout', b'') or b''
                err = getattr(e, 'stderr', b'') or b''
                if isinstance(out, bytes): out = out.decode('utf-8', errors='ignore')
                if isinstance(err, bytes): err = err.decode('utf-8', errors='ignore')
                # Log the last 30 lines of xelatex output for debugging
                out_lines = out.strip().split('\n')
                logger.error('LaTeX compilation failed (engine=%s). Last 30 lines of output:\n%s', engine_name, '\n'.join(out_lines[-30:]))
                if err.strip():
                    logger.error('LaTeX stderr: %s', err.strip()[-500:])
                # Also log the first error line for quick diagnosis
                for line in out_lines:
                    if line.strip().startswith('!'):
                        logger.error('LaTeX error: %s', line.strip())
                        break

                # ── Fallback: try cloud compilation when local engine fails ──
                logger.info('Local LaTeX engine failed; falling back to cloud compilation...')
                cloud_result = _try_cloud_compilation(fixed_body)
                if cloud_result is not None:
                    # cloud also failed – return the cloud error
                    shutil.rmtree(td, ignore_errors=True)
                    return cloud_result
                # cloud succeeded – pdf_path is populated, continue to serve it
                logger.info('Cloud fallback succeeded after local %s failure', engine_name)
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

    # Run Python verification BEFORE DB insert
    verification_results = []
    try:
        from backend.llm_helpers import verify_answer
        for it in generated:
            if isinstance(it, dict) and it.get('verification_code'):
                vr = verify_answer(it)
                verification_results.append(vr)
            else:
                verification_results.append({'skipped': True})
    except Exception:
        logger.exception('verification failed')

    # Only insert items that passed verification (verified=True or skipped=True)
    inserted_ids = []
    rejected_indices = []
    if req.auto_insert and generated:
        try:
            conn = connect_db()
            from workers.ingest.ingest import insert_problem
            for idx, it in enumerate(generated):
                vr = verification_results[idx] if idx < len(verification_results) else {'skipped': True}
                # Block insert if verification ran and failed
                if not vr.get('skipped') and not vr.get('verified'):
                    rejected_indices.append(idx)
                    logger.info(f'Problem #{idx} rejected: verification mismatch (expected={vr.get("expected")}, computed={vr.get("computed")})')
                    continue
                try:
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

    return JSONResponse({
        'generated': generated,
        'raw': raw,
        'errors': errors or [],
        'inserted_ids': inserted_ids,
        'verification': verification_results,
        'rejected_indices': rejected_indices,
    })


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
    """Load templates from DB (PostgreSQL) first, then fallback to templates.json.

    DB storage ensures templates survive deploys on Render.
    """
    global TEMPLATES
    TEMPLATES = {}

    # --- Try DB first (SQLite and PostgreSQL) ---
    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, description, prompt, metadata
            FROM templates
            WHERE is_active
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        for row in rows:
            meta = row[4] or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            TEMPLATES[row[0]] = {
                'name': row[1],
                'description': row[2],
                'prompt': row[3],
                'metadata': meta,
            }
        cur.close()
        conn.close()
        if TEMPLATES:
            return TEMPLATES
    except Exception as e:
        logger.warning('Failed to load templates from DB, falling back to JSON: %s', e)

    # --- Fallback: load from JSON file ---
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
    TEMPLATES = {}
    return TEMPLATES


def _seed_templates_to_db():
    """On startup, import templates.json into DB if templates table is empty.

    Works for both SQLite (dev) and PostgreSQL (prod).
    """
    try:
        conn = connect_db()
        is_sqlite = getattr(conn, '_is_sqlite', False)
        cur = conn.cursor()

        # Ensure templates table exists regardless of DB type.
        # Migration 008 may not have been applied to Neon/PostgreSQL (it's only
        # auto-applied in Docker via docker-entrypoint-initdb.d).
        if is_sqlite:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT '',
                    description TEXT,
                    prompt TEXT NOT NULL DEFAULT '',
                    metadata TEXT DEFAULT '{}',
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT '',
                    description TEXT,
                    prompt TEXT NOT NULL DEFAULT '',
                    metadata JSONB DEFAULT '{}',
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)
            """)
        conn.commit()

        cur.execute("SELECT COUNT(*) FROM templates")
        count = cur.fetchone()[0]
        if count > 0:
            cur.close()
            conn.close()
            return
        # Load from JSON
        json_path = os.path.join(THIS_DIR, 'templates.json')
        if not os.path.exists(json_path):
            json_path = os.path.join(PROJECT_ROOT, 'backend', 'templates.json')
        if not os.path.exists(json_path):
            cur.close()
            conn.close()
            return
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for tid, tdata in data.items():
            if is_sqlite:
                cur.execute("""
                    INSERT OR IGNORE INTO templates (id, name, description, prompt, metadata)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    tid,
                    tdata.get('name', ''),
                    tdata.get('description', ''),
                    tdata.get('prompt', ''),
                    json.dumps(tdata.get('metadata', {}), ensure_ascii=False),
                ))
            else:
                cur.execute("""
                    INSERT INTO templates (id, name, description, prompt, metadata)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    tid,
                    tdata.get('name', ''),
                    tdata.get('description', ''),
                    tdata.get('prompt', ''),
                    json.dumps(tdata.get('metadata', {}), ensure_ascii=False),
                ))
        conn.commit()
        cur.close()
        conn.close()
        logger.info('Seeded %d templates from JSON to DB', len(data))
    except Exception as e:
        logger.warning('Failed to seed templates to DB: %s', e)

# Load templates lazily on first request or at startup event
# (NOT at import time — avoids DB connections during module load which can
#  cause worker boot timeouts on constrained environments like Render free tier)
_templates_loaded = False

def _ensure_templates():
    global _templates_loaded
    if _templates_loaded:
        return
    _templates_loaded = True
    try:
        _seed_templates_to_db()
    except Exception:
        pass
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
    _ensure_templates()
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
    """Save or update a template. Persists to DB (PostgreSQL) and JSON file as backup."""
    if not req.id or not isinstance(req.id, str):
        return JSONResponse({'error': 'invalid_id'}, status_code=400)
    try:
        # --- Save to DB (SQLite and PostgreSQL) ---
        db_saved = False
        try:
            conn = connect_db()
            is_sqlite = getattr(conn, '_is_sqlite', False)
            cur = conn.cursor()
            if is_sqlite:
                cur.execute("""
                    INSERT OR REPLACE INTO templates
                        (id, name, description, prompt, metadata, is_active, updated_at)
                    VALUES (%s, %s, %s, %s, %s, 1, datetime('now'))
                """, (
                    req.id,
                    req.name or '',
                    req.description or '',
                    req.prompt or '',
                    json.dumps(req.metadata or {}, ensure_ascii=False),
                ))
            else:
                cur.execute("""
                    INSERT INTO templates (id, name, description, prompt, metadata, updated_at)
                    VALUES (%s, %s, %s, %s, %s, now())
                    ON CONFLICT (id) DO UPDATE SET
                        name = COALESCE(EXCLUDED.name, templates.name),
                        description = COALESCE(EXCLUDED.description, templates.description),
                        prompt = COALESCE(EXCLUDED.prompt, templates.prompt),
                        metadata = COALESCE(EXCLUDED.metadata, templates.metadata),
                        updated_at = now()
                """, (
                    req.id,
                    req.name or '',
                    req.description or '',
                    req.prompt or '',
                    json.dumps(req.metadata or {}, ensure_ascii=False),
                ))
            conn.commit()
            cur.close()
            conn.close()
            db_saved = True
        except Exception as e:
            logger.warning('Failed to save template to DB: %s', e)

        # --- Also save to JSON file as backup ---
        tpls = _load_templates() or {}
        tpls = dict(tpls)
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

        target = os.path.join(THIS_DIR, 'templates.json')
        try:
            if os.path.exists(target):
                bak = target + '.bak'
                shutil.copyfile(target, bak)
        except Exception:
            logger.exception('Failed to backup templates.json')
        try:
            with open(target, 'w', encoding='utf-8') as f:
                json.dump(tpls, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.exception('Failed to write templates.json')
            if not db_saved:
                return _dev_error_response('failed_to_write_templates', e, status_code=500)

        globals()['TEMPLATES'] = tpls
        return JSONResponse({'saved': True, 'id': req.id, 'db_saved': db_saved})
    except Exception as e:
        logger.exception('failed to save template')
        return _dev_error_response('template_save_failed', e, status_code=500)