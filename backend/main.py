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
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse, FileResponse, Response
from pydantic import BaseModel
from io import BytesIO
import sys
import tempfile
import asyncio
import time
import httpx

# ensure project root is on sys.path so top-level imports like `workers` work
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load .env file (project root or backend dir) before anything else
try:
    from dotenv import load_dotenv
    # Try backend dir first, then project root
    _env_path = os.path.join(THIS_DIR, '.env')
    if not os.path.exists(_env_path):
        _env_path = os.path.join(PROJECT_ROOT, '.env')
    load_dotenv(_env_path, override=False)
except ImportError:
    pass  # python-dotenv not installed; rely on OS env vars

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

# ── Rate Limiting ──────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
except ImportError:
    # slowapi not installed — skip rate limiting
    limiter = None
    logger.warning('slowapi not installed; rate limiting disabled')

# ── Auth Middleware (protect non-public routes) ────
try:
    from backend.auth import _jwt_verify
except Exception:
    try:
        from auth import _jwt_verify  # type: ignore
    except Exception:
        _jwt_verify = None

# Public paths that don't require authentication
_PUBLIC_PATHS = {
    '/health', '/api/auth/register', '/api/auth/login', '/api/auth/refresh',
    '/api/templates', '/api/latex_presets', '/api/fields',
}
_PUBLIC_PREFIXES = ('/api/auth/', '/api/generated_pdf/', '/docs', '/openapi.json', '/redoc')

# Auth enforcement is opt-in: set REQUIRE_AUTH=true in production
_REQUIRE_AUTH = os.environ.get('REQUIRE_AUTH', '').lower() in ('true', '1', 'yes')

if _REQUIRE_AUTH and _jwt_verify:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import JSONResponse as StarletteJSONResponse

    class AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            path = request.url.path
            # Allow public paths
            if path in _PUBLIC_PATHS or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
                return await call_next(request)
            # Allow OPTIONS (CORS preflight)
            if request.method == 'OPTIONS':
                return await call_next(request)
            # Check JWT
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
                payload = _jwt_verify(token)
                if payload:
                    return await call_next(request)
            return StarletteJSONResponse(
                {'detail': '認証が必要です。'},
                status_code=401,
            )

    app.add_middleware(AuthMiddleware)
    logger.info('Auth middleware enabled (REQUIRE_AUTH=true)')

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
    from backend.auth import router as auth_router
    app.include_router(auth_router)
except Exception:
    try:
        from auth import router as auth_router  # type: ignore
        app.include_router(auth_router)
    except Exception:
        logger.warning('Auth router could not be loaded')

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


def _repair_latex_nesting(latex: str) -> str:
    """LLM出力のLaTeXネスト崩れを自動修復する。

    主な修復:
    1. 閉じ忘れた \\begin{env} に対応する \\end{env} を補完
    2. 余分な \\end{env} を除去
    3. 3階層以上のenumerate/itemizeネストをフラット化
    4. \\frac の空引数を修復
    5. 中括弧 {} のバランス修復
    """
    if not latex or not isinstance(latex, str):
        return latex

    s = latex

    # ── 0. \\newcommand / \\renewcommand 定義内の領域を特定 ──
    # マクロ定義内の \\begin{env} は実際の環境開始ではないためスキップする
    def _find_newcommand_regions(text):
        regions = []
        for m_nc in re.finditer(r'\\(?:re)?new(?:command|tcolorbox|tcbox)\{[^}]*\}(?:\[\d+\])*\{', text):
            start = m_nc.end() - 1
            depth = 1
            i = m_nc.end()
            while i < len(text) and depth > 0:
                if text[i] == '{' and (i == 0 or text[i-1] != '\\'):
                    depth += 1
                elif text[i] == '}' and (i == 0 or text[i-1] != '\\'):
                    depth -= 1
                i += 1
            regions.append((start, i))
        return regions

    newcmd_regions = _find_newcommand_regions(s)

    def _inside_newcommand(pos):
        return any(start <= pos < end for start, end in newcmd_regions)

    # ── 1. \\begin/\\end のバランス修復 ──
    begin_pattern = re.compile(r'\\begin\{(\w+)\}')
    end_pattern = re.compile(r'\\end\{(\w+)\}')

    # document環境は特別扱い（すでに対処済みの場合が多い）
    skip_envs = {'document'}

    # マクロ定義内で使われている環境名を収集
    macro_envs = set()
    for m_be in begin_pattern.finditer(s):
        if _inside_newcommand(m_be.start()):
            macro_envs.add(m_be.group(1))

    # 全begin/endを走査してスタックで検証
    lines = s.split('\n')
    env_stack = []  # (env_name, line_index)
    orphan_ends = []  # (env_name, line_index) - 対応するbeginがないend

    # 各行の開始位置（元テキスト中でのオフセット）を計算
    line_offsets = []
    offset = 0
    for line in lines:
        line_offsets.append(offset)
        offset += len(line) + 1  # +1 for newline

    for i, line in enumerate(lines):
        for m in begin_pattern.finditer(line):
            env_name = m.group(1)
            if env_name not in skip_envs:
                abs_pos = line_offsets[i] + m.start()
                if not _inside_newcommand(abs_pos):
                    env_stack.append((env_name, i))
        for m in end_pattern.finditer(line):
            env_name = m.group(1)
            if env_name in skip_envs:
                continue
            abs_pos = line_offsets[i] + m.start()
            if _inside_newcommand(abs_pos):
                continue
            # マクロ定義内環境の \end はスキップ（対応する \begin がマクロ内にある）
            if env_name in macro_envs and (not env_stack or env_stack[-1][0] != env_name):
                continue
            # スタックから対応するbeginを探す（後ろから）
            found = False
            for j in range(len(env_stack) - 1, -1, -1):
                if env_stack[j][0] == env_name:
                    env_stack.pop(j)
                    found = True
                    break
            if not found:
                orphan_ends.append((env_name, i))

    # 余分なendを除去（行ごと削除は危険なので、その\\end{X}だけ削除）
    for env_name, line_idx in reversed(orphan_ends):
        lines[line_idx] = re.sub(
            r'\\end\{' + re.escape(env_name) + r'\}\s*',
            '',
            lines[line_idx],
            count=1
        )

    # 閉じ忘れたbeginに対応するendを挿入
    # \\end{document} の直前に挿入する
    if env_stack:
        end_doc_idx = None
        for i in range(len(lines) - 1, -1, -1):
            if '\\end{document}' in lines[i]:
                end_doc_idx = i
                break

        insert_lines = []
        for env_name, _ in reversed(env_stack):
            insert_lines.append(f'\\end{{{env_name}}}')

        if end_doc_idx is not None:
            for fix_line in insert_lines:
                lines.insert(end_doc_idx, fix_line)
        else:
            lines.extend(insert_lines)

    s = '\n'.join(lines)

    # ── 2. \\frac の空引数修復 ──
    # \\frac{}{...} → \\frac{?}{...}
    s = re.sub(r'\\frac\{\}(\{)', r'\\frac{?}\1', s)
    # \\frac{...}{} → \\frac{...}{?}
    s = re.sub(r'(\\frac\{[^}]*\})\{\}', r'\1{?}', s)

    # ── 3. 中括弧バランスの簡易修復 ──
    # document本体のみを対象にカウント（プリアンブル部分は除外）
    doc_begin = re.search(r'\\begin\{document\}', s)
    doc_end = re.search(r'\\end\{document\}', s)
    if doc_begin and doc_end:
        before = s[:doc_begin.end()]
        body = s[doc_begin.end():doc_end.start()]
        after = s[doc_end.start():]

        open_count = body.count('{')
        close_count = body.count('}')
        if open_count > close_count:
            body += '}' * (open_count - close_count)
        elif close_count > open_count:
            # 末尾の余分な}を除去
            diff = close_count - open_count
            for _ in range(diff):
                last_brace = body.rfind('}')
                if last_brace >= 0:
                    body = body[:last_brace] + body[last_brace + 1:]

        s = before + body + after

    # ── 4. \\\\[寸法] を \\\\ に正規化 ──
    s = re.sub(r'\\\\(\[[\d.]+(?:mm|cm|pt|em|ex)\])', r'\\\\', s)

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
    # Question format: 'standard' | 'fill_in_blank' | 'choice' | 'true_false'
    question_format: Optional[str] = 'standard'
    # Sub-topic / theme (maps to DB subtopic column)
    sub_topic: Optional[str] = None
    # Physics: include a TikZ diagram for each major question
    include_diagram_per_question: Optional[bool] = False
    # Diagram realism: enable high-quality realistic diagram rendering instructions
    diagram_realism: Optional[bool] = True
    # User custom request (free text, max 200 chars, sanitised)
    custom_request: Optional[str] = None
    # Base problem text selected from DB (for generating similar problems)
    base_problem_text: Optional[str] = None
    # Branding: service name to display in PDF header
    brand_name: Optional[str] = None
    # Branding: logo image as base64 data URL (e.g. data:image/png;base64,...)
    brand_logo_url: Optional[str] = None
    # Branding: paper color theme ID (default, forest, burgundy, navy, violet, sepia, mono, brand)
    paper_theme: Optional[str] = None
    # Branding: resolved paper theme colors (header_color, accent_color, rule_color) as hex
    paper_colors: Optional[Dict[str, str]] = None


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
        # sub_topic / subtopic for DB storage
        'subtopic': req.sub_topic or '',
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

                # ── Direct DB query — strict subject+field filter ──
                # Only inject problems whose subject AND field/topic match.
                # If no match, inject nothing (do NOT fall back to subject-only or global).
                cur = conn.cursor()
                _order = 'id DESC' if _is_sq else 'created_at DESC'
                _found_rows = []
                _used_tier = 'none'

                if subject_f and field_f:
                    # Strict: subject + topic must both match
                    _sql = (
                        "SELECT id, stem, solution_outline, difficulty, trickiness, subject, topic "
                        "FROM problems "
                        "WHERE (subject = %s OR subject LIKE %s) AND topic = %s "
                        "AND stem IS NOT NULL AND stem != '' "
                        f"ORDER BY {_order} LIMIT %s"
                    )
                    cur.execute(_sql, (subject_f, subject_f + '%', field_f, 200))
                    _found_rows = cur.fetchall()
                    _used_tier = 'subject+topic'
                    logger.info('RAG DB strict subject+topic: %d rows (subject=%r, topic=%r)',
                                len(_found_rows), subject_f, field_f)
                elif subject_f:
                    # No field specified — allow subject-only match
                    _sql = (
                        "SELECT id, stem, solution_outline, difficulty, trickiness, subject, topic "
                        "FROM problems "
                        "WHERE (subject = %s OR subject LIKE %s) "
                        "AND stem IS NOT NULL AND stem != '' "
                        f"ORDER BY {_order} LIMIT %s"
                    )
                    cur.execute(_sql, (subject_f, subject_f + '%', 200))
                    _found_rows = cur.fetchall()
                    _used_tier = 'subject-only'
                    logger.info('RAG DB subject-only: %d rows (subject=%r)',
                                len(_found_rows), subject_f)
                else:
                    # No filter at all — skip injection
                    logger.info('RAG: no subject/field specified, skipping injection')

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

                # Base problem text from DB selection
                base_problem_text = getattr(req, 'base_problem_text', None) or ''
                if base_problem_text and isinstance(base_problem_text, str) and base_problem_text.strip():
                    base_block = (
                        "\n\n【ベース問題（DBから選択）】\n"
                        "以下のベース問題を参考にして、同じ形式・難易度で類似問題を作成してください。\n"
                        "元の問題をそのままコピーせず、数値や条件を変えた新しい問題を生成すること。\n\n"
                        f"--- ベース問題 ---\n{base_problem_text.strip()}\n--- ベース問題ここまで ---\n"
                    )
                    source_block = source_block + base_block if source_block else base_block

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
                        "\\definecolor{accentcolor}{HTML}{2563EB}\n"
                        "\\definecolor{rulecolor}{HTML}{2C3E50}\n"
                        "\\pagestyle{fancy}\\fancyhf{}\n"
                        "\\renewcommand{\\headrulewidth}{0.8pt}\n"
                        "\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{mainblue}\\leaders\\hrule height \\headrulewidth\\hfill}}\n"
                        "\\fancyhead[L]{\\small\\color{mainblue}\\textsf{\\textbf{類題演習}}}\n"
                        "\\fancyhead[R]{\\small\\color{mainblue}\\textsf{\\thepage}}\n"
                        "\\setlength{\\headheight}{14pt}\n"
                        "% セクション見出しに色適用\n"
                        "\\titleformat{\\section}{\\Large\\bfseries\\color{mainblue}}{}{0em}{}[\\vspace{-0.5em}{\\color{mainblue}\\rule{\\linewidth}{0.4pt}}]\n"
                        "\\titleformat{\\subsection}{\\large\\bfseries\\color{accentcolor}}{}{0em}{}\n"
                        "\\newcommand{\\problem}[1]{\\subsection*{\\textcolor{accentcolor}{\\textbf{問題 #1}}}}\n"
                        "\\newcommand{\\answer}[1]{\\noindent{\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}\\subsection*{\\textcolor{accentcolor}{問題 #1 の解答}}}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "\\section*{\\textcolor{mainblue}{問題}}\n\n"
                        "{{problems_section}}\n\n"
                        "\\newpage\n\n"
                        "\\section*{\\textcolor{mainblue}{解答・解説}}\n\n"
                        "{{answers_section}}\n\n"
                        "\\end{document}\n"
                    )
                    if preset_id == 'mock_exam':
                        struct_rules = (
                            "=== レイアウトルール ===\n"
                            "- {{problems_section}} の冒頭に模試ヘッダーを入れる:\n"
                            "  {\\large\\bfseries 模擬試験} \\hfill 制限時間: 60分 \\quad 満点: 100点\n"
                            "  注意事項を \\begin{itemize} で3〜5項目。\n"
                            "- 大問は \\section*{\\textcolor{mainblue}{第1問}}（配点: XX点）形式。小問は \\begin{enumerate}[(1)]。\n"
                            "- {{answers_section}} には \\answer{N} で解答。配点内訳を明記。\n"
                            "- 問題と解答は \\newpage で分離。\n"
                            "- すべての見出し・セクション名に \\textcolor{mainblue}{...} を使用すること。\n\n"
                        )
                    elif preset_id == 'report':
                        struct_rules = (
                            "=== レイアウトルール ===\n"
                            "- {{problems_section}} に \\problem{N} で問題を列挙。\n"
                            "- {{answers_section}} は各問3部構成:\n"
                            "  \\answer{N} → \\paragraph{\\textcolor{accentcolor}{解法}}（step-by-step）→ \\paragraph{\\textcolor{accentcolor}{ポイント}}（箇条書き）\n"
                            "- align* で計算過程を揃える。\n"
                            "- 問題と解説は \\newpage で分離。\n"
                            "- すべての見出し・小見出しに \\textcolor{mainblue}{...} または \\textcolor{accentcolor}{...} を使用すること。\n\n"
                        )
                    else:  # exam
                        struct_rules = (
                            "=== レイアウトルール ===\n"
                            "- 前半: \\section*{\\textcolor{mainblue}{問題}}、後半: \\section*{\\textcolor{mainblue}{解答・解説}}、\\newpage で分離。\n"
                            "- 各問題は \\problem{N} で始め、末尾に [XX点] と配点。\n"
                            "  小問は \\begin{enumerate}[(1)] の \\item。\n"
                            "- 各解答は \\answer{N} で始める。途中式・考え方を含む。\n"
                            "- すべての見出し・セクション名には \\textcolor{mainblue}{...} を使用すること。\n\n"
                        )

                elif preset_id == 'worksheet':
                    latex_skeleton = (
                        _cjk_preamble +
                        "\\usepackage{ulem}\n"
                        "\\usepackage{xcolor}\n"
                        "\\usepackage{fancyhdr}\n"
                        "\\definecolor{mainblue}{HTML}{1A5276}\n"
                        "\\definecolor{accentcolor}{HTML}{2563EB}\n"
                        "\\definecolor{rulecolor}{HTML}{2C3E50}\n"
                        "\\pagestyle{fancy}\\fancyhf{}\n"
                        "\\renewcommand{\\headrulewidth}{0.8pt}\n"
                        "\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{mainblue}\\leaders\\hrule height \\headrulewidth\\hfill}}\n"
                        "\\fancyfoot[C]{\\small\\color{mainblue}\\thepage}\n"
                        "\\setlength{\\headheight}{14pt}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "\\begin{flushright}\n"
                        "名前：\\underline{\\hspace{5cm}} \\quad 日付：\\underline{\\hspace{3cm}}\n"
                        "\\end{flushright}\n"
                        "{\\color{mainblue}\\rule{\\linewidth}{0.8pt}}\n"
                        "\\begin{center}{\\Large\\bfseries\\color{mainblue} {{title}}}\\end{center}\n"
                        "{\\color{mainblue}\\rule{\\linewidth}{0.4pt}}\n"
                        "\\vspace{1em}\n\n"
                        "% 問題と解答スペースをここに生成\n"
                        "{{problems_section}}\n\n"
                        "\\newpage\n\n"
                        "{\\color{mainblue}\\rule{\\linewidth}{0.4pt}}\n"
                        "\\begin{center}{\\large\\bfseries\\color{mainblue} 解答}\\end{center}\n"
                        "{\\color{mainblue}\\rule{\\linewidth}{0.4pt}}\n\n"
                        "{{answers_section}}\n\n"
                        "\\end{document}\n"
                    )
                    struct_rules = (
                        "=== レイアウトルール ===\n"
                        "- 冒頭に名前欄・日付欄（スケルトン通り、変更しない）。\n"
                        "- {{problems_section}} に問題を \\begin{enumerate}[leftmargin=*] で列挙。\n"
                        "  各問の番号は \\textcolor{accentcolor}{\\textbf{(N)}} で色付きにする。\n"
                        "  各啎の後に \\vspace{3cm} で解答スペースを設ける。\n"
                        "- {{answers_section}} に番号順に解答を \\begin{enumerate} で記載。\n"
                        "- \\problem, \\answer 等の独自コマンドは使わない。\n"
                        "- 問題間の区切りに {\\color{rulecolor}\\rule{\\linewidth}{0.2pt}} を使用する。\n\n"
                    )

                elif preset_id == 'flashcard':
                    latex_skeleton = (
                        _cjk_preamble +
                        "\\usepackage{array}\n"
                        "\\usepackage{longtable}\n"
                        "\\usepackage{booktabs}\n"
                        "\\usepackage{xcolor}\n"
                        "\\usepackage{colortbl}\n"
                        "\\definecolor{mainblue}{HTML}{1A5276}\n"
                        "\\definecolor{accentcolor}{HTML}{2563EB}\n"
                        "\\definecolor{rulecolor}{HTML}{2C3E50}\n"
                        "\\definecolor{lightbg}{HTML}{EBF5FB}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "{\\color{mainblue}\\rule{\\linewidth}{0.8pt}}\n"
                        "\\begin{center}{\\Large\\bfseries\\color{mainblue} {{title}}}\\end{center}\n"
                        "{\\color{mainblue}\\rule{\\linewidth}{0.4pt}}\n"
                        "\\vspace{1em}\n\n"
                        "% 一問一答カード: longtable で問題と解答を左右に並べる\n"
                        "{{problems_section}}\n\n"
                        "\\end{document}\n"
                    )
                    struct_rules = (
                        "=== レイアウトルール ===\n"
                        "- {{problems_section}} を以下の longtable で置き換える:\n"
                        "\\begin{longtable}{|p{0.47\\textwidth}|p{0.47\\textwidth}|}\n"
                        "\\arrayrulecolor{rulecolor}\\hline\n"
                        "\\rowcolor{mainblue!15}\\textcolor{mainblue}{\\textbf{問題}} & \\textcolor{mainblue}{\\textbf{解答}} \\\\\n"
                        "\\hline\n"
                        "\\endfirsthead\n"
                        "\\arrayrulecolor{rulecolor}\\hline\n"
                        "\\rowcolor{mainblue!15}\\textcolor{mainblue}{\\textbf{問題}} & \\textcolor{mainblue}{\\textbf{解答}} \\\\\n"
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
                        "\\usepackage{xcolor}\n"
                        "\\definecolor{mainblue}{HTML}{1A5276}\n"
                        "\\definecolor{accentcolor}{HTML}{2563EB}\n"
                        "\\definecolor{rulecolor}{HTML}{2C3E50}\n\n"
                        "\\begin{document}\n"
                        "\\setstretch{1.3}\n\n"
                        "% コンテンツをここに記述\n"
                        "{{problems_section}}\n\n"
                        "\\end{document}\n"
                    )
                    struct_rules = (
                        "=== レイアウトルール ===\n"
                        "- 問題: \\begin{enumerate}[leftmargin=*] の \\item で番号付きリスト。\n"
                        "- 解答: \\section*{\\textcolor{mainblue}{解答}} の下に \\begin{enumerate} で番号順。\n"
                        "- 独自コマンド（\\problem, \\answer）は使わない。\n"
                        "- 見出しには \\textcolor{mainblue}{...} を必ず使用。\n"
                        "- 問題間の区切りに {\\color{rulecolor}\\rule{\\linewidth}{0.2pt}} を使用する。\n\n"
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

                # --- Inject branding (colors / header name / logo) ---
                _brand_name = getattr(req, 'brand_name', None) or None
                _brand_logo_url = getattr(req, 'brand_logo_url', None) or None
                _paper_colors = getattr(req, 'paper_colors', None) or None

                if _paper_colors:
                    _hc = (_paper_colors.get('headerColor') or '1A5276').lstrip('#')
                    _ac = (_paper_colors.get('accentColor') or _hc).lstrip('#')
                    _rc = (_paper_colors.get('ruleColor') or _hc).lstrip('#')
                    # 3色すべて差し替え
                    latex_skeleton = latex_skeleton.replace(
                        '\\definecolor{mainblue}{HTML}{1A5276}',
                        f'\\definecolor{{mainblue}}{{HTML}}{{{_hc}}}',
                    )
                    latex_skeleton = latex_skeleton.replace(
                        '\\definecolor{accentcolor}{HTML}{2563EB}',
                        f'\\definecolor{{accentcolor}}{{HTML}}{{{_ac}}}',
                    )
                    latex_skeleton = latex_skeleton.replace(
                        '\\definecolor{rulecolor}{HTML}{2C3E50}',
                        f'\\definecolor{{rulecolor}}{{HTML}}{{{_rc}}}',
                    )
                    # flashcard の lightbg も headerColor から明るい背景色を生成
                    latex_skeleton = latex_skeleton.replace(
                        '\\definecolor{lightbg}{HTML}{EBF5FB}',
                        f'\\definecolor{{lightbg}}{{HTML}}{{{_hc}}}',
                    )

                if _brand_name:
                    latex_skeleton = latex_skeleton.replace(
                        '\\fancyhead[L]{\\small\\color{mainblue}\\textsf{\\textbf{類題演習}}}',
                        f'\\fancyhead[L]{{\\small\\color{{mainblue}}\\textsf{{\\textbf{{{_brand_name}}}}}}}',
                    )

                # ブランディング指示をプロンプトに追加（具体的なLaTeXコマンド例つき）
                _branding_parts = []
                if _brand_name:
                    _branding_parts.append(f'- ヘッダー左側のタイトルには「{_brand_name}」と表示してください。')
                if _paper_colors or True:  # 常にカラー指示を出す
                    if _paper_colors:
                        _hc_disp = (_paper_colors.get('headerColor') or '1A5276').lstrip('#')
                        _ac_disp = (_paper_colors.get('accentColor') or _hc_disp).lstrip('#')
                        _rc_disp = (_paper_colors.get('ruleColor') or _hc_disp).lstrip('#')
                        _branding_parts.extend([
                            f'★★★ カラー指示（最重要）: プリアンブルで以下の3色が\\definecolorで定義済みです。',
                            f'  \\definecolor{{mainblue}}{{HTML}}{{{_hc_disp}}} — #{_hc_disp}',
                            f'  \\definecolor{{accentcolor}}{{HTML}}{{{_ac_disp}}} — #{_ac_disp}',
                            f'  \\definecolor{{rulecolor}}{{HTML}}{{{_rc_disp}}} — #{_rc_disp}',
                        ])
                    else:
                        _branding_parts.append('★★★ カラー指示（最重要）: プリアンブルで mainblue, accentcolor, rulecolor の3色が定義済みです。')
                    _branding_parts.extend([
                        '',
                        '【★★★ 全体の雰囲気・トーンとしてのカラー指示 — 最重要 ★★★】',
                        'これらの色はPDF全体の「ブランドの雰囲気」を作るための色です。',
                        '強調文字だけに使うのではなく、文書全体のトーンとして統一的に使ってください:',
                        '  1. ★ \\section*, \\subsection* の見出しテキスト → 必ず \\textcolor{mainblue}{見出しテキスト} で囲む',
                        '  2. ★ 問題番号（問1, 問2, ...）→ 必ず \\textcolor{accentcolor}{\\textbf{問1}} のように色付け',
                        '  3. ★ ヘッダー・フッターの装飾線や背景色 → mainblue / rulecolor',
                        '  4. ★ 大問間の区切り線 → {\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}',
                        '  5. ★ 配点表示・注記 → \\textcolor{mainblue}{...}',
                        '  6. ★ ページ全体を見たとき、このブランドカラーが「紙面全体の色調」として認識されること',
                        '  7. 黒色テキストは本文（問題文・解説の地の文）のみに使用する',
                        '',
                        '【図・グラフの色について】',
                        '図やグラフの色はブランドカラーに縛られる必要はありません。',
                        'リアルで教科書品質の自然な色彩を使ってください（blue, red, green 等）。',
                        '',
                        '★★★ 絶対禁止:',
                        '  - 見出し・問題番号・区切り線を黒色(black)のままにすること',
                        '  - 文書全体が黒っぽく見える出力（ブランドカラーが使われていない状態）',
                        '  - \\definecolor の色定義を上書き・変更すること',
                    ])
                if _brand_logo_url:
                    _branding_parts.append(
                        f'- ブランド名「{_brand_name or ""}」をヘッダーに目立つように表示してください。'
                    )
                if _branding_parts:
                    latex_instr += '\n【ブランディング・カラー指示（厳守）】\n' + '\n'.join(_branding_parts) + '\n'

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

                # --- Inject question format instructions ---
                q_format = getattr(req, 'question_format', 'standard') or 'standard'
                if q_format != 'standard':
                    fmt_instr = _QUESTION_FORMAT_INSTRUCTIONS.get(q_format, '')
                    if fmt_instr:
                        latex_instr += fmt_instr

                # --- Inject physics diagram-per-question instruction ---
                _inc_diag = getattr(req, 'include_diagram_per_question', False)
                _subj_for_diag = getattr(req, 'subject', '') or ctx.get('subject', '') or ''
                if _inc_diag and _is_physics_subject(_subj_for_diag, orig_prompt_body):
                    latex_instr += (
                        '\n【物理図の必須ルール（厳守）】\n'
                        '- 大問（\\section* / \\problem 等で区切られた各問題）ごとに必ず1つ TikZ 図を含めること。\n'
                        '- 図は問題文の直後に \\begin{tikzpicture}...\\end{tikzpicture} で配置する。\n'
                        '- 力の図示、物体の配置、回路図、グラフなど問題内容に適した図を描くこと。\n'
                        '- テキストのみの大問は不可。\n'
                    )

                # --- Inject diagram accuracy rules only for STEM subjects ---
                _subj_for_rules = _subject_for_rules  # already defined above
                if _is_stem_subject(_subj_for_rules, orig_prompt_body):
                    # 共通の STEM 図描画精度ルール
                    _stem_diagram_base = (
                        '\n【★★ 図・グラフの描画精度ルール — 厳守 ★★】\n'
                        '1. 描画前に座標計算をコメントで明記し検算すること\n'
                        '2. 閉じた図形は -- cycle で閉じる\n'
                        '3. グラフはsamples=100以上で滑らかに\n'
                        '4. 図のスケール: 問題文の数値と比率を一致させる\n'
                        '5. ラベル: node[above]等で重なり防止\n'
                    )
                    latex_instr += _stem_diagram_base

                    # 科目別のリアリズムルール（排他的に注入）
                    _diagram_realism = getattr(req, 'diagram_realism', True)
                    if _diagram_realism and extra_pkgs:
                        if _is_physics_subject(_subj_for_rules, orig_prompt_body):
                            latex_instr += (
                                '\n【物理図の精度ルール】\n'
                                '- ★★ 物体が面に置かれている場合、底辺y座標=面y座標（隙間厳禁）\n'
                                '- 三角関数値: cos30°=0.866, sin30°=0.5, cos60°=0.5, sin60°=0.866\n'
                                '- 力ベクトル: -{Stealth[length=3mm]} で統一\n'
                                '- 床面: pattern=north east lines でハッチング\n'
                                '- 線の太さ: 主要=thick, 補助=thin, 寸法=very thin\n'
                            )
                        elif _is_chemistry_subject(_subj_for_rules, orig_prompt_body):
                            latex_instr += (
                                '\n【化学図の精度ルール】\n'
                                '- 構造式: 単結合=実線, 二重=二重線, 三重=三重線\n'
                                '- ウェッジ=太い三角, ダッシュ=破線三角\n'
                                '- 反応機構: 曲がり矢印で電子移動を示す\n'
                                '- 軌道図: 水平線+↑↓矢印\n'
                            )
                        elif _is_biology_subject(_subj_for_rules, orig_prompt_body):
                            latex_instr += (
                                '\n【生物図の精度ルール】\n'
                                '- 細胞膜: double線, 内部はfill色分け\n'
                                '- DNA: sin/cos曲線+横棒で塩基対\n'
                                '- 家系図: 男=□, 女=○, 患者=塗りつぶし\n'
                                '- 代謝経路: 酵素名を矢印上に配置\n'
                            )
                        else:
                            # 数学等の一般STEM
                            latex_instr += (
                                '\n【幾何図形の精度ルール】\n'
                                '- 三角関数値: cos30°=0.866, sin30°=0.5, cos60°=0.5, sin60°=0.866\n'
                                '- 交点は連立方程式で求め検算をコメントに書く\n'
                                '- 平行線: 外積=0確認, 垂直線: 内積=0確認\n'
                                '- 色は最大4色, サイズは0.7~0.9\\linewidth\n'
                            )

                # --- Inject user custom request ---
                _cust_req = getattr(req, 'custom_request', '') or ''
                if _cust_req:
                    import re as _re
                    _sanitised = _cust_req[:200].strip()
                    _sanitised = _re.sub(r'(ignore|forget|disregard|override)\s+(all|previous|above|system)', '', _sanitised, flags=_re.IGNORECASE)
                    _sanitised = _re.sub(r'<[^>]+>', '', _sanitised)
                    _sanitised = _re.sub(r'```.*?```', '', _sanitised, flags=_re.DOTALL)
                    _sanitised = _sanitised.strip()
                    if _sanitised:
                        latex_instr += f'\n【ユーザーからの追加要望】\n{_sanitised}\n'

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

# ── 出題形式ごとのプロンプト追加指示 ──────────────────────────────────────
_QUESTION_FORMAT_INSTRUCTIONS: Dict[str, str] = {
    'fill_in_blank': (
        "\n=== 出題形式: 穴埋め問題 ===\n"
        "- 問題文中の重要な語句・数値・式を \\underline{\\hspace{3cm}} で空欄にする。\n"
        "- 空欄には（ア）（イ）（ウ）（エ）（オ）（カ）（キ）（ク）（ケ）（コ）の順で記号を振る。\n"
        "  表記: \\textbf{（ア）} のように太字で目立たせる。\n"
        "- 解答欄には（ア）＝○○ のように記号と正解を対応させて記載する。\n"
        "- 空欄は1問あたり3〜6個程度が望ましい。\n"
        "- 文脈から答えが一意に決まるように出題すること。\n\n"
    ),
    'choice': (
        "\n=== 出題形式: 選択肢問題 ===\n"
        "- 各問に4〜5個の選択肢を \\begin{enumerate}[(ア)] で列挙する。\n"
        "- 正解は1つ。紛らわしい誤答（ディストラクター）を含めること。\n"
        "- 解答欄には正解の記号と簡潔な解説を記載する。\n\n"
    ),
    'true_false': (
        "\n=== 出題形式: 正誤問題 ===\n"
        "- 各問に文（命題）を提示し、正しいか誤りかを判断させる。\n"
        "- 「○（正しい）」「×（誤り）」で解答させる形式にする。\n"
        "- 誤りの文には典型的な誤解や紛らわしい内容を含めること。\n"
        "- 解答欄には正誤の判定と、誤りの場合はどこが間違いかを解説する。\n\n"
    ),
}

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


def _is_physics_subject(subject: str, prompt_text: str = '') -> bool:
    """科目名やプロンプト文から物理科目かどうか判定。"""
    s = (subject or '').strip().lower()
    if s in ('物理', 'physics'):
        return True
    combined = (s + ' ' + (prompt_text or '')[:500]).lower()
    physics_keywords = {
        '物理', 'physics', '力学', '運動方程式', '電磁気', '電場', '磁場',
        '波動', '光学', '熱力学', '原子物理', '回路', '電気', 'エネルギー',
        '万有引力', '慣性', '摩擦', '弾性', 'ばね', '振り子', 'コンデンサ',
        '抵抗', 'オームの法則', 'クーロン', 'ローレンツ', 'ファラデー',
    }
    for kw in physics_keywords:
        if kw in combined:
            return True
    return False


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


def _is_chemistry_subject(subject: str, prompt_text: str = '') -> bool:
    """科目名やプロンプト文から化学科目かどうか判定。"""
    s = (subject or '').strip().lower()
    if s in ('化学', 'chemistry'):
        return True
    combined = (s + ' ' + (prompt_text or '')[:500]).lower()
    chem_keywords = {
        '化学', 'chemistry', '有機化学', '無機化学', '化学反応', '酸化還元',
        '中和', 'mol', 'モル', '電気分解', '結合', '構造式', '分子',
        '原子量', '化学式', '反応式', '酸', '塩基', 'pH', '電離',
        '熱化学', 'ヘスの法則', '化学平衡', 'ルシャトリエ',
    }
    for kw in chem_keywords:
        if kw in combined:
            return True
    return False


def _is_biology_subject(subject: str, prompt_text: str = '') -> bool:
    """科目名やプロンプト文から生物科目かどうか判定。"""
    s = (subject or '').strip().lower()
    if s in ('生物', 'biology'):
        return True
    combined = (s + ' ' + (prompt_text or '')[:500]).lower()
    bio_keywords = {
        '生物', 'biology', '細胞', 'DNA', 'RNA', '遺伝', '遺伝子',
        '酵素', '代謝', '光合成', '呼吸', '神経', 'ホルモン',
        '生態系', '進化', '分類', '減数分裂', '体細胞分裂',
        'タンパク質', 'アミノ酸', '免疫', '家系図',
    }
    for kw in bio_keywords:
        if kw in combined:
            return True
    return False


# --- プロンプト部品: コアルール（全科目共通）---
_LATEX_CORE_RULES = (
    "=== LaTeX 出力の基本ルール（全科目共通・厳守） ===\n"
    "★★★ 最重要: 出力は \\documentclass で始まり \\end{document} で終わる完全なLaTeX文書のみ。\n"
    "問題文から書き始めたり、パッケージ宣言を省略することは絶対禁止。\n"
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
    "=== ネスト・環境ルール（厳守） ===\n"
    "N1. \\begin{env} と \\end{env} は必ず 1対1 で対応させる。\n"
    "    対応の確認手順: 出力完了後に begin と end の数を数え、一致しない場合は修正する。\n"
    "N2. enumerate / itemize の入れ子は最大 2 階層まで。\n"
    "    ○ 許可: enumerate の中に enumerate（2階層目）\n"
    "    × 禁止: enumerate の中の enumerate の中にさらに enumerate（3階層目以上）\n"
    "N3. 各環境の \\begin / \\end はそれぞれ単独の行に書く。\n"
    "N4. 改行のタイミング:\n"
    "    - 大問と大問: \\vspace{1em}\n"
    "    - 問題文と選択肢: \\vspace{0.5em}\n"
    "    - 本文と問題: \\vspace{1em} + \\noindent\n"
    "N5. インデントはネスト深さに応じて一貫させる（ソースの可読性のため）。\n"
    "N6. tikzpicture, axis, circuitikz, forest 等の描画環境は\n"
    "    enumerate/itemize のカウントに含めない（描画環境は自由にネスト可）。\n"
    "\n"
    "=== テキスト折り返し・行間ルール ===\n"
    "W1. 長いテキストは LaTeX の自動折り返しに任せる。\n"
    "W2. \\mbox{}, \\hbox{} でテキストを囲まない。\n"
    "W3. 表のセル幅は p{} で指定し、\\textwidth を超えない。\n"
    "S1. 行間は setspace + \\setstretch{1.3} で設定済み。\n"
)

# --- プロンプト部品: 数式ルール（理系科目のみ追加）---
_LATEX_MATH_RULES = (
    "\n=== 数式の記述ルール（理系科目用・厳守） ===\n"
    "M1. 分数: \\frac{分子}{分母}。必ず {分子}{分母} の2つの中括弧を書く。\n"
    "    分子・分母が空の \\frac{}{} は絶対禁止。\n"
    "    入れ子: \\frac{\\frac{a}{b}}{c} のように中括弧を完全に対応。\n"
    "M2. 掛け算: \\times または \\cdot。\n"
    "M3. 根号: \\sqrt{x}。\n"
    "M4. 関数: 必ずバックスラッシュ付き。\n"
    "    \\sin, \\cos, \\tan, \\arcsin, \\arccos, \\arctan,\n"
    "    \\log, \\ln, \\exp, \\lim, \\max, \\min,\n"
    "    \\sup, \\inf, \\det, \\gcd, \\deg, \\arg\n"
    "    × 誤: arctan x  ○ 正: \\arctan x\n"
    "M5. 添字2文字以上は中括弧: $x_{10}$, $a_{ij}$\n"
    "M6. 区間は数式内: $[0,1)$, $[a,b]$\n"
    "M7. \\frac{分子}{分母} は必ず分子・分母の両方を記述する。\n"
    "    空の分子 \\frac{}{x} や空の分母 \\frac{x}{} は禁止。\n"
)

# --- プロンプト部品: 品質ルール ---
# --- プロンプト部品: 物理科目 TikZ 図専用ルール ---
_LATEX_PHYSICS_DIAGRAM_RULES = (
    "\n=== 物理科目の図（TikZ）作成ルール（厳守） ===\n"
    "PD1. ラベルは物理量記号（$F$, $v$, $m$, $\\theta$ 等）を使う。日本語ラベル禁止。\n"
    "PD2. ★★ 力ベクトル・矢印の厳密ルール:\n"
    "     矢印スタイル: \\draw[-{Stealth[length=3mm,width=2mm]},thick] で作用点から描く。\n"
    "     ×誤: \\draw[->] ←矢先が小さすぎて視認不能。\n"
    "     ×誤: \\draw[-stealth] ←大文字 Stealth が正しい。\n"
    "     力の方向: 物理法則に厳密に従う（重力=下, 垂直抗力=面に垂直, 摩擦=面に平行）。\n"
    "     矢印の長さ: 力の大きさに比例。全ベクトルの縮尺を統一する。\n"
    "PD3. 物体形状: 質点=circle(2pt), 直方体=rectangle, 円=circle, ばね=coil decoration。\n"
    "     ★バネは必ず coil decoration で螺旋を描くこと: decoration={coil, aspect=0.35, segment length=5pt, amplitude=8pt}\n"
    "     zigzag / snake は絶対禁止。\n"
    "PD4. 角度: arc で円弧を描き $\\theta$ を配置。始角と終角を物理的に正確に指定。\n"
    "PD5. ★★ 接触・設置の厳守ルール（最重要）:\n"
    "     物体が面の上に「置かれている」場合、物体の底辺のy座標と面のy座標を\n"
    "     必ず一致させること。隙間が空いて浮いて見えるのは絶対禁止。\n"
    "     具体例:\n"
    "     % 床 y=0, 物体の底辺も y=0 → 隙間なし\n"
    "     \\draw[thick] (-2,0) -- (4,0);  % 床\n"
    "     \\fill[pattern=north east lines] (-2,-0.3) rectangle (4,0);  % ハッチング\n"
    "     \\draw[thick] (0,0) rectangle (2,1.5);  % 物体（底辺y=0で床に接触）\n"
    "     斜面上の物体: 物体の底辺が斜面の線分上に正確に乗るよう座標計算する。\n"
    "PD6. 力の分解: 実線=元ベクトル, 破線[dashed]=分解成分, 直角マーク=小正方形(0.2単位)。\n"
    "PD7. 回路図: circuitikz使用。\n"
    "PD8. グラフ: pgfplots使用。軸に物理量と単位: xlabel={$t$ [s]}。\n"
    "PD9. 座標計算: 描画前にコメントで全座標を計算し検算すること。\n"
    "     % === 座標計算 ===\n"
    "     % 斜面角θ=30°, L=4 → 底辺=4cos30°=3.464, 高さ=4sin30°=2.0\n"
    "     % 力F=mg, 矢印長さ=1.5, 作用点=(1,1.5), 終点=(1,3.0)\n"
    "PD10. 閉じた図形は -- cycle で閉じる。\\begin/\\end の対応を確認。\n"
)

# --- プロンプト部品: 化学科目 図専用ルール ---
_LATEX_CHEMISTRY_DIAGRAM_RULES = (
    "\n=== 化学科目の図・構造式ルール（厳守） ===\n"
    "CD1. 化学式: \\ce{} (mhchem) または \\ch{} (chemformula) を使用。\n"
    "CD2. 構造式: 単結合=実線, 二重結合=二重線, 三重結合=三重線。\n"
    "     ウェッジ結合=太い三角, ダッシュ結合=破線三角。\n"
    "CD3. 反応機構: 曲がり矢印で電子の移動を示す。\n"
    "CD4. 軌道図: エネルギー準位=水平線, 電子=↑↓矢印。\n"
    "CD5. 座標計算: 描画前にコメントで座標を計算し検算すること。\n"
    "CD6. 閉じた図形は -- cycle で閉じる。\\begin/\\end の対応を確認。\n"
)

# --- プロンプト部品: 生物科目 図専用ルール ---
_LATEX_BIOLOGY_DIAGRAM_RULES = (
    "\n=== 生物科目の図ルール（厳守） ===\n"
    "BD1. 細胞図: 二重線(double)で細胞膜、内部はfillで色分け。\n"
    "     ミトコンドリア=red!10, 核=blue!10, 葉緑体=green!10。\n"
    "BD2. DNA: sin/cos曲線で螺旋、横棒で塩基対を表現。\n"
    "BD3. 家系図: 男性=□, 女性=○, 患者=塗りつぶし。\n"
    "BD4. 代謝経路: 酵素名を矢印上に\\footnotesize配置、阻害=⊣マーク。\n"
    "BD5. 座標計算: 描画前にコメントで座標を計算し検算すること。\n"
    "BD6. 閉じた図形は -- cycle で閉じる。\\begin/\\end の対応を確認。\n"
)

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
    "    文系科目で数式が不要なら $...$ や \\[...\\] は使わない。\n"
    "H3. 長文の説明には \\paragraph{} や itemize 環境を活用する。\n"
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
    "    - \\underline の入れ子は絶対禁止:\n"
    "      × \\underline{\\underline{text}} や \\underline{...\\underline{...}...}\n"
    "      ○ \\underline{This is the underlined part} のようにフラットに書く。\n"
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
    """科目・プリセットに応じて最適なLaTeX指示を組み立てる。

    科目ごとに必要なルールのみを選択し、不要なルールは含めない。
    """
    is_stem = _is_stem_subject(subject, prompt_text)
    is_physics = _is_physics_subject(subject, prompt_text)
    is_chemistry = _is_chemistry_subject(subject, prompt_text)
    is_biology = _is_biology_subject(subject, prompt_text)
    is_english = _is_english_subject(subject, prompt_text)

    parts = ["【LaTeX 出力ルール】\n以下を守ること。違反するとコンパイルエラーになる。\n"]

    # Core rules (always)
    parts.append(_LATEX_CORE_RULES)

    # STEM vs 文系: 排他的に切り替え
    if is_stem:
        parts.append(_LATEX_MATH_RULES)
    else:
        parts.append(_LATEX_HUMANITIES_HINTS)

    # 科目別の専用ルール（排他的に適用）
    if is_english:
        parts.append(_LATEX_ENGLISH_RULES)
    elif is_physics:
        parts.append(_LATEX_PHYSICS_DIAGRAM_RULES)
    elif is_chemistry:
        parts.append(_LATEX_CHEMISTRY_DIAGRAM_RULES)
    elif is_biology:
        parts.append(_LATEX_BIOLOGY_DIAGRAM_RULES)

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


def _build_llm_system_prompt(subject: str = '', prompt_text: str = '',
                              preset_instr: str = '',
                              include_diagram_per_question: bool = False,
                              custom_request: str = '',
                              brand_name: str = '',
                              paper_colors: Optional[Dict[str, str]] = None) -> str:
    """LLM API 用のシステムプロンプトを科目に応じて構築する。

    STEM科目ではスケルトン駆動型（具体例ベース）で安定出力を実現。
    """
    is_stem = _is_stem_subject(subject, prompt_text)
    is_physics = _is_physics_subject(subject, prompt_text)
    is_chemistry = _is_chemistry_subject(subject, prompt_text)
    is_biology = _is_biology_subject(subject, prompt_text)
    is_english = _is_english_subject(subject, prompt_text)

    if is_stem:
        return _build_stem_system_prompt(
            subject=subject,
            prompt_text=prompt_text,
            preset_instr=preset_instr,
            is_physics=is_physics,
            is_chemistry=is_chemistry,
            is_biology=is_biology,
            include_diagram_per_question=include_diagram_per_question,
            custom_request=custom_request,
            brand_name=brand_name,
            paper_colors=paper_colors,
        )

    # ── 非STEM（文系科目）は従来のルール列挙型 ──
    role_desc = 'あなたは教科の問題を LaTeX 形式で出力する教材作成アシスタントです。'

    parts = [
        f'{role_desc}\n'
        '以下のルールを守ってください:\n\n'
    ]

    parts.append(
        '【基本ルール】\n'
        '★★★ 最重要: 出力の最初の文字は必ず \\documentclass でなければならない。\n'
        '問題文やコメントから書き始めることは絶対禁止。\n'
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

    if is_english:
        parts.append(
            '【英語問題の書式ルール（厳守）】\n'
            '- 英文は斜体にしない（\\textit{} 禁止）。ローマン体で記述。\n'
            '- 設問文は必ず \\textbf{\\large ...} で囲み、本文と区別。\n'
            '- 長文は \\begin{quotation}...\\end{quotation} で囲み、前後に \\vspace{1em}。\n'
            '- \\mbox{}, \\hbox{}, \\fbox{}, tcolorbox, mdframed は使わない。\n'
            '- 自動折り返しに任せる。手動改行(\\\\)で英文を折り返さない。\n'
            '- 下線部: \\underline{word} のみ。入れ子禁止。\n'
            '- enumerate/itemize のネストは最大2階層。\n'
            '- 選択肢: \\begin{enumerate}[(A)] または \\begin{enumerate}[(1)]。\n'
            '- 問題ページと解答ページは \\newpage で分離。\n\n'
        )
    else:
        parts.append(_LATEX_HUMANITIES_HINTS)

    if preset_instr:
        parts.append(f'{preset_instr}\n')

    # User custom request (sanitised, max 200 chars)
    if custom_request:
        sanitised = _sanitise_custom_request(custom_request)
        if sanitised:
            parts.append(f'【ユーザからの追加要望】\n{sanitised}\n\n')

    # ブランディング指示
    _bp = []
    if brand_name:
        _bp.append(f'- ヘッダー左側のタイトルには「{brand_name}」と表示してください。')
    if paper_colors:
        _hc = paper_colors.get('headerColor', '1A5276').lstrip('#')
        _ac = paper_colors.get('accentColor', _hc).lstrip('#')
        _rc = paper_colors.get('ruleColor', _hc).lstrip('#')
        _bp.extend([
            f'★★★ カラー指示（最重要）: プリアンブルで以下の3色が\\definecolorで定義済みです。',
            f'  \\definecolor{{mainblue}}{{HTML}}{{{_hc}}} — #{_hc}',
            f'  \\definecolor{{accentcolor}}{{HTML}}{{{_ac}}} — #{_ac}',
            f'  \\definecolor{{rulecolor}}{{HTML}}{{{_rc}}} — #{_rc}',
            '',
            '【★★★ 全体の雰囲気・トーンとしてのカラー指示 — 最重要 ★★★】',
            'これらの色はPDF全体の「ブランドの雰囲気」を作るための色です。',
            '強調文字だけに使うのではなく、文書全体のトーンとして統一的に使ってください:',
            '  1. ★ \\section*, \\subsection* の見出しテキスト → 必ず \\textcolor{mainblue}{見出しテキスト} で囲む',
            '  2. ★ 問題番号（問1, 問2, ...）→ 必ず \\textcolor{accentcolor}{\\textbf{問1}} のように色付け',
            '  3. ★ ヘッダー・フッターの装飾線や背景色 → mainblue / rulecolor',
            '  4. ★ 大問間の区切り線 → {\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}',
            '  5. ★ 配点表示・注記 → \\textcolor{mainblue}{...}',
            '  6. ★ ページ全体を見たとき、このブランドカラーが「紙面全体の色調」として認識されること',
            '  7. 黒色テキストは本文（問題文・解説の地の文）のみに使用する',
            '',
            '【図・グラフの色について】',
            '図やグラフの色はブランドカラーに縛られる必要はありません。',
            'リアルで教科書品質の自然な色彩を使ってください（blue, red, green 等）。',
            '',
            '★★★ 絶対禁止:',
            '  - 見出し・問題番号・区切り線を黒色(black)のままにすること',
            '  - 文書全体が黒っぽく見える出力（ブランドカラーが使われていない状態）',
            '  - \\definecolor の色定義を上書き・変更すること',
        ])
    else:
        _bp.extend([
            '★★★ カラー指示（最重要）: プリアンブルで mainblue, accentcolor, rulecolor の3色が\\definecolorで定義済みです。',
            'これらの色はPDF全体の「雰囲気・トーン」を作るための色です。強調文字だけでなく文書全体で使ってください。',
            '',
            '必ず以下のように使用すること:',
            '- ★ 見出し(\\section*等): \\textcolor{mainblue}{見出しテキスト}',
            '- ★ 問題番号: \\textcolor{accentcolor}{\\textbf{問題 1}}',
            '- ★ 区切り線: {\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}',
            '- ★ 配点・注記: \\textcolor{mainblue}{...}',
            '- 黒色テキストは本文の地の文のみ',
            '',
            '図やグラフの色はリアルで自然な色彩を使用してください（ブランドカラーに縛られない）。',
            '',
            '★★★ 絶対禁止: 見出し・問題番号・区切り線を黒色のままにすること。全体が黒っぽく見える出力。',
        ])
    if _bp:
        parts.append('【カラー・ブランディング指示（厳守）】\n' + '\n'.join(_bp) + '\n\n')

    return ''.join(parts)


def _sanitise_custom_request(custom_request: str) -> str:
    """ユーザのカスタムリクエストをサニタイズする。"""
    import re as _re
    sanitised = custom_request[:200].strip()
    sanitised = _re.sub(r'(ignore|forget|disregard|override)\s+(all|previous|above|system)', '', sanitised, flags=_re.IGNORECASE)
    sanitised = _re.sub(r'<[^>]+>', '', sanitised)
    sanitised = _re.sub(r'```.*?```', '', sanitised, flags=_re.DOTALL)
    return sanitised.strip()


def _build_stem_system_prompt(subject: str, prompt_text: str,
                               preset_instr: str,
                               is_physics: bool,
                               include_diagram_per_question: bool,
                               custom_request: str,
                               brand_name: str = '',
                               paper_colors: Optional[Dict[str, str]] = None,
                               is_chemistry: bool = False,
                               is_biology: bool = False) -> str:
    """STEM科目用：スケルトン駆動型のシステムプロンプト。

    ルールを列挙するのではなく、具体的な完成形を見せることで
    Thinkingモードなしでも安定したLaTeX出力を実現する。
    科目ごとに必要な図ルールのみを含め、不要なルールは含めない。
    """
    parts = []

    # ── 役割（短く明確に） ──
    parts.append(
        'あなたは理系教科の試験問題をLaTeXで作成する専門アシスタントです。\n'
        '★★★ 最重要ルール: 出力の最初の文字は必ず \\documentclass でなければならない。\n'
        '問題文やコメントから書き始めることは絶対禁止。\n'
        '\\documentclass から \\end{document} までの完全なLaTeX文書だけを出力してください。\n'
        'マークダウン(```等)・説明文・装飾行(===,---)は出力しないでください。\n'
        '出力は純粋なLaTeXソースコードのみ。それ以外の文字列は一切含めない。\n\n'
    )

    # ── 構造テンプレート（具体例ベース） ──
    parts.append(
        '【出力構造テンプレート】\n'
        '以下の構造に従って出力してください。%FILL は内容を埋める箇所です。\n\n'
        '\\documentclass[a4paper,11pt]{article}\n'
        '\\usepackage{iftex}\n'
        '\\ifpdftex\n'
        '  \\usepackage[utf8]{inputenc}\n'
        '  \\usepackage{CJKutf8}\n'
        '\\fi\n'
        '\\ifluatex\n'
        '  \\usepackage{luatexja}\n'
        '\\fi\n'
        '\\ifxetex\n'
        '  \\usepackage{xeCJK}\n'
        '\\fi\n'
        '\\usepackage{amsmath,amssymb}\n'
        '\\usepackage{enumitem}\n'
        '\\usepackage{geometry}\n'
        '\\geometry{margin=2cm}\n'
        '%FILL: 必要に応じて追加パッケージ(tikz等)\n\n'
        '\\begin{document}\n\n'
        '\\section*{\\textcolor{mainblue}{問題}}\n\n'
        '%FILL: 各問題を以下の形式で記述（★カラーを必ず使用）\n'
        '% \\textcolor{accentcolor}{\\textbf{問1}}\n'
        '% 問題文...\n'
        '% \\vspace{0.5em}\n'
        '% \\begin{enumerate}[(1)]\n'
        '%   \\item 小問...\n'
        '% \\end{enumerate}\n'
        '% {\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}\n'
        '% \\vspace{1em}\n\n'
        '\\newpage\n'
        '\\section*{\\textcolor{mainblue}{解答・解説}}\n\n'
        '%FILL: 各問の解答と解説\n'
        '% \\textcolor{accentcolor}{\\textbf{問1}}\n'
        '% 解答と途中式...\n\n'
        '\\end{document}\n\n'
    )

    # ── 数式の書き方（禁止リストではなく正しい書き方を示す） ──
    parts.append(
        '【数式の書き方（厳守）】\n'
        '- インライン数式: $a^2 + b^2 = c^2$\n'
        '- ディスプレイ数式: \\[ E = mc^2 \\]\n'
        '- 分数: \\frac{分子}{分母}  例: \\frac{1}{2}, \\frac{x+1}{x-1}\n'
        '- ★分数の厳守事項:\n'
        '  ○正: \\frac{x+1}{x-1}  ←{分子}{分母}の2つの{}が必須\n'
        '  ×誤: \\frac x+1 x-1   ←{}なしは絶対禁止\n'
        '  ×誤: \\frac{}{x}      ←空の分子/分母は禁止\n'
        '  ×誤: \\frac{x}        ←分母の{}が欠落\n'
        '- 入れ子分数: \\frac{\\frac{a}{b}}{c} （各\\fracに必ず2つの{}）\n'
        '  ×誤: \\frac{\\frac{a}{b}}{\\frac{c}} ←内側\\fracの分母{}が1つだけ\n'
        '- 関数: \\sin, \\cos, \\tan, \\log, \\ln, \\exp, \\lim, \\arctan\n'
        '- 根号: \\sqrt{x}, \\sqrt[3]{x}\n'
        '- 積分: \\int_0^1 f(x) \\, dx\n'
        '- 添字: $x_1$, $x_{10}$, $a_{ij}$ （2文字以上は{}で囲む）\n'
        '- 掛け算: \\times, \\cdot\n'
        '- $$...$$は使わない。\\[...\\]を使う。\n\n'
    )

    # ── ネスト安定化ルール（最重要・簡潔に） ──
    parts.append(
        '【ネスト規則（最重要・違反=コンパイルエラー）】\n'
        '1. \\begin{X}を書いたら、必ず同じ環境名で\\end{X}を書く。\n'
        '   ×誤: \\begin{enumerate} ... \\end{itemize} ←環境名不一致\n'
        '2. enumerate/itemize は最大2階層まで。3階層目は禁止。\n'
        '3. 各\\begin, \\endは独立した行に書く。\n'
        '4. 中括弧{}は開いたら必ず閉じる。出力完了前に{と}の数を数えて一致を確認。\n'
        '5. \\frac{A}{B}のA,Bは絶対に空にしない。\n'
        '6. 環境のネスト順序を厳守: 内側の環境は外側より先に閉じる。\n'
        '   ○正: \\begin{enumerate} \\begin{itemize} ... \\end{itemize} \\end{enumerate}\n'
        '   ×誤: \\begin{enumerate} \\begin{itemize} ... \\end{enumerate} \\end{itemize}\n\n'
    )

    # ── 禁止コマンド（短く） ──
    parts.append(
        '【使用禁止】\n'
        'tcolorbox, mdframed, fbox, \\mbox{}, \\hbox{}, \\\\[寸法]\n\n'
    )

    # ── 物理図ルール ──
    if is_physics:
        parts.append(
            '【物理の図（TikZ）— 厳密な描画ルール】\n'
            '- ★座標計算をコメントで先に書き、全座標を事前決定すること:\n'
            '  % === 座標計算 ===\n'
            '  % 床y=0, 物体底辺y=0（接触）, 物体上辺y=1.5\n'
            '  % 力F=mg, 矢印長さ=1.5, 作用点=(1,1.5), 終点=(1,3.0)\n'
            '- ★★ 接触ルール（最重要・違反厳禁）:\n'
            '  物体が面に置かれている場合、物体底辺のy座標 = 面のy座標にすること。\n'
            '  隙間が空いて物体が浮いて見えるのは絶対禁止。\n'
            '  正しい例:\n'
            '  \\draw[thick] (-2,0)--(4,0); % 床(y=0)\n'
            '  \\fill[pattern=north east lines] (-2,-0.3) rectangle (4,0);\n'
            '  \\draw[thick] (0,0) rectangle (2,1.5); % 物体(底辺y=0=床と同じ)\n'
            '- ★★ 力ベクトル・矢印の厳密ルール:\n'
            '  1. 矢印スタイル: \\draw[-{Stealth[length=3mm,width=2mm]},thick,<色>]\n'
            '     ×誤: \\draw[->]  ←矢先が小さすぎて見えない\n'
            '     ×誤: \\draw[-stealth] ←大文字Stealthが正しい\n'
            '  2. 作用点: 力が作用する正確な点から描く（重心or接触点）\n'
            '  3. 方向: 物理法則に厳密に従う（重力=下向き,垂直抗力=面に垂直,摩擦=面に平行）\n'
            '  4. 長さ: 力の大きさに比例させる。全ベクトルの縮尺を統一\n'
            '  5. ラベル位置: 矢印の先端または中点の横にnode[right/above]で配置\n'
            '  6. 力の分解: 元ベクトル=実線, 分解成分=dashed, 直角マーク=小正方形(0.2単位)\n'
            '     \\draw[dashed,-{Stealth[length=2.5mm]}] (P) -- (Px) node[below]{$F_x$};\n'
            '     \\draw ($(Px)+(0,0.2)$) -- ++(0.2,0) -- ++(0,-0.2); % 直角マーク\n'
            '- ラベルは物理記号: $F$, $v$, $m$, $\\theta$（日本語ラベル禁止）\n'
            '- 床面: \\fill[pattern=north east lines] でハッチング\n'
            '- 斜面: 三角関数で座標を正確に計算。物体は斜面上に密着させる\n'
            '  % 斜面角θ=30°, 底辺=L*cos30°, 高さ=L*sin30°\n'
            '- 角度表示: arc を使い、始角と終角を物理的に正確に指定\n'
            '  \\draw (0.8,0) arc[start angle=0,end angle=30,radius=0.8] node[midway,right]{$\\theta$};\n'
            '- ばね: coil decoration。回路: circuitikz\n'
            '- グラフ: pgfplots, samples=100以上\n'
            '- 滑車・糸: 糸は直線で、屈曲点は接線方向。滑車は小円で描く\n\n'
        )

    if include_diagram_per_question and is_physics:
        parts.append(
            '【物理図の必須ルール】\n'
            '各大問に必ず1つTikZ図を含めること。図のない大問は不可。\n\n'
        )

    # ── 化学図ルール ──
    if is_chemistry and not is_physics:
        parts.append(
            '【化学の図・構造式ルール】\n'
            '- 化学式: \\ce{} (mhchem) または \\ch{} (chemformula) を使用\n'
            '- 構造式: 単結合=実線, 二重=二重線, 三重=三重線\n'
            '- ウェッジ=太い三角, ダッシュ=破線三角\n'
            '- 反応機構: 曲がり矢印で電子移動を示す\n'
            '- 座標計算をコメントで書き検算すること\n\n'
        )

    # ── 生物図ルール ──
    if is_biology and not is_physics and not is_chemistry:
        parts.append(
            '【生物の図ルール】\n'
            '- 細胞膜: double線, 内部はfill色分け\n'
            '- DNA: sin/cos曲線+横棒で塩基対\n'
            '- 家系図: 男=□, 女=○, 患者=塗りつぶし\n'
            '- 代謝経路: 酵素名を矢印上に配置\n'
            '- 座標計算をコメントで書き検算すること\n\n'
        )

    # ── プリセット固有指示 ──
    if preset_instr:
        parts.append(f'{preset_instr}\n')

    # ── ユーザ追加要望 ──
    if custom_request:
        sanitised = _sanitise_custom_request(custom_request)
        if sanitised:
            parts.append(f'【ユーザからの追加要望】\n{sanitised}\n\n')

    # ── ブランディング指示 ──
    _bp = []
    if brand_name:
        _bp.append(f'- ヘッダー左側のタイトルには「{brand_name}」と表示してください。')
    if paper_colors:
        _hc = paper_colors.get('headerColor', '1A5276').lstrip('#')
        _ac = paper_colors.get('accentColor', _hc).lstrip('#')
        _rc = paper_colors.get('ruleColor', _hc).lstrip('#')
        _bp.extend([
            f'★★★ カラー指示（最重要）: プリアンブルで以下の3色が\\definecolorで定義済みです。',
            f'  \\definecolor{{mainblue}}{{HTML}}{{{_hc}}} — #{_hc}',
            f'  \\definecolor{{accentcolor}}{{HTML}}{{{_ac}}} — #{_ac}',
            f'  \\definecolor{{rulecolor}}{{HTML}}{{{_rc}}} — #{_rc}',
            '',
            '【★★★ 全体の雰囲気・トーンとしてのカラー指示 — 最重要 ★★★】',
            'これらの色はPDF全体の「ブランドの雰囲気」を作るための色です。',
            '強調文字だけに使うのではなく、文書全体のトーンとして統一的に使ってください:',
            '  1. ★ \\section*, \\subsection* の見出しテキスト → 必ず \\textcolor{mainblue}{見出しテキスト} で囲む',
            '  2. ★ 問題番号（問1, 問2, ...）→ 必ず \\textcolor{accentcolor}{\\textbf{問1}} のように色付け',
            '  3. ★ ヘッダー・フッターの装飾線や背景色 → mainblue / rulecolor',
            '  4. ★ 大問間の区切り線 → {\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}',
            '  5. ★ 配点表示・注記 → \\textcolor{mainblue}{...}',
            '  6. ★ ページ全体を見たとき、このブランドカラーが「紙面全体の色調」として認識されること',
            '  7. 黒色テキストは本文（問題文・解説の地の文）のみに使用する',
            '',
            '【図・グラフの色について】',
            '図やグラフの色はブランドカラーに縛られる必要はありません。',
            'リアルで教科書品質の自然な色彩を使ってください（blue, red, green 等）。',
            '',
            '★★★ 絶対禁止:',
            '  - 見出し・問題番号・区切り線を黒色(black)のままにすること',
            '  - 文書全体が黒っぽく見える出力（ブランドカラーが使われていない状態）',
            '  - \\definecolor の色定義を上書き・変更すること',
        ])
    else:
        _bp.extend([
            '★★★ カラー指示（最重要）: プリアンブルで mainblue, accentcolor, rulecolor の3色が\\definecolorで定義済みです。',
            'これらの色はPDF全体の「雰囲気・トーン」を作るための色です。強調文字だけでなく文書全体で使ってください。',
            '',
            '必ず以下のように使用すること:',
            '- ★ 見出し(\\section*等): \\textcolor{mainblue}{見出しテキスト}',
            '- ★ 問題番号: \\textcolor{accentcolor}{\\textbf{問題 1}}',
            '- ★ 区切り線: {\\color{rulecolor}\\rule{\\linewidth}{0.4pt}}',
            '- ★ 配点・注記: \\textcolor{mainblue}{...}',
            '- 黒色テキストは本文の地の文のみ',
            '',
            '図やグラフの色はリアルで自然な色彩を使用してください（ブランドカラーに縛られない）。',
            '',
            '★★★ 絶対禁止: 見出し・問題番号・区切り線を黒色のままにすること。全体が黒っぽく見える出力。',
        ])
    if _bp:
        parts.append('【カラー・ブランディング指示（厳守）】\n' + '\n'.join(_bp) + '\n\n')

    # ── 最終チェックリスト（LLMへのリマインダー） ──
    checklist = (
        '【出力前の最終チェック】\n'
        '☐ \\begin と \\end の数が一致している\n'
        '☐ { と } の数が一致している\n'
        '☐ enumerate/itemize のネストが2階層以内\n'
        '☐ \\frac{}{} に空の引数がない\n'
        '☐ \\documentclass で始まり \\end{document} で終わっている\n'
        '☐ 見出し・問題番号にカラーを適用したか\n'
    )
    if is_physics:
        checklist += (
            '☐ 物体が面に置かれている図: 底辺y座標=面y座標（隙間なし）か\n'
            '☐ TikZ図: 座標計算をコメントで書いて検算したか\n'
            '☐ 閉じた図形は -- cycle で閉じているか\n'
            '☐ 力ベクトルの矢印: -{Stealth[length=3mm]}を使っているか（->は禁止）\n'
            '☐ 力の方向が物理法則と一致しているか（重力=下, 抗力=面に垂直）\n'
        )
    elif is_chemistry or is_biology:
        checklist += (
            '☐ 図がある場合: 座標計算をコメントで書いて検算したか\n'
        )
    parts.append(checklist)

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
            '\\usetikzlibrary{arrows.meta,positioning,calc,shapes.geometric,patterns,decorations.pathmorphing}'
        ),
        'prompt_hint': (
            'TikZ が利用可能。\\begin{tikzpicture}...\\end{tikzpicture} で図を描く。\n'
            '【★★★ 厳密な座標計算と正確な図描画ルール — 必ず守ること ★★★】\n'
            '=== 計算の正確性 ===\n'
            '1. すべてのノード・描画に明示的な座標 (x,y) を cm 単位で指定する。相対配置 (right=of ...) だけに頼らない。\n'
            '2. 座標の一覧表を先にコメントで書いてから描画コードを書く（例: % A=(0,0), B=(3,0), C=(3,4)）。\n'
            '3. 閉じた図形（多角形・閉領域）は最後に -- cycle を付けるか、始点の座標に正確に戻る。\n'
            '4. 座標計算の検算を必ず行う:\n'
            '   - 直角三角形: 三平方の定理 $a^2+b^2=c^2$ で斜辺長を算出\n'
            '   - 正三角形: 辺の長さがすべて等しいか確認。高さ = 辺×√3/2\n'
            '   - 円: 中心座標と半径から円周上の点を cos/sin で正確計算\n'
            '   - 接線: 接点での法線方向を計算し、垂直関係を検証\n'
            '5. ★ 検算手順: 各図形について、描画前に以下をコメントで明記すること:\n'
            '   % 検算: AB = sqrt((x2-x1)^2+(y2-y1)^2) = sqrt(9+16) = 5\n'
            '   % 角度: atan2(y,x) = atan2(4,3) ≈ 53.13°\n'
            '6. ノード間の配線では、接続元と接続先の座標が一致しているか必ず確認する。\n'
            '\n'
            '=== リアルな図の品質ルール ===\n'
            '7. 線の太さ: 主要な図形は thick、補助線は thin、寸法線は very thin を使い分ける。\n'
            '8. 矢印: -{Stealth[length=3mm]} で統一。力・速度などのベクトル量は太い矢印 [very thick] を使う。\n'
            '9. 塗りつぶし: 強調部分は fill=gray!20 や pattern=north east lines 等で視覚的に区別する。\n'
            '10. ラベル配置: node[above], node[below right] 等で重なりを避ける。ラベルは数式モード $...$ で。\n'
            '11. 点線・破線の使い分け: 補助線 [dashed]、延長線 [dotted]、力の分解成分 [dashed,->]。\n'
            '12. 角度の弧: \\draw (orig) arc (start:end:radius) で描き、ラベル $\\theta$ を弧の中央に配置。\n'
            '\n'
            '=== 図形描画の正確性チェックリスト ===\n'
            '13. 平行線: 傾きが同じか（Δy/Δx が一致するか）確認。\n'
            '14. 垂直線: 内積がゼロか確認。\n'
            '15. 角の二等分線: 両側の角度が等しいか確認。\n'
            '16. 中点: M = ((x1+x2)/2, (y1+y2)/2) を正確に計算。\n'
            '17. 比例配分点: P = A + t*(B-A) で t の値を明記。\n'
            '18. 交点: 2直線の連立方程式を解いて座標を求める。\n'
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
            '電圧源 to[V,l=$V$] / to[sV,l=$v$], 電流源 to[I,l=$I$], ダイオード to[D]。\n'
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
            '   左辺は x=0 で統一、右辺は x=3 で統一、上辺は y=3 で統一、下辺は y=0 で統一。\n\n'
            '【★★ 素子内部の導線貫通を防止する描画順序ルール — 最重要 ★★】\n'
            '並列回路など、母線（水平/垂直の配線）と素子枝が交差する回路では\n'
            '素子の内部を導線が貫通して表示される問題が発生する。\n'
            '以下のルールを厳守すること:\n\n'
            'W1. 素子の描画順序に注意し、素子を含む枝を後から描画する。\n'
            'W2. ★描画順序★: 母線（素子を含まない配線）を先に描画し、\n'
            '    素子を含む枝を後から描画する。後から描画した素子の白背景が\n'
            '    先に描画した母線の線を隠すため、導線貫通が起きない。\n'
            'W3. 並列回路の正しい描画手順:\n'
            '   % Step 1: 母線（単純配線）を先に描画\n'
            '   \\draw (0,3.2) -- (8,3.2);          % 上側母線\n'
            '   \\draw (0,0)   -- (8,0);             % 下側母線\n'
            '   % Step 2: 素子枝を後から描画（白背景で母線を隠す）\n'
            '   \\draw (0,0) to[sV,l_=$v(t)$] (0,3.2);  % 電源\n'
            '   \\draw (2.6,3.2) to[R,l_=$R$] (2.6,0);  % 抵抗\n'
            '   \\draw (5.0,3.2) to[L,l_=$L$] (5.0,0);  % コイル\n'
            '   \\draw (7.4,3.2) to[C,l_=$C$] (7.4,0);  % コンデンサ\n'
            'W4. 直列回路では1本の \\draw パスで全素子を連続接続してよいが、\n'
            '    並列回路では必ず枝ごとに別の \\draw コマンドに分割すること。\n'
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
            'PGFPlots が利用可能。\\begin{tikzpicture}\\begin{axis}[...]...\\end{axis}\\end{tikzpicture} でグラフを描く。\n'
            '\n'
            '【美しいグラフ描画の指針 — 厳守】\n'
            '1. 関数プロット: \\addplot[domain=-3:3,samples=200,thick,blue]{x^2}; (samples は 100 以上)\n'
            '2. データプロット: \\addplot[only marks,mark=*,mark size=2pt] coordinates {(0,0)(1,1)(2,4)};\n'
            '3. 軸ラベル: xlabel={$x$}, ylabel={$y$} を必ず付ける。物理量の場合は単位も: ylabel={$v$ [m/s]}\n'
            '4. 軸範囲: xmin, xmax, ymin, ymax を明示的に指定して余白を適切に確保。\n'
            '5. グリッド: grid=both で目盛り線を表示。major grid style={gray!30} で薄く。\n'
            '6. 凡例: 複数のプロットがある場合 legend pos=north west 等で凡例を配置。\n'
            '7. 特殊点（頂点・交点・極値等）: \\addplot[only marks,mark=*,red] coordinates {(x,y)};\n'
            '   node[above right]{$(x_0, y_0)$} でラベルを付ける。\n'
            '8. 漸近線: \\draw[dashed,gray] (axis cs:x,ymin) -- (axis cs:x,ymax);\n'
            '9. 面積の塗りつぶし: \\addplot[fill=blue!15,draw=none,domain=a:b]{f(x)} \\closedcycle;\n'
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
    # ═══════ 分子生物学パッケージ ═══════
    'pgfmolbio': {
        'name': 'pgfmolbio（DNA・タンパク質配列）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usetikzlibrary{arrows.meta,positioning,calc,shapes.geometric,patterns,decorations.pathmorphing}'
        ),
        'prompt_hint': (
            'pgfmolbio スタイルの図が利用可能。TikZ で DNA/RNA/タンパク質を描画する。\n'
            '【リアルな生物学図の描画ルール — 厳守】\n'
            '1. DNA二重螺旋: sin/cos曲線を2本描き、塩基対を横棒で接続する。\n'
            '   \\draw[thick,blue!70] plot[domain=0:8,samples=200] ({0.4*cos(deg(\\x*60))},{\\x*0.5});\n'
            '   \\draw[thick,red!70] plot[domain=0:8,samples=200] ({-0.4*cos(deg(\\x*60))},{\\x*0.5});\n'
            '   塩基対は A-T(赤), G-C(青) で色分け。\n'
            '2. 配列表記: 5\'→3\' 方向を矢印で明示。各塩基を色付き□で表現。\n'
            '3. クロマトグラム: 4色(A=green, T=red, G=black, C=blue)の曲線を重ねて描く。\n'
            '4. タンパク質二次構造: αヘリックス=螺旋(decoration=coil), βシート=矢印(→)。\n'
        ),
    },
    'texshade': {
        'name': 'TeXshade（配列アラインメント）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usetikzlibrary{positioning}'
        ),
        'prompt_hint': (
            'マルチプルシーケンスアラインメント表示が利用可能。\n'
            '【配列アラインメント描画ルール】\n'
            '1. 各配列を等幅フォント(\\ttfamily)で横並びに表示する。\n'
            '2. 保存残基を色付き背景 (fill=blue!30) でハイライト。\n'
            '3. 一致記号: 完全一致=*, 類似=:, 弱類似=. を配列下段に表示。\n'
            '4. 配列番号を左端と右端に表示 (node[left]{1}, node[right]{30})。\n'
        ),
    },
    'genealogytree': {
        'name': 'genealogytree（家系図・系統図）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usetikzlibrary{arrows.meta,positioning,calc,shapes.geometric}'
        ),
        'prompt_hint': (
            '遺伝学の家系図描画が利用可能。TikZ で正確な家系図を描く。\n'
            '【リアルな家系図の描画ルール — 厳守】\n'
            '1. 男性: □(rectangle, minimum size=8mm), 女性: ○(circle, minimum size=8mm)。\n'
            '2. 患者(affected): fill=black で塗りつぶし。保因者: 半分塗り(半円fill)。\n'
            '3. 婚姻線: 夫婦を水平実線(thick)で接続。\n'
            '4. 子孫線: 婚姻線の中点から垂直に下ろし、子へ分岐。\n'
            '5. 世代(I, II, III...)を左端にローマ数字で表示。\n'
            '6. 発端者(proband)は矢印(→)で示す。死亡者は斜線(/)を重ねる。\n'
            '7. 近親婚は二重線(double)で表現。\n'
            '例: \\node[draw,rectangle,minimum size=8mm] (f1) at (0,4) {}; % 父\n'
            '    \\node[draw,circle,minimum size=8mm] (m1) at (2,4) {}; % 母\n'
            '    \\draw[thick] (f1) -- (m1); % 婚姻線\n'
        ),
    },
    # ═══════ 化学パッケージ ═══════
    'chemfig': {
        'name': 'ChemFig（有機構造式）',
        'usepackage': (
            '\\usepackage{chemfig}'
        ),
        'prompt_hint': (
            'ChemFig が利用可能。\\chemfig{} で有機構造式を描画する。\n'
            '【リアルな構造式の描画ルール — 厳守】\n'
            '1. 基本: \\chemfig{A-B=C~D} (単結合-, 二重結合=, 三重結合~)。\n'
            '2. 分岐: \\chemfig{A(-[2]X)(-[6]Y)-B} で上下に置換基を配置。\n'
            '3. 環構造: \\chemfig{*6(--=--=-)} でベンゼン環。\n'
            '4. ウェッジ・ダッシュ結合: \\chemfig{C(<[1]H)(<:[3]OH)-CH_3}。\n'
            '5. 反応矢印: \\schemestart A \\arrow{->[$\\Delta$]} B \\schemestop。\n'
            '6. 電子対: \\Lewis{0:2:4:6:,O} で孤立電子対を表示。\n'
        ),
    },
    'mhchem': {
        'name': 'mhchem（化学式・反応式）',
        'usepackage': (
            '\\usepackage[version=4]{mhchem}'
        ),
        'prompt_hint': (
            'mhchem が利用可能。\\ce{} で化学式・反応式を美しく記述する。\n'
            '例: \\ce{2H2 + O2 -> 2H2O}, \\ce{Fe^{2+}}, \\ce{SO4^{2-}}\n'
            '反応矢印: -> (正反応), <=> (平衡), ->[$\\Delta$] (条件付き)。\n'
            '沈殿矢印: \\ce{v} (↓), ガス発生: \\ce{^} (↑)。\n'
            'イオン式: \\ce{Na+ + Cl- -> NaCl}。\n'
        ),
    },
    'chemformula': {
        'name': 'chemformula（化学式拡張）',
        'usepackage': (
            '\\usepackage{chemformula}'
        ),
        'prompt_hint': (
            'chemformula が利用可能。\\ch{} で化学式を記述（mhchem の代替）。\n'
            '例: \\ch{2 H2 + O2 -> 2 H2O}, \\ch{Fe^{2+}}。\n'
        ),
    },
    'chemmacros': {
        'name': 'chemmacros（化学マクロ集）',
        'usepackage': (
            '\\usepackage{chemmacros}'
        ),
        'prompt_hint': (
            'chemmacros が利用可能。IUPAC命名法、酸化数、電子配置のマクロ集。\n'
            '例: \\iupac{2-methyl-propan-1-ol}, \\ox{+2,Fe}, \\orbital{s}。\n'
            'p, pKa: \\pH, \\pKa コマンドが使える。\n'
        ),
    },
    'modiagram': {
        'name': 'MOdiagram（分子軌道図）',
        'usepackage': (
            '\\usepackage{modiagram}'
        ),
        'prompt_hint': (
            'MOdiagram が利用可能。\\begin{MOdiagram}...\\end{MOdiagram} で分子軌道図を描く。\n'
            '例: \\begin{MOdiagram}\n'
            '  \\atom[left]{1s=1} \\atom[right]{1s=1}\n'
            '  \\molecule{1sMO={;pair}}\n'
            '\\end{MOdiagram}\n'
            'エネルギー準位を自動配置し、結合性/反結合性軌道を描画。\n'
        ),
    },
    # ═══════ 生体・医学系 ═══════
    'tikz-network': {
        'name': 'tikz-network（ネットワーク・経路図）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usetikzlibrary{arrows.meta,positioning,calc,shapes.geometric}'
        ),
        'prompt_hint': (
            '生体ネットワーク・代謝経路の図が利用可能。TikZ で描画する。\n'
            '【生体ネットワーク描画ルール】\n'
            '1. ノード: circle,draw,minimum size=10mm でタンパク質/代謝物を表現。\n'
            '2. 活性化矢印: [-{Stealth},thick,green!60!black] で正の制御。\n'
            '3. 抑制矢印: [-{Bar},thick,red!70] で負の制御（阻害）。\n'
            '4. 触媒: [-{Diamond},thick,blue] で酵素反応。\n'
            '5. 代謝経路は左→右または上→下に流れるように配置し、中間体を省略しない。\n'
            '6. フィードバックループは曲線矢印 (bend left/right) で表現。\n'
        ),
    },
    'algorithm2e': {
        'name': 'algorithm2e（擬似コード・アルゴリズム）',
        'usepackage': (
            '\\usepackage[ruled,vlined]{algorithm2e}'
        ),
        'prompt_hint': (
            'algorithm2e が利用可能。\\begin{algorithm}...\\end{algorithm} で擬似コードを記述。\n'
            '例: \\If{条件}{処理}\\ElseIf{条件}{処理}\\Else{処理}\n'
            '\\While{条件}{処理}, \\For{初期化}{条件}{更新}{処理}\n'
        ),
    },
    # ═══════ 統計・論文用 ═══════
    'siunitx': {
        'name': 'siunitx（SI単位系）',
        'usepackage': (
            '\\usepackage{siunitx}\n'
            '\\sisetup{inter-unit-product=\\ensuremath{\\cdot}}'
        ),
        'prompt_hint': (
            'siunitx が利用可能。SI単位を正確に表記する。\n'
            '例: \\qty{9.81}{m/s^2}, \\qty{2.998e8}{m/s}, \\qty{37.5}{\\degreeCelsius}\n'
            '数値のみ: \\num{1.23e-4}。単位のみ: \\unit{kg.m/s^2}。\n'
        ),
    },
    'booktabs': {
        'name': 'booktabs（学術論文用表）',
        'usepackage': (
            '\\usepackage{booktabs}'
        ),
        'prompt_hint': (
            'booktabs が利用可能。プロフェッショナルな表の罫線ルール。\n'
            '\\toprule, \\midrule, \\bottomrule で罫線を引く。\\cmidrule{l-r} で部分線。\n'
            '縦罫線は使用しない。表は tabular 環境内で使用。\n'
        ),
    },
    'datatool': {
        'name': 'datatool（データ処理）',
        'usepackage': (
            '\\usepackage{datatool}'
        ),
        'prompt_hint': (
            'datatool が利用可能。CSV データの読み込みと表の自動生成。\n'
        ),
    },
    # ═══════ レイアウト系 ═══════
    'subcaption': {
        'name': 'subcaption（図の並列配置）',
        'usepackage': (
            '\\usepackage{subcaption}'
        ),
        'prompt_hint': (
            'subcaption が利用可能。\\begin{subfigure}{0.48\\linewidth}...\\end{subfigure} で図を横並びに。\n'
            '各サブ図に \\caption{(a) 説明} で個別キャプションを付ける。\n'
        ),
    },
    'wrapfig': {
        'name': 'wrapfig（文章回り込み図）',
        'usepackage': (
            '\\usepackage{wrapfig}'
        ),
        'prompt_hint': (
            'wrapfig が利用可能。\\begin{wrapfigure}{r}{0.4\\linewidth}...\\end{wrapfigure} で文章回り込み。\n'
            'r=右寄せ, l=左寄せ。教科書風レイアウトに最適。\n'
        ),
    },
    'tikz-3dplot': {
        'name': 'tikz-3dplot（3D図形）',
        'usepackage': (
            '\\usepackage{tikz}\n'
            '\\usepackage{tikz-3dplot}'
        ),
        'prompt_hint': (
            'tikz-3dplot が利用可能。3D座標系で立体図形を描画。\n'
            '\\tdplotsetmaincoords{70}{110} で視点設定。\n'
            '\\begin{tikzpicture}[tdplot_main_coords] で3D座標フレームを開始。\n'
            '例: \\draw[->] (0,0,0) -- (3,0,0) node[right]{$x$};\n'
        ),
    },
    'smartdiagram': {
        'name': 'smartdiagram（フロー図・サイクル図）',
        'usepackage': (
            '\\usepackage{smartdiagram}'
        ),
        'prompt_hint': (
            'smartdiagram が利用可能。\\smartdiagram[type]{items} でフロー図を生成。\n'
            'type: flow diagram, circular diagram, descriptive diagram, priority descriptive diagram。\n'
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


# ── AI 使用回数制限 ──────────────────────────────────────────────────

def _ensure_usage_table():
    """usage_limits テーブルを作成する（未作成の場合）。"""
    try:
        conn = connect_db()
        is_sqlite = getattr(conn, '_is_sqlite', False)
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS usage_limits (
                    user_id TEXT PRIMARY KEY,
                    generation_count INTEGER DEFAULT 0,
                    unlocked INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS usage_limits (
                    user_id TEXT PRIMARY KEY,
                    generation_count INTEGER DEFAULT 0,
                    unlocked BOOLEAN DEFAULT false,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        logger.exception('Failed to create usage_limits table')


# Create table on module load
_ensure_usage_table()


def _get_usage(user_id: str) -> dict:
    """ユーザーの使用状況を取得する。"""
    limit = int(os.getenv('AI_GENERATION_LIMIT', '10'))
    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("SELECT generation_count, unlocked FROM usage_limits WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            count, unlocked = row[0], bool(row[1])
            return {
                'user_id': user_id,
                'generation_count': count,
                'limit': limit,
                'remaining': max(0, limit - count) if not unlocked else 999,
                'unlocked': unlocked,
            }
        return {
            'user_id': user_id,
            'generation_count': 0,
            'limit': limit,
            'remaining': limit,
            'unlocked': False,
        }
    except Exception:
        logger.exception('Failed to get usage')
        return {'user_id': user_id, 'generation_count': 0, 'limit': limit, 'remaining': limit, 'unlocked': False}


def _increment_usage(user_id: str):
    """使用回数をインクリメントする。"""
    try:
        conn = connect_db()
        is_sqlite = getattr(conn, '_is_sqlite', False)
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("""
                INSERT INTO usage_limits (user_id, generation_count) VALUES (%s, 1)
                ON CONFLICT(user_id) DO UPDATE SET generation_count = generation_count + 1
            """, (user_id,))
        else:
            cur.execute("""
                INSERT INTO usage_limits (user_id, generation_count) VALUES (%s, 1)
                ON CONFLICT(user_id) DO UPDATE SET generation_count = usage_limits.generation_count + 1
            """, (user_id,))
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        logger.exception('Failed to increment usage')


@app.get('/api/usage/{user_id}')
def get_usage(user_id: str):
    """ユーザーのAI使用状況を取得する。"""
    return JSONResponse(_get_usage(user_id))


class VerifyCodeRequest(BaseModel):
    code: str

@app.post('/api/verify_code')
def verify_code(req: VerifyCodeRequest = Body(...)):
    """生成ごとの認証コードを検証する。ADMIN_PASSWORD と一致すれば OK。"""
    admin_password = os.getenv('ADMIN_PASSWORD')
    if not admin_password:
        return JSONResponse({'error': 'ADMIN_PASSWORD が設定されていません。'}, status_code=500)
    if req.code != admin_password:
        return JSONResponse({'valid': False, 'error': '認証コードが正しくありません。'}, status_code=403)
    return JSONResponse({'valid': True})


class AdminUnlockRequest(BaseModel):
    password: str
    user_id: str


@app.post('/api/admin/unlock')
def admin_unlock(req: AdminUnlockRequest = Body(...)):
    """管理者パスワードでAI使用制限を解除する。"""
    admin_password = os.getenv('ADMIN_PASSWORD')
    if not admin_password:
        return JSONResponse({'error': 'ADMIN_PASSWORD が設定されていません。'}, status_code=500)

    if req.password != admin_password:
        return JSONResponse({'error': 'パスワードが正しくありません。'}, status_code=403)

    try:
        conn = connect_db()
        is_sqlite = getattr(conn, '_is_sqlite', False)
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("""
                INSERT INTO usage_limits (user_id, unlocked) VALUES (%s, 1)
                ON CONFLICT(user_id) DO UPDATE SET unlocked = 1
            """, (req.user_id,))
        else:
            cur.execute("""
                INSERT INTO usage_limits (user_id, unlocked) VALUES (%s, true)
                ON CONFLICT(user_id) DO UPDATE SET unlocked = true
            """, (req.user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return JSONResponse({'success': True, 'message': 'AI使用制限が解除されました。', 'usage': _get_usage(req.user_id)})
    except Exception as e:
        logger.exception('Failed to unlock usage')
        return JSONResponse({'error': f'解除に失敗しました: {e}'}, status_code=500)


# ── ベース問題検索 (出題パターン別) ──────────────────────────
@app.get('/api/problems_by_pattern')
def api_problems_by_pattern(template_id: str = '', limit: int = 20):
    """Return problems matching the given template's subject/field for base-question selection."""
    if not template_id:
        return JSONResponse({'problems': []})

    # Resolve subject/field from template metadata
    tpls = globals().get('TEMPLATES') or {}
    tpl = tpls.get(template_id, {})
    meta = tpl.get('metadata', {})
    subject = meta.get('subject', '')
    field = meta.get('field', '')

    try:
        conn = connect_db()
        cur = conn.cursor()
        if subject and field:
            cur.execute(
                "SELECT id, stem, solution_outline, difficulty, subject, topic "
                "FROM problems WHERE subject = %s AND topic = %s AND stem IS NOT NULL AND stem != '' "
                "ORDER BY RANDOM() LIMIT %s",
                (subject, field, limit)
            )
        elif subject:
            cur.execute(
                "SELECT id, stem, solution_outline, difficulty, subject, topic "
                "FROM problems WHERE subject = %s AND stem IS NOT NULL AND stem != '' "
                "ORDER BY RANDOM() LIMIT %s",
                (subject, limit)
            )
        else:
            cur.execute(
                "SELECT id, stem, solution_outline, difficulty, subject, topic "
                "FROM problems WHERE stem IS NOT NULL AND stem != '' "
                "ORDER BY RANDOM() LIMIT %s",
                (limit,)
            )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        problems = []
        for r in rows:
            problems.append({
                'id': r[0],
                'stem': (r[1] or '')[:200],
                'solution_outline': (r[2] or '')[:100],
                'difficulty': r[3],
                'subject': r[4],
                'topic': r[5],
            })
        return JSONResponse({'problems': problems, 'subject': subject, 'field': field})
    except Exception as e:
        logger.exception('problems_by_pattern failed')
        return JSONResponse({'problems': [], 'error': str(e)})


# ── ベースPDFバリデーション (3ページ制限 + 画像変換) ──────────────────────────
@app.post('/api/validate_base_pdf')
async def api_validate_base_pdf(file: UploadFile = File(...)):
    """Validate uploaded PDF. Reject if > 3 pages. Convert pages to base64 PNG images for LLM vision input."""
    MAX_PAGES = 3

    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail='PDFファイルのみアップロード可能です')

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='ファイルサイズが大きすぎます（最大20MB）')

    import base64 as b64

    # ── 1) PyMuPDF (fitz) でページ数取得 & 画像変換 (最も確実) ──
    images = []
    page_count = None
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype='pdf')
        page_count = doc.page_count
        logger.info('PDF opened with PyMuPDF: %d pages', page_count)
    except Exception as e:
        logger.warning('PyMuPDF open failed: %s', e)

    # ── 2) pypdf フォールバック (ページ数のみ) ──
    if page_count is None:
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(content), strict=False)
            page_count = len(reader.pages)
            logger.info('PDF opened with pypdf: %d pages', page_count)
        except Exception as e:
            logger.warning('pypdf PdfReader failed: %s', e)

    # ── 3) pdfinfo / pdftoppm フォールバック ──
    if page_count is None:
        pdfinfo_bin = shutil.which('pdfinfo')
        if pdfinfo_bin:
            try:
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                result = subprocess.run(
                    [pdfinfo_bin, tmp_path],
                    capture_output=True, text=True, timeout=10
                )
                os.unlink(tmp_path)
                for line in result.stdout.splitlines():
                    if line.lower().startswith('pages:'):
                        page_count = int(line.split(':')[1].strip())
                        break
            except Exception as e2:
                logger.warning('pdfinfo fallback failed: %s', e2)

    if page_count is None:
        raise HTTPException(
            status_code=400,
            detail='PDFの読み込みに失敗しました。ファイルが破損しているか、対応していない形式です。'
        )

    # ── ページ数制限: 4ページ以上は拒否 ──
    if page_count > MAX_PAGES:
        raise HTTPException(
            status_code=400,
            detail=f'PDFは{MAX_PAGES}ページ以内にしてください。（アップロードされたPDF: {page_count}ページ）'
        )

    # ── 画像変換: PyMuPDF → pdftoppm フォールバック ──

    def _is_blank_png(png_bytes: bytes, threshold: float = 0.995) -> bool:
        """Check if a PNG image is essentially blank (almost all white/transparent)."""
        try:
            import fitz as _fitz
            pix = _fitz.Pixmap(png_bytes)
            samples = pix.samples
            n = pix.n  # components per pixel (3=RGB, 4=RGBA)
            total = pix.width * pix.height
            if total == 0:
                return True
            white_count = 0
            for j in range(0, len(samples), n):
                # Check if pixel is very close to white
                if all(samples[j + c] > 248 for c in range(min(n, 3))):
                    white_count += 1
            ratio = white_count / total
            return ratio > threshold
        except Exception:
            # If we can't check, assume it's not blank
            return False

    # Method A: PyMuPDF (fitz) — 高品質、外部コマンド不要
    if not images:
        try:
            import fitz
            doc = fitz.open(stream=content, filetype='pdf')
            zoom = 2.0  # 200 DPI相当
            mat = fitz.Matrix(zoom, zoom)
            all_blank = True
            for i in range(min(page_count, MAX_PAGES)):
                pix = doc[i].get_pixmap(matrix=mat, alpha=False)
                png_data = pix.tobytes('png')
                if not _is_blank_png(png_data):
                    all_blank = False
                images.append(b64.b64encode(png_data).decode('ascii'))
                logger.info('PyMuPDF page %d: %d bytes PNG', i + 1, len(png_data))
            doc.close()
            # If all pages are blank, discard and try next method
            if all_blank:
                logger.warning('PyMuPDF rendered all pages as blank, trying pdftoppm')
                images = []
        except Exception as e:
            logger.warning('PyMuPDF image conversion failed: %s', e)
            images = []

    # Method B: pdftoppm (poppler) — フォールバック
    if not images:
        pdftoppm_bin = shutil.which('pdftoppm')
        if pdftoppm_bin:
            with tempfile.TemporaryDirectory() as tmpdir:
                pdf_path = os.path.join(tmpdir, 'input.pdf')
                with open(pdf_path, 'wb') as f:
                    f.write(content)
                try:
                    subprocess.run(
                        [pdftoppm_bin, '-png', '-r', '200', '-cropbox',
                         '-l', str(min(page_count, MAX_PAGES)),
                         pdf_path, os.path.join(tmpdir, 'page')],
                        capture_output=True, timeout=30, check=True
                    )
                    for i in range(1, min(page_count, MAX_PAGES) + 1):
                        for pattern in [f'page-{i}.png', f'page-{i:02d}.png', f'page-{i:03d}.png']:
                            img_path = os.path.join(tmpdir, pattern)
                            if os.path.exists(img_path):
                                with open(img_path, 'rb') as img_f:
                                    img_bytes = img_f.read()
                                    images.append(b64.b64encode(img_bytes).decode('ascii'))
                                break
                except Exception as e:
                    logger.warning('pdftoppm conversion failed: %s', e)

    # ── テキスト抽出 (画像がない場合のフォールバック用、または補助情報として) ──
    extracted_text = ''
    try:
        from pypdf import PdfReader
        reader2 = PdfReader(BytesIO(content), strict=False)
        texts = []
        for page in reader2.pages[:MAX_PAGES]:
            t = page.extract_text() or ''
            texts.append(t)
        extracted_text = '\n---PAGE BREAK---\n'.join(texts)
    except Exception:
        pass

    resp = {
        'valid': True,
        'page_count': page_count,
        'filename': file.filename,
        'images': images,
        'has_images': len(images) > 0,
        'extracted_text': extracted_text,
    }
    logger.info('validate_base_pdf response: %d pages, %d images, text_len=%d',
                page_count, len(images), len(extracted_text))
    return JSONResponse(resp)


# ── OpenAI GPT LLM → PDF ワンクリック生成 ──────────────────────────
# ── モデルティア定義 ──────────────────────────────────────
# フロントエンドの MODEL_TIERS と対応
_MODEL_TIERS = {
    'lite':     {'model': 'gpt-4o',   'label': 'ライト'},
    'standard': {'model': 'gpt-5.2',  'label': 'スタンダード'},
    'premium':  {'model': 'gpt-5.4',  'label': 'プレミアム'},
}
# 教科→ティア自動マッピング（model_tier='auto' 時に使用）
_SUBJECT_TIER_MAP = {
    '英語': 'lite', '国語': 'lite', '社会': 'lite', '情報': 'lite',
    # 上記以外（数学・物理・化学・生物 等）→ standard
}

# ── LLM 生成ジョブストア（ポーリング方式） ──────────────────────────
# Vercel/Koyeb のプロキシタイムアウト (60秒) を超える長時間 OpenAI API 呼び出しに対応するため、
# 即座に job_id を返し、バックグラウンドで処理、フロントエンドがポーリングで結果取得する設計。
_LLM_JOBS: Dict[str, Dict[str, Any]] = {}
_LLM_JOB_TTL = 600  # 10分間保持


def _cleanup_old_jobs():
    """期限切れのジョブを削除する。"""
    now = time.time()
    expired = [jid for jid, job in _LLM_JOBS.items() if now - job.get('created_at', 0) > _LLM_JOB_TTL]
    for jid in expired:
        _LLM_JOBS.pop(jid, None)


def _resolve_model(model_tier: str, subject: str) -> tuple:
    """モデルティアと教科からOpenAIモデル名を解決する。
    Returns (model_name, tier_id)"""
    env_default = os.getenv('OPENAI_MODEL', 'gpt-5.2')
    tier = model_tier or 'auto'

    if tier == 'auto':
        # 教科に応じて自動選択
        resolved_tier = _SUBJECT_TIER_MAP.get(subject, 'standard')
    elif tier in _MODEL_TIERS:
        resolved_tier = tier
    else:
        resolved_tier = 'standard'

    tier_info = _MODEL_TIERS.get(resolved_tier, _MODEL_TIERS['standard'])
    # 環境変数でモデル名を上書き可能（例: OPENAI_MODEL_LITE=gpt-4o-mini）
    env_key = f'OPENAI_MODEL_{resolved_tier.upper()}'
    model_name = os.getenv(env_key, tier_info['model'])

    return model_name, resolved_tier


class LlmGenerateRequest(BaseModel):
    prompt: str
    latex_preset: Optional[str] = 'exam'
    title: Optional[str] = 'Generated Problems'
    extra_packages: Optional[List[str]] = []
    subject: Optional[str] = ''
    field: Optional[str] = ''
    # Question format: 'standard' | 'fill_in_blank' | 'choice' | 'true_false'
    question_format: Optional[str] = 'standard'
    # Number of questions to generate (used for cost control)
    num_questions: Optional[int] = 3
    # Sub-topic / theme (maps to DB subtopic column)
    sub_topic: Optional[str] = None
    # Physics: include a TikZ diagram for each major question
    include_diagram_per_question: Optional[bool] = False
    # Diagram realism: enable high-quality realistic diagram rendering instructions
    diagram_realism: Optional[bool] = True
    # User custom request (free text, max 200 chars, sanitised)
    custom_request: Optional[str] = None
    # User ID for usage tracking
    user_id: Optional[str] = None
    # Base PDF images (base64 PNG) for vision input
    base_pdf_images: Optional[List[str]] = None
    # Base problem text from DB
    base_problem_text: Optional[str] = None
    # Branding: service name to display in PDF header
    brand_name: Optional[str] = None
    # Branding: logo image as base64 data URL
    brand_logo_url: Optional[str] = None
    # Branding: paper color theme ID
    paper_theme: Optional[str] = None
    # Branding: resolved paper theme colors (header_color, accent_color, rule_color) as hex
    paper_colors: Optional[Dict[str, str]] = None
    # Model tier: 'auto' | 'lite' | 'standard' | 'premium'
    model_tier: Optional[str] = 'auto'


def _postprocess_llm_latex(raw_text: str) -> str:
    """LLM 生の出力テキストから LaTeX を抽出・修復する共通ヘルパー。"""
    if not raw_text:
        return ''
    latex_text = raw_text

    # Strip markdown code fences if present
    if latex_text.startswith('```'):
        lines = latex_text.split('\n')
        if lines[-1].strip() == '```':
            lines = lines[1:-1]
        elif lines[0].strip().startswith('```'):
            lines = lines[1:]
        latex_text = '\n'.join(lines).strip()

    latex_text = re.sub(r'^```(?:latex|tex)?\s*$', '', latex_text, flags=re.MULTILINE)
    latex_text = re.sub(r'^```\s*$', '', latex_text, flags=re.MULTILINE)
    latex_text = latex_text.strip()

    # Auto-repair: If LLM skipped \documentclass, wrap in minimal preamble
    if '\\documentclass' not in latex_text:
        logger.warning('LLM output missing \\documentclass — auto-wrapping with preamble')
        _auto_preamble = (
            '\\documentclass[a4paper,11pt]{article}\n'
            '\\usepackage{iftex}\n'
            '\\ifpdftex\n'
            '  \\usepackage[utf8]{inputenc}\n'
            '  \\usepackage{CJKutf8}\n'
            '\\fi\n'
            '\\ifluatex\n'
            '  \\usepackage{luatexja}\n'
            '\\fi\n'
            '\\ifxetex\n'
            '  \\usepackage{xeCJK}\n'
            '\\fi\n'
            '\\usepackage{amsmath,amssymb}\n'
            '\\usepackage{enumitem}\n'
            '\\usepackage{geometry}\n'
            '\\geometry{margin=2cm}\n'
            '\\usepackage{tikz}\n'
            '\\usetikzlibrary{arrows.meta,patterns,decorations.pathmorphing,calc}\n'
            '\\usepackage{pgfplots}\n'
            '\\pgfplotsset{compat=1.18}\n'
        )
        if '\\begin{document}' not in latex_text:
            latex_text = _auto_preamble + '\n\\begin{document}\n\n' + latex_text
            if '\\end{document}' not in latex_text:
                latex_text += '\n\n\\end{document}\n'
        else:
            bd_match = re.search(r'\\begin\{document\}', latex_text)
            if bd_match:
                latex_text = _auto_preamble + '\n' + latex_text
            else:
                latex_text = _auto_preamble + '\n\\begin{document}\n\n' + latex_text + '\n\n\\end{document}\n'

    try:
        latex_text = _unescape_latex(latex_text)
    except Exception:
        pass
    try:
        latex_text = _collapse_internal_newlines(latex_text)
    except Exception:
        pass

    dc_match = re.search(r'\\documentclass', latex_text)
    if dc_match and dc_match.start() > 0:
        before_dc = latex_text[:dc_match.start()]
        if not re.search(r'\\[a-zA-Z]', before_dc):
            latex_text = latex_text[dc_match.start():]
    end_doc_match = re.search(r'\\end\{document\}', latex_text)
    if end_doc_match:
        latex_text = latex_text[:end_doc_match.end()]

    try:
        latex_text = _repair_latex_nesting(latex_text)
    except Exception:
        pass

    return latex_text


async def _run_llm_job(job_id: str, openai_key: str, openai_model: str,
                        resolved_tier: str, system_instruction: str,
                        user_content_parts, dynamic_max_tokens: int,
                        user_id: str):
    """バックグラウンドで OpenAI API を呼び出し、結果を _LLM_JOBS に格納する。"""
    openai_url = 'https://api.openai.com/v1/chat/completions'

    # 推論モデル (o-series) は temperature / system ロールをサポートしない
    _is_reasoning = bool(re.match(r'^(o1|o3|o4)', openai_model))

    messages = []
    if _is_reasoning:
        # 推論モデルでは 'developer' ロールを使用
        messages.append({'role': 'developer', 'content': system_instruction})
    else:
        messages.append({'role': 'system', 'content': system_instruction})
    messages.append({'role': 'user', 'content': user_content_parts})

    openai_payload = {
        'model': openai_model,
        'messages': messages,
        'max_completion_tokens': dynamic_max_tokens,
    }
    # 推論モデルは temperature をサポートしない
    if not _is_reasoning:
        openai_payload['temperature'] = 0.3

    logger.info('OpenAI request: model=%s, max_tokens=%d, is_reasoning=%s',
                openai_model, dynamic_max_tokens, _is_reasoning)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=30.0)) as client:
            resp = await client.post(
                openai_url,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {openai_key}',
                },
                json=openai_payload,
            )

        if resp.status_code != 200:
            error_detail = f'HTTP {resp.status_code}'
            try:
                error_body = resp.json()
                error_detail = error_body.get('error', {}).get('message', error_detail)
            except Exception:
                error_detail = resp.text[:500] if resp.text else error_detail
            logger.error('OpenAI API error: %s (model=%s)', error_detail, openai_model)
            _LLM_JOBS[job_id]['status'] = 'error'
            _LLM_JOBS[job_id]['error'] = f'OpenAI API エラー: {error_detail}'
            return

        body = resp.json()
        logger.info('OpenAI response keys: %s (model=%s)',
                     list(body.keys()) if isinstance(body, dict) else type(body).__name__,
                     openai_model)

        # ── レスポンスからテキストを抽出 ──
        # Responses API 形式 (output[].content[].text) にも対応
        raw_text = ''

        choices = body.get('choices', [])
        if choices:
            message = choices[0].get('message') or {}
            finish_reason = choices[0].get('finish_reason', '')
            content = message.get('content')

            # content がリスト形式 (multimodal) の場合
            if isinstance(content, list):
                text_parts = []
                for part in content:
                    if isinstance(part, dict) and part.get('type') == 'text':
                        text_parts.append(part.get('text', ''))
                    elif isinstance(part, str):
                        text_parts.append(part)
                raw_text = '\n'.join(text_parts)
            elif isinstance(content, str):
                raw_text = content
            # content が None の場合 — 代替フィールドを確認
            if not raw_text:
                # 推論モデルの reasoning_content
                reasoning = message.get('reasoning_content')
                if reasoning and isinstance(reasoning, str):
                    logger.info('Using reasoning_content as fallback (model=%s)', openai_model)
                    raw_text = reasoning
            if not raw_text:
                # モデルが生成を拒否した場合
                refusal = message.get('refusal')
                if refusal:
                    logger.error('OpenAI model refused: %s (model=%s)', refusal, openai_model)
                    _LLM_JOBS[job_id]['status'] = 'error'
                    _LLM_JOBS[job_id]['error'] = f'モデルが生成を拒否しました: {refusal}'
                    return
            if not raw_text:
                # 旧 completions 形式の text フィールド
                raw_text = choices[0].get('text', '')

            # finish_reason が content_filter の場合
            if finish_reason == 'content_filter' and not raw_text:
                logger.error('OpenAI content_filter triggered (model=%s)', openai_model)
                _LLM_JOBS[job_id]['status'] = 'error'
                _LLM_JOBS[job_id]['error'] = 'コンテンツフィルターにより生成がブロックされました。プロンプトを変更してお試しください。'
                return

            logger.info('OpenAI finish_reason=%s, content_type=%s, content_len=%d (model=%s)',
                        finish_reason, type(content).__name__,
                        len(raw_text) if raw_text else 0, openai_model)

        # choices が空の場合 — Responses API (output 形式) を試行
        if not raw_text and isinstance(body.get('output'), list):
            for out_item in body['output']:
                if isinstance(out_item, dict) and out_item.get('type') == 'message':
                    for c in (out_item.get('content') or []):
                        if isinstance(c, dict) and c.get('type') in ('output_text', 'text'):
                            raw_text += c.get('text', '')
            if raw_text:
                logger.info('Extracted text from Responses API output format (model=%s, len=%d)',
                            openai_model, len(raw_text))

        if not raw_text and isinstance(body.get('output_text'), str):
            raw_text = body['output_text']

        raw_text = raw_text.strip() if raw_text else ''

        if not choices and not raw_text:
            logger.error('OpenAI empty response. body keys: %s (model=%s)',
                         list(body.keys()) if isinstance(body, dict) else 'not-dict', openai_model)
            _LLM_JOBS[job_id]['status'] = 'error'
            _LLM_JOBS[job_id]['error'] = 'OpenAI からの応答が空です'
            return

        if not raw_text:
            finish_reason = choices[0].get('finish_reason', '') if choices else 'N/A'
            # finish_reason=length の場合: トークン上限が足りなかった
            body_preview = json.dumps(body, ensure_ascii=False)[:1000] if isinstance(body, dict) else str(body)[:1000]
            # usage 情報があればログに出す（推論トークンの消費量がわかる）
            usage_info = body.get('usage', {})
            logger.error(
                'OpenAI empty content. finish_reason=%s, model=%s, usage=%s, body_preview=%s',
                finish_reason, openai_model, json.dumps(usage_info, ensure_ascii=False), body_preview
            )
            if finish_reason == 'length':
                _LLM_JOBS[job_id]['status'] = 'error'
                _LLM_JOBS[job_id]['error'] = (
                    f'モデルの出力トークン上限に達しました (model={openai_model})。'
                    f'推論(thinking)にトークンが消費され、テキスト出力に割り当てるトークンが不足しました。'
                    f'問題数を減らすか、プロンプトを短くしてお試しください。'
                )
            else:
                _LLM_JOBS[job_id]['status'] = 'error'
                _LLM_JOBS[job_id]['error'] = f'OpenAI からのテキスト出力が空です (model={openai_model}, finish_reason={finish_reason})'
            return

        # LaTeX 後処理
        latex_text = _postprocess_llm_latex(raw_text)

        # 使用回数インクリメント
        if user_id and latex_text:
            _increment_usage(user_id)

        updated_usage = _get_usage(user_id) if user_id else None

        _LLM_JOBS[job_id]['status'] = 'completed'
        _LLM_JOBS[job_id]['result'] = {
            'latex': latex_text,
            'model': openai_model,
            'model_tier': resolved_tier,
            'usage': updated_usage,
        }
        logger.info('LLM job %s completed (model=%s, latex_len=%d)', job_id, openai_model, len(latex_text))

    except httpx.TimeoutException:
        logger.error('OpenAI API timeout for job %s', job_id)
        _LLM_JOBS[job_id]['status'] = 'error'
        _LLM_JOBS[job_id]['error'] = 'OpenAI API がタイムアウトしました。再度お試しください。'
    except Exception as e:
        logger.exception('LLM job %s failed unexpectedly', job_id)
        _LLM_JOBS[job_id]['status'] = 'error'
        _LLM_JOBS[job_id]['error'] = f'生成中にエラーが発生しました: {str(e)}'


@app.post('/api/generate_with_llm')
async def generate_with_llm(req: LlmGenerateRequest = Body(...)):
    """OpenAI GPT で LaTeX を生成する。ポーリング方式: 即座に job_id を返し、
    /api/generate_with_llm/status/{job_id} で結果を取得する。
    """
    # ── ゲストユーザーブロック ──
    user_id = req.user_id
    if not user_id or user_id == 'guest':
        return JSONResponse({
            'error': 'AI自動生成を使用するにはアカウント登録とログインが必要です。',
        }, status_code=403)

    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        return JSONResponse({'error': 'OPENAI_API_KEY が設定されていません。.env に OPENAI_API_KEY を追加してください。'}, status_code=500)

    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail='prompt is required')

    # ── 問題数制限 ──
    max_questions_limit = int(os.getenv('MAX_QUESTIONS_PER_GENERATION', '3'))
    req_num_questions = getattr(req, 'num_questions', None) or 3
    if req_num_questions > max_questions_limit:
        return JSONResponse({
            'error': f'1回の生成で作成できる問題数は最大{max_questions_limit}問です。',
            'max_questions': max_questions_limit,
        }, status_code=400)

    # ── AI 使用回数制限チェック ──
    user_id = req.user_id
    if user_id:
        usage_info = _get_usage(user_id)
        if not usage_info.get('unlocked', False) and usage_info.get('remaining', 0) <= 0:
            return JSONResponse({
                'error': f'AI生成の無料利用上限（{usage_info["limit"]}回）に達しました。管理者パスワードで上限を解除してください。',
                'usage': usage_info,
            }, status_code=429)

    # ── モデル解決 ──
    openai_model, resolved_tier = _resolve_model(req.model_tier or 'auto', req.subject or '')
    logger.info('Model resolved: tier=%s → model=%s (subject=%s)', resolved_tier, openai_model, req.subject)

    # ── システムプロンプト構築 ──
    preset_id = req.latex_preset or 'exam'
    preset_data = _load_latex_preset(preset_id)
    preset_instr = preset_data.get('prompt_instruction', '') if preset_data else ''

    system_instruction = _build_llm_system_prompt(
        subject=req.subject or '',
        prompt_text=req.prompt,
        preset_instr=preset_instr,
        include_diagram_per_question=bool(req.include_diagram_per_question),
        custom_request=req.custom_request or '',
        brand_name=req.brand_name or '',
        paper_colors=req.paper_colors or None,
    )

    extra_pkgs = req.extra_packages or []
    if extra_pkgs:
        system_instruction += '\n【利用可能な追加パッケージ（プリアンブルに既に追加済み）】\n'
        for pkg_id in extra_pkgs:
            pkg_def = DIAGRAM_PACKAGES.get(pkg_id)
            if pkg_def:
                system_instruction += f'- {pkg_def["name"]}: {pkg_def["prompt_hint"]}\n'
            else:
                system_instruction += f'- \\usepackage{{{pkg_id}}} が利用可能。\n'

    q_format = req.question_format or 'standard'
    if q_format != 'standard':
        fmt_instr = _QUESTION_FORMAT_INSTRUCTIONS.get(q_format, '')
        if fmt_instr:
            system_instruction += fmt_instr

    # ── ユーザーコンテンツ構築 ──
    base_context = ''
    if req.base_problem_text:
        base_context = (
            '\n\n【ベース問題（参考）】\n'
            '以下のベース問題を参考にして、同じ形式・難易度で類似問題を作成してください：\n'
            f'{req.base_problem_text}\n'
        )

    if req.base_pdf_images and len(req.base_pdf_images) > 0:
        prompt_text = req.prompt + (
            '\n\n【添付PDFについて】\n'
            '添付されたPDF画像はベースラインとなる問題です。'
            'このPDFの問題形式・構成・難易度を参考にして、同じスタイルで類似問題を作成してください。'
            'PDFの内容をそのままコピーするのではなく、同等レベルの新しい問題を生成してください。'
        )
        user_content_parts = [{'type': 'text', 'text': prompt_text}]
        for img_b64 in req.base_pdf_images:
            user_content_parts.append({
                'type': 'image_url',
                'image_url': {'url': f'data:image/png;base64,{img_b64}', 'detail': 'high'}
            })
    else:
        user_content_parts = req.prompt + base_context

    # GPT-5.x 系は内部推論(thinking)にトークンを消費するため、
    # max_completion_tokens を十分大きく設定する必要がある。
    # 推論トークン + 出力トークンの合計がこの値に収まる。
    _dynamic_max_tokens = max(16384, 4096 + 2000 * req_num_questions)

    # ── 古いジョブのクリーンアップ ──
    _cleanup_old_jobs()

    # ── ジョブ作成＆バックグラウンド実行 ──
    job_id = uuid.uuid4().hex
    _LLM_JOBS[job_id] = {
        'status': 'processing',
        'result': None,
        'error': None,
        'created_at': time.time(),
    }

    asyncio.create_task(_run_llm_job(
        job_id=job_id,
        openai_key=openai_key,
        openai_model=openai_model,
        resolved_tier=resolved_tier,
        system_instruction=system_instruction,
        user_content_parts=user_content_parts,
        dynamic_max_tokens=_dynamic_max_tokens,
        user_id=user_id,
    ))

    logger.info('LLM job %s started (model=%s)', job_id, openai_model)
    return JSONResponse({'job_id': job_id, 'status': 'processing'})


@app.get('/api/generate_with_llm/status/{job_id}')
async def generate_with_llm_status(job_id: str):
    """ポーリング用: LLM 生成ジョブのステータスを返す。"""
    job = _LLM_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='ジョブが見つかりません')

    if job['status'] == 'completed':
        result = job['result']
        # ジョブ完了後、少し待ってからクリーンアップ（再ポーリング対応）
        return JSONResponse({
            'status': 'completed',
            **result,
        })
    elif job['status'] == 'error':
        return JSONResponse({
            'status': 'error',
            'error': job['error'],
        }, status_code=200)  # フロントエンドがポーリングで処理するため 200 で返す
    else:
        return JSONResponse({'status': 'processing'})


# ── 受験生向け練習モード: 1回のリクエストで問題生成 → JSON返却 ──────────

class PracticeGenerateRequest(BaseModel):
    subject: str = '物理'
    topics: Optional[List[str]] = []
    difficulty: str = '応用'
    num_questions: int = 3
    user_id: Optional[str] = None
    model_tier: Optional[str] = 'auto'


_PRACTICE_JOBS: Dict[str, Dict[str, Any]] = {}
_PRACTICE_JOB_TTL = 600


def _cleanup_old_practice_jobs():
    now = time.time()
    expired = [jid for jid, job in _PRACTICE_JOBS.items() if now - job.get('created_at', 0) > _PRACTICE_JOB_TTL]
    for jid in expired:
        _PRACTICE_JOBS.pop(jid, None)


def _build_practice_system_prompt(subject: str, topics: list, difficulty: str, num_questions: int) -> str:
    """受験生向け練習モード専用のシステムプロンプトを構築する。
    LaTeX直接出力版: JSONにLaTeXを埋め込む方式を廃止し、
    構造化マーカー付きの生LaTeXを出力させる。パースエラーが原理的に発生しない。
    """
    topic_str = '、'.join(topics) if topics else '全分野'

    # ── 科目別 図描画ガイドライン（厳密版） ──
    if subject == '物理':
        figure_guide = r"""
【★★★ 物理 TikZ 図 — 必須ルール（厳守）★★★】
%%% FIGURE %%% には tikzpicture または circuitikz 環境を直接記述してください。
LaTeX をそのまま書けます（バックスラッシュの二重化は不要）。

■ コンパイルを確実にするための絶対ルール:
F1. \begin{tikzpicture}...\end{tikzpicture} の対応を必ず確認
F2. すべての \draw, \fill, \node 文は ; で終わること（セミコロン必須）
F3. 閉じた図形は --cycle で閉じる
F4. 矢印: [>=stealth,->] を使う
F5. node内の数式は $...$ で囲む
F6. \usetikzlibrary, \usepackage は書かない（preamble済み）
F7. circuitikz回路: to[battery1]/to[R]/to[C]/to[L] で閉ループ
F8. 色: red, blue, green!60!black, gray!30 等の標準色のみ
F9. 床面ハッチング: 面の下に \fill[pattern=north east lines] で斜線を入れる（必須）
    \fill[pattern=north east lines] (-0.2,-0.15) rectangle (5.5,0);
    \draw[thick] (-0.2,0)--(5.5,0);
F10. 力の分解: 元ベクトル=実線, 分解成分=dashed, 直角マーク=小正方形(0.2単位)
    \draw[dashed,>=stealth,->] (P)--(Px) node[below]{$F_x$};
    \draw ($(Px)+(0,0.2)$)--++(0.2,0)--++(0,-0.2); % 直角マーク
F11. 角度表示: arc を使い、始角と終角を物理的に正確に指定すること
    \draw (0.65,0) arc[start angle=0,end angle=30,radius=0.65];
    \node at (0.95,0.18) {$\theta$};
F12. ラベルは物理量記号（$F$, $v$, $m$, $\theta$ 等）のみ使う。日本語ラベル禁止

■ バネの描き方（★★★ 最重要 — 違反=物理的に不正確な図 ★★★）:
バネは必ず「螺旋コイル（coil decoration）」で描く。ジグザグ（zigzag）は絶対禁止。
必ず以下の形式を使うこと:

\draw[thick,decorate,decoration={coil, aspect=0.35, segment length=5pt, amplitude=8pt}]
    (始点x, 始点y) -- (終点x, 終点y);

パラメータの意味:
- aspect=0.35: 螺旋の前後比（0.35で自然なコイル形状）
- segment length=5pt: コイル1巻きの長さ（5pt推奨）
- amplitude=8pt: コイルの振れ幅（7〜9pt推奨）

★ 壁に固定された水平バネ:
\draw[thick,decorate,decoration={coil,aspect=0.35,segment length=5pt,amplitude=7pt}]
    (壁面x, 高さy)--(物体左端x, 高さy);
\node at (中間x, 高さy+0.27) {$k$};

★ 天井からの鉛直バネ:
\draw[thick,decorate,decoration={coil,aspect=0.35,segment length=5pt,amplitude=8pt}]
    (x, 天井y)--(x, 物体上端y);
\node[right] at (x+0.45, 中間y) {$k$};

★ 2つのバネで挟まれた物体:
左バネ: (壁x, y)--(物体左端x, y)
右バネ: (物体右端x, y)--(壁x, y)

禁止事項:
× decoration={zigzag} — ジグザグはバネではない
× 直線だけでバネを表現 — 螺旋を描くこと
× snake decoration — coil のみ使用
× バネのラベル省略 — 必ず $k$ を明示

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 座標計算の絶対原則（リアルな図の核心）:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
C1. 物体は台・斜面・床の「表面ぴったり」に配置する（内部侵入は厳禁）
C2. 斜面（角度θ°）上の物体配置は必ず \begin{scope}[shift={(x,y)},rotate=θ] を使う
    → shift 点 = 斜面面上の基点座標、rotate = 斜面角度
    → scope 内で y=0 が斜面面になる。物体を (-w/2, 0) rectangle ++(w, h) で配置すれば底辺が斜面上に乗る
C3. 力の矢印方向（絶対に守ること）:
    - 重力 mg: 常に真下 → 世界座標で (0, -1) 方向 → \draw[->] (cx,cy)--++(0,-Lmg)
    - 法線力 N: 斜面に垂直・斜面から離れる方向 → scope内なら真上 (0, +1) 方向 → \draw[->] (0,h/2)--++(0,LN)
      または世界座標で (-sinθ, cosθ) 方向 → θ=30°なら ++(-0.45*s, 0.78*s)
    - 摩擦力 f: 斜面に平行 → scope内なら横方向 (±1, 0) → \draw[->] (0,h/2)--++(±Lf, 0)
    - 張力 T: 紐の方向
C4. 斜面角 θ の頂点座標: 三角形底辺長 L → 頂点 (L, L*tanθ)
    θ=30°: tan30°≈0.577 → L=4 なら頂点 (4, 2.31)
    θ=45°: tan45°=1.000 → L=3 なら頂点 (3, 3.00)
    θ=60°: tan60°≈1.732 → L=3 なら頂点 (3, 5.20)
C5. 斜面面上の基点: 底から距離 s の点 = (s·cosθ, s·sinθ)
    θ=30°, s=2.5: 基点 = (2.17, 1.25)
    θ=45°, s=2.0: 基点 = (1.41, 1.41)
    ※ 滑車接線点は P3/P4 を参照（水平糸 → 中心 x±r で同 y, 鉛直糸 → 中心 y−r）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 斜面の描き方 — 完全ガイド（★★★ 最重要 ★★★）:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【斜面の構造を正確に理解すること】
斜面は「直角三角形」として描く。3つの頂点と辺の名前を正確に把握する:
  - 底辺: 水平な地面（(0,0)--(B,0)）
  - 高さ: 鉛直な壁（(B,0)--(B,H)）  ← 直角はここ
  - 斜辺: 物体が滑る面（(0,0)--(B,H)）= 斜面そのもの

ここで B = L·cosθ, H = L·sinθ（L は斜面の長さ、θ は水平との角度）

★ よくある間違いパターン（絶対禁止）:
× 斜面の三角形が直角三角形になっていない
× 角度θの位置が間違っている（θは底辺と斜辺の間=左下の角度）
× 斜面の傾斜と角度が視覚的に不一致（θ=30° なのに45°に見える等）
× 直角マーク □ の位置が間違っている（直角は右下の角）
× 物体が斜面の内部に埋まっている、または浮いている

【斜面の計算手順（必ずこの手順に従うこと）】
Step 1: 斜面角度 θ と斜面長さ L を決定
Step 2: 底辺 B = L·cosθ, 高さ H = L·sinθ を計算（小数点2位まで）
Step 3: 三角形を描画:
  \fill[gray!15] (0,0)--(B,0)--(B,H)--cycle;
  \draw[thick] (0,0)--(B,0)--(B,H)--cycle;
Step 4: 直角マーク（右下の角に）:
  \draw (B-0.25,0)--(B-0.25,0.25)--(B,0.25);
Step 5: 角度θ（左下の角に）:
  \draw (0.7,0) arc[start angle=0,end angle=θ,radius=0.7];
  \node at ({0.95*cos(θ/2)},{0.95*sin(θ/2)}) {$\theta$};
Step 6: 斜面上の物体配置（scope/rotate方式）:
  物体の中心位置 = 斜面の底から距離 s の点 = (s·cosθ, s·sinθ)
  \begin{scope}[shift={(s·cosθ, s·sinθ)},rotate=θ]
    \draw[fill=...] (-w/2,0) rectangle ++(w,h);
  \end{scope}
Step 7: 床のハッチング:
  \fill[pattern=north east lines] (-0.3,-0.2) rectangle (B+0.3,0);
  \draw[thick] (-0.3,0)--(B+0.3,0);

【角度別の数値早見表（計算ミス防止）】
θ=15°: cosθ=0.966, sinθ=0.259, tanθ=0.268
θ=20°: cosθ=0.940, sinθ=0.342, tanθ=0.364
θ=30°: cosθ=0.866, sinθ=0.500, tanθ=0.577
θ=37°: cosθ=0.799, sinθ=0.602, tanθ=0.754  (3:4:5三角形)
θ=45°: cosθ=0.707, sinθ=0.707, tanθ=1.000
θ=53°: cosθ=0.602, sinθ=0.799, tanθ=1.327  (3:4:5三角形)
θ=60°: cosθ=0.500, sinθ=0.866, tanθ=1.732

【斜面+滑車の組み合わせ】
斜面上端に滑車がある場合:
  - 滑車中心 = 斜面頂点の近く (B, H+r) または (B+offset, H)
  - 糸は斜面に沿って物体→斜面上端→滑車接線→鉛直方向に吊り下がる
  - 糸が斜面を突き抜けない（= 斜辺に沿わせる or 斜辺より上を通す）

【2つの斜面の組み合わせ（V字型/山型）】
  - 左斜面: (Xc,0)--(0,H)--cycle で左下がり
  - 右斜面: (Xc,0)--(2*Xc,H)--cycle で右下がり（対称）
  - 頂上の滑車: (Xc, H+r) に配置

【斜面の面ハッチング（必須）】
斜面の三角形内部を薄く塗りつぶし、床面にはハッチングを入れる:
  \fill[gray!15] (0,0)--(B,0)--(B,H)--cycle;      % 斜面内部
  \fill[pattern=north east lines] (-0.3,-0.2) rectangle (B+0.3,0);  % 床面

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 糸・滑車・接触の物理的正確性ルール（絶対厳守）:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P1. 物体は必ず面（床・台・斜面）の「上」に描く。物体の最下端 y ≥ 面の y（床が y=0 なら物体底辺 y=0）
    × 物体が床の中や下に埋まっている図は絶対禁止
P2. 吊り下げ物体は滑車・台の端より「下」に描く。台面 y=0 なら吊り下げ物体は y<0 の空間に自然に垂れる
P3. 滑車は「台や壁の端」に固定する。滑車中心の座標を明示コメントで書くこと
    例: % 滑車中心 (4.3, 0.35), 半径 r=0.2
P4. 糸の経路ルール（最重要）:
    a) 糸は物体の接続点→滑車の接線点まで「直線」で描く
    b) 滑車部分では円弧に沿って曲がり、反対側の接線点から次の直線が出る
    c) 水平方向から滑車に入る糸: 接線点は滑車の真横（中心と同じ y, 中心 x ± r）
    d) 鉛直方向に出る糸: 接線点は滑車の真下（中心 x, 中心 y - r）
    e) 糸が物体や壁を「貫通」してはならない
P5. 糸は「たるまない」= 常にピンと張った直線。曲線で描かない（滑車接触部を除く）
P6. 台の端から吊り下げる場合: 台の端に明確な「角」を描き、台面と側面の境界を示す
    \draw[thick] (4.5,0)--(4.5,-2.0); % 台の右側面
P7. 定滑車の支持構造を描く: 天井・壁・台からの支柱 \draw[thick] で滑車を支える

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 物理図パターン（精密な例）:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【力学: 斜面上の物体と力（θ=30°, scope方式で正確配置）】
% ── 計算過程（必ずコメントで明記すること）──
% θ=30°, 斜面長 L=4.0
% cosθ=0.866, sinθ=0.500, tanθ=0.577
% 底辺 B = L·cosθ = 4.0×0.866 = 3.46
% 高さ H = L·sinθ = 4.0×0.500 = 2.00
% 三角形の3頂点: (0,0), (3.46,0), (3.46,2.00)
% 直角は右下 (3.46,0) の角
% 物体配置: 斜面中点 s=2.0 → 基点 (2.0×0.866, 2.0×0.500) = (1.73, 1.00)
% 物体中心（世界座標）: shift+(0,0.3)回転後 ≈ (1.58, 1.26)
\begin{tikzpicture}[>=stealth,scale=1.2]
  % 床面ハッチング
  \fill[pattern=north east lines] (-0.3,-0.2) rectangle (3.76,0);
  \draw[thick] (-0.3,0)--(3.76,0);
  % 斜面（直角三角形）
  \fill[gray!15] (0,0)--(3.46,0)--(3.46,2.00)--cycle;
  \draw[thick] (0,0)--(3.46,0)--(3.46,2.00)--cycle;
  % 直角マーク（右下）
  \draw (3.21,0)--(3.21,0.25)--(3.46,0.25);
  % 角度θ（左下）
  \draw (0.7,0) arc[start angle=0,end angle=30,radius=0.7];
  \node at (0.95,0.2) {$\theta$};
  % 斜面上の物体（scope/rotate で底面を斜面に正確に合わせる）
  \begin{scope}[shift={(1.73,1.00)},rotate=30]
    \draw[fill=blue!20,thick] (-0.3,0) rectangle ++(0.6,0.6);
    \node at (0,0.3) {$m$};
    % 法線力: scope内で真上（= 世界座標で斜面に垂直）
    \draw[->,red,very thick] (0,0.6)--++(0,1.0) node[above]{$N$};
    % 摩擦力: scope内で斜面に沿って上向き
    \draw[->,green!60!black,thick] (-0.3,0.3)--++(-1.0,0) node[left]{$f$};
  \end{scope}
  % 重力: 世界座標で真下（物体中心の世界座標から）
  \draw[->,blue,very thick] (1.58,1.26)--++(0,-1.0) node[below]{$mg$};
\end{tikzpicture}

【力学: 斜面上の物体（θ=45°, 摩擦なし・滑り下り）】
% θ=45°, 斜面長 L=3.0
% cosθ=0.707, sinθ=0.707
% 底辺 B = 3.0×0.707 = 2.12, 高さ H = 3.0×0.707 = 2.12
% 物体配置: s=1.5 → 基点 (1.06, 1.06)
\begin{tikzpicture}[>=stealth,scale=1.2]
  \fill[pattern=north east lines] (-0.3,-0.2) rectangle (2.42,0);
  \draw[thick] (-0.3,0)--(2.42,0);
  \fill[gray!15] (0,0)--(2.12,0)--(2.12,2.12)--cycle;
  \draw[thick] (0,0)--(2.12,0)--(2.12,2.12)--cycle;
  \draw (1.87,0)--(1.87,0.25)--(2.12,0.25);
  \draw (0.55,0) arc[start angle=0,end angle=45,radius=0.55];
  \node at (0.75,0.25) {$\theta$};
  \begin{scope}[shift={(1.06,1.06)},rotate=45]
    \draw[fill=orange!20,thick] (-0.25,0) rectangle ++(0.5,0.5);
    \node at (0,0.25) {$m$};
    \draw[->,red,very thick] (0,0.5)--++(0,0.9) node[above]{$N$};
  \end{scope}
  \draw[->,blue,very thick] (0.88,1.24)--++(0,-0.9) node[below]{$mg$};
  % 運動方向（斜面下向き）
  \draw[->,orange,thick,dashed] (1.24,0.88)--++(0.35,-0.35) node[right]{$a$};
\end{tikzpicture}

【力学: 2物体+斜面+滑車（斜面上の物体Aと吊り下げ物体B）】
% θ=30°, 斜面長 L=5.0
% B_base = 5.0×0.866 = 4.33, H = 5.0×0.500 = 2.50
% 滑車: 斜面上端の角に設置 → 中心 (4.33, 2.50+0.25) = (4.33, 2.75), r=0.25
% 糸: 物体A → 斜面に沿って上 → 斜面上端 → 滑車 → 鉛直下 → 物体B
\begin{tikzpicture}[>=stealth,scale=1.0]
  \fill[pattern=north east lines] (-0.3,-0.2) rectangle (4.63,0);
  \draw[thick] (-0.3,0)--(4.63,0);
  \fill[gray!15] (0,0)--(4.33,0)--(4.33,2.50)--cycle;
  \draw[thick] (0,0)--(4.33,0)--(4.33,2.50)--cycle;
  \draw (4.08,0)--(4.08,0.25)--(4.33,0.25);
  \draw (0.6,0) arc[start angle=0,end angle=30,radius=0.6];
  \node at (0.85,0.18) {$\theta$};
  % 滑車（斜面上端に固定）: 中心 (4.33, 2.75), 半径 0.25
  \draw[thick] (4.33,2.50)--(4.33,2.50); % 支柱
  \fill[gray!30] (4.33,2.75) circle (0.25);
  \draw[thick] (4.33,2.75) circle (0.25);
  \fill (4.33,2.75) circle (1.5pt);
  % 物体A（斜面上, s=2.0 → 基点 (1.73,1.00)）
  \begin{scope}[shift={(1.73,1.00)},rotate=30]
    \draw[fill=blue!20,thick] (-0.3,0) rectangle ++(0.6,0.6);
    \node at (0,0.3) {$m_A$};
  \end{scope}
  % 糸: A上面中央 → 斜面に沿って → 滑車接線(左側,4.08,2.75) → 円弧 → 滑車真下(4.33,2.50) → 鉛直 → B上面
  \draw[thick] (1.58,1.56)--(4.08,2.75);
  \draw[thick] (4.08,2.75) arc[start angle=180,end angle=270,radius=0.25];
  \draw[thick] (4.33,2.50)--(4.33,1.0);
  % 物体B（吊り下げ）
  \draw[fill=red!20,thick] (4.03,0.3) rectangle ++(0.6,0.7);
  \node at (4.33,0.65) {$m_B$};
  \draw[->,blue,thick] (4.33,0.3)--++(0,-0.6) node[below]{$m_B g$};
\end{tikzpicture}

【力学: 水平面上の物体（押す力）】
\begin{tikzpicture}[>=stealth,scale=1.1]
  \fill[gray!10] (-0.2,-0.15) rectangle (5.5,0);
  \draw[thick] (-0.2,0)--(5.5,0);
  \draw[fill=orange!20,thick] (1.5,0) rectangle ++(1.0,1.0);
  \node at (2.0,0.5) {$m$};
  \draw[->,red,very thick] (2.5,0.5)--++(1.2,0) node[right]{$F$};
  \draw[->,blue,thick] (2.0,0.5)--++(0,-0.8) node[below]{$mg$};
  \draw[->,green!60!black,thick] (2.0,1.0)--++(0,0.7) node[above]{$N$};
\end{tikzpicture}

【力学: 螺旋バネ+物体（水平・床に接地）】
\begin{tikzpicture}[>=stealth,scale=1.1]
  \fill[gray!20] (0,-0.15) rectangle (0.15,0.85);
  \draw[thick] (0.15,-0.1)--(0.15,0.85);
  \fill[gray!10] (-0.2,-0.1) rectangle (5.0,0);
  \draw[thick] (-0.2,0)--(5.0,0);
  \draw[thick,decorate,decoration={coil,aspect=0.35,segment length=5pt,amplitude=7pt}]
    (0.15,0.35)--(2.2,0.35);
  \draw[fill=blue!20,thick] (2.2,0) rectangle ++(0.7,0.7);
  \node at (2.55,0.35) {$m$};
  \draw[->,red,thick] (2.9,0.35)--++(0.9,0) node[right]{$F$};
  \node at (1.17,0.62) {$k$};
\end{tikzpicture}

【力学: 螺旋バネ+物体（鉛直・つり下げ）】
\begin{tikzpicture}[>=stealth,scale=1.1]
  \fill[gray!20] (-0.7,3.2) rectangle (0.7,3.45);
  \draw[thick] (-0.7,3.2)--(0.7,3.2);
  \draw[thick,decorate,decoration={coil,aspect=0.35,segment length=5pt,amplitude=8pt}]
    (0,3.2)--(0,1.65);
  \draw[fill=blue!20,thick] (-0.35,1.25) rectangle ++(0.7,0.4);
  \node at (0,1.45) {$m$};
  \draw[->,blue,thick] (0,1.25)--++(0,-0.85) node[below]{$mg$};
  \draw[->,red,thick] (0,1.65)--++(0,0.7) node[right]{$T$};
  \node[right] at (0.45,2.4) {$k$};
\end{tikzpicture}

【電磁気: 直列回路（circuitikz）】
\begin{circuitikz}[scale=0.9,>=stealth]
  \draw (0,0) to[battery1,l_={$E$},invert] (0,2.8)
    to[short] (1.5,2.8)
    to[R,l={$R_1$}] (3.0,2.8)
    to[R,l={$R_2$}] (4.5,2.8)
    to[short] (4.5,0)
    to[short] (0,0);
\end{circuitikz}

【電磁気: 並列回路（circuitikz）】
\begin{circuitikz}[scale=0.85,>=stealth]
  \draw (0,0) to[battery1,l_={$E$},invert] (0,3.0)
    to[short] (4.5,3.0)
    to[short] (4.5,0)
    to[short] (0,0);
  \draw (1.5,3.0) to[R,l={$R_1$}] (1.5,0);
  \draw (3.0,3.0) to[R,l={$R_2$}] (3.0,0);
\end{circuitikz}

【熱力学: P-V グラフ】
\begin{tikzpicture}[>=stealth,scale=1.0]
  \draw[->] (0,0)--(4.5,0) node[right]{$V$};
  \draw[->] (0,0)--(0,3.5) node[above]{$P$};
  \draw[blue,very thick] (0.8,2.8)--(0.8,0.9) node[midway,left]{等積};
  \draw[red,very thick] (0.8,0.9)--(3.5,0.9) node[midway,below]{等圧};
  \draw[green!60!black,very thick] (3.5,0.9)..controls(2.5,1.8)..(0.8,2.8)
    node[midway,right]{断熱};
  \fill (0.8,2.8) circle (2pt) node[left]{A};
  \fill (0.8,0.9) circle (2pt) node[left]{B};
  \fill (3.5,0.9) circle (2pt) node[below]{C};
\end{tikzpicture}

【力学: 台上の物体+定滑車+吊り下げ物体（糸の経路を厳密に）】
% 構造: 台面 y=0, 台右端 x=4.5, 滑車中心 (4.5, 0.5) 半径 r=0.25
% 糸の経路: 物体A右面 → 水平に → 滑車接線(右端,真横 y=0.5) → 円弧90° → 滑車真下(4.5,0.25) → 鉛直に → 物体B上面
% 物体B: 台の右側面の外、y<0 の空間に吊り下がる
\begin{tikzpicture}[>=stealth,scale=1.0]
  % 台（水平面 y=0）+ ハッチング
  \fill[pattern=north east lines] (-0.2,-0.2) rectangle (4.5,0);
  \draw[thick] (-0.2,0)--(4.5,0);
  % 台の右側面（角を明示）
  \draw[thick] (4.5,0)--(4.5,-2.0);
  % 滑車（台右端に固定）: 中心 (4.5, 0.5), 半径 0.25
  \draw[thick] (4.5,0)--(4.5,0.25); % 支柱
  \fill[gray!30] (4.5,0.5) circle (0.25);
  \draw[thick] (4.5,0.5) circle (0.25);
  \fill (4.5,0.5) circle (1.5pt); % 軸
  % 物体A（台面上, 底辺 y=0）
  \draw[fill=blue!20,thick] (1.2,0) rectangle ++(1.0,0.8);
  \node at (1.7,0.4) {$m_A$};
  % 糸の経路（物理的に正確）
  % (1) A右面中央 (2.2, 0.5) → 滑車接線点・真横 (4.25, 0.5): 水平直線
  \draw[thick] (2.2,0.5)--(4.25,0.5);
  % (2) 滑車に沿って90°円弧: (4.25,0.5) → (4.5,0.25)
  \draw[thick] (4.25,0.5) arc[start angle=180,end angle=270,radius=0.25];
  % (3) 滑車真下 (4.5,0.25) → 物体B上面 (4.5,-0.6): 鉛直直線
  \draw[thick] (4.5,0.25)--(4.5,-0.6);
  % 物体B（吊り下げ, 上面 y=-0.6, 底面 y=-1.3）
  \draw[fill=red!20,thick] (4.15,-1.3) rectangle ++(0.7,0.7);
  \node at (4.5,-0.95) {$m_B$};
  % 力の矢印
  \draw[->,blue,thick] (4.5,-1.3)--++(0,-0.6) node[below]{$m_B g$};
  \draw[->,red,thick] (2.2,0.4)--++(0.8,0) node[above]{$T$};
  \draw[->,blue,thick] (1.7,0)--++(0,-0.6) node[below]{$m_A g$};
\end{tikzpicture}

【力学: アトウッド機（天井定滑車+左右吊り下げ）】
% 構造: 天井 y=3.0, 滑車中心 (2.5, 2.7) 半径 r=0.3
% 糸: 左物体上面 → 上へ → 滑車左接線(2.2,2.7) → 円弧 → 滑車右接線(2.8,2.7) → 下へ → 右物体上面
\begin{tikzpicture}[>=stealth,scale=1.0]
  % 天井
  \fill[pattern=north east lines] (0,3.0) rectangle (5.0,3.2);
  \draw[thick] (0,3.0)--(5.0,3.0);
  % 滑車（天井から吊り下げ）: 中心 (2.5, 2.7), 半径 0.3
  \draw[thick] (2.5,3.0)--(2.5,2.7); % 支柱
  \fill[gray!30] (2.5,2.7) circle (0.3);
  \draw[thick] (2.5,2.7) circle (0.3);
  \fill (2.5,2.7) circle (1.5pt); % 軸
  % 左の糸（鉛直）: 滑車左接線 (2.2,2.7) から下へ
  \draw[thick] (2.2,2.7)--(2.2,1.2);
  % 右の糸（鉛直）: 滑車右接線 (2.8,2.7) から下へ
  \draw[thick] (2.8,2.7)--(2.8,0.7);
  % 滑車上の円弧（左接線→右接線, 上側を通る）
  \draw[thick] (2.2,2.7) arc[start angle=180,end angle=0,radius=0.3];
  % 物体1（左, 上面 y=1.2）
  \draw[fill=blue!20,thick] (1.85,0.5) rectangle ++(0.7,0.7);
  \node at (2.2,0.85) {$m_1$};
  % 物体2（右, 上面 y=0.7）
  \draw[fill=red!20,thick] (2.45,0.0) rectangle ++(0.7,0.7);
  \node at (2.8,0.35) {$m_2$};
  % 力の矢印
  \draw[->,blue,thick] (2.2,0.5)--++(0,-0.6) node[below]{$m_1 g$};
  \draw[->,blue,thick] (2.8,0.0)--++(0,-0.6) node[below]{$m_2 g$};
\end{tikzpicture}

【波動: 正弦波・横波の描画】
\begin{tikzpicture}[>=stealth,scale=1.0]
  \draw[->] (-0.3,0)--(7.5,0) node[right]{$x$};
  \draw[->] (0,-1.5)--(0,1.8) node[above]{$y$};
  \draw[blue,very thick,domain=0:6.28,samples=100] plot(\x,{sin(\x r)});
  \draw[dashed,thin] (0,1)--++(6.28,0);
  \draw[dashed,thin] (0,-1)--++(6.28,0);
  \draw[<->] (0,-1.3)--(6.28,-1.3) node[midway,below]{$\lambda$};
  \draw[<->] (-0.5,0)--(-0.5,1) node[midway,left]{$A$};
  \fill (0,0) circle (2pt);
  \fill (6.28,0) circle (2pt);
\end{tikzpicture}

【波動: レンズと光路図（凸レンズ）】
\begin{tikzpicture}[>=stealth,scale=0.9]
  % 光軸
  \draw[->] (-4,0)--(5,0) node[right]{光軸};
  % レンズ（凸）
  \draw[thick,blue] (0,-2) to[out=10,in=-10] (0,2);
  \draw[thick,blue] (0,2) to[out=190,in=170] (0,-2);
  % 焦点
  \fill (2,0) circle (2pt) node[below]{$f$};
  \fill (-2,0) circle (2pt) node[below]{$f$};
  % 物体
  \draw[->,red,very thick] (-3,0)--(-3,1.5) node[above]{物体};
  % 光線
  \draw[orange,thick] (-3,1.5)--(0,1.5)--(5,-1.0);
  \draw[orange,thick] (-3,1.5)--(0,0)--(5,2.5);
\end{tikzpicture}

%%% FIGURE %%% を省略してよいのは「純粋な代数計算のみ」の問題だけです。
物理的状況がある問題（力学・電磁気・波動・熱力学等）は必ず図を描いてください。
グラフ: \draw[domain=a:b,samples=100] plot(\x,{func}) で正確に描くこと。

★ 最終確認チェックリスト（図を書いたら必ず確認）:
□ \begin{tikzpicture} と \end{tikzpicture} が 1対1 で対応しているか
□ \begin{scope} と \end{scope} が 1対1 で対応しているか
□ 物体の底面が台/斜面/床の表面に接触しているか（内部侵入していないか）
□ 吊り下げ物体は滑車/台端より下の空間にあり、床や台の中に埋まっていないか
□ 法線力 N は斜面に対して垂直方向を向いているか
□ 重力 mg は真下を向いているか（世界座標で (0,-1) 方向）
□ scope[shift,rotate] を使った斜面上配置では法線力も scope 内で真上を向いているか
□ 糸の経路: 物体→滑車接線→円弧→滑車接線→次の直線、と物理的に正しい経路か
□ 糸が壁・台・他の物体を貫通していないか
□ 滑車に支柱（天井/壁/台からの支持構造）が描かれているか
□ すべての \draw, \fill, \node 文が ; で終わっているか
□ --cycle で閉じるべき図形は --cycle で閉じているか
□ node 内の数式は $...$ で囲んでいるか
□ 床面に \fill[pattern=north east lines] のハッチングがあるか

★★★ 斜面専用チェックリスト（斜面図がある場合は全項目を確認）:
□ 三角関数の値を正確に計算したか（cos/sin/tan の小数値をコメントに明記）
□ 底辺 B = L·cosθ, 高さ H = L·sinθ を正確に計算したか
□ 三角形が直角三角形になっているか（3頂点: (0,0),(B,0),(B,H) で直角は右下）
□ 直角マーク □ が右下の角に描かれているか
□ 角度 θ の arc が左下の角に描かれているか（start angle=0, end angle=θ）
□ 斜面上の物体は scope[shift,rotate=θ] で配置されているか
□ shift の座標は (s·cosθ, s·sinθ) で正しく計算されているか
□ 物体が斜面の表面上にあり、斜面の内部に埋まっていないか
□ 摩擦力は scope 内で水平方向（斜面に平行）を向いているか
□ 斜面の角度が視覚的に正しく見えるか（30°は緩やか、45°は対称、60°は急）
"""
    elif subject == '化学':
        figure_guide = r"""
【★★★ 化学 TikZ 図 — 必須ルール（厳守）★★★】
%%% FIGURE %%% の中に tikzpicture で反応エネルギー図・グラフ等を記述してください。
LaTeX をそのまま書けます（バックスラッシュの二重化は不要）。

■ コンパイルを確実にするルール:
F1. \begin{tikzpicture}...\end{tikzpicture} の対応を確認
F2. すべての文は ; で終わる
F3. \usepackage, \usetikzlibrary は書かない（preamble済み）

■ 化学図パターン例:

【反応エネルギー図（ポテンシャルエネルギー曲線）】
\begin{tikzpicture}[>=stealth,scale=1.0]
  \draw[->] (0,0)--(6.5,0) node[right]{反応座標};
  \draw[->] (0,0)--(0,4.0) node[above]{エネルギー};
  \draw[blue,very thick] (0.5,1.0)..controls(2.0,1.0)..(2.5,3.2)..controls(3.0,1.8)..(5.5,1.8);
  \draw[dashed,thin] (0,1.0)--++(6,0) node[right,black,font=\small]{反応物};
  \draw[dashed,thin] (0,1.8)--++(6,0) node[right,black,font=\small]{生成物};
  \draw[dashed,thin] (0,3.2)--++(6,0) node[right,black,font=\small]{活性化状態};
  \draw[<->,red,thick] (4.8,1.0)--(4.8,1.8) node[midway,right,black]{$\Delta H$};
  \draw[<->,green!60!black,thick] (1.5,1.0)--(1.5,3.2) node[midway,right,black]{$E_a$};
\end{tikzpicture}

図が不要な場合は %%% FIGURE %%% セクションを省略してください。
"""
    elif subject == '数学':
        figure_guide = r"""
【★★★ 数学 TikZ 図 — 必須ルール（厳守）★★★】
%%% FIGURE %%% の中に tikzpicture でグラフや図形を記述してください。
LaTeX をそのまま書けます（バックスラッシュの二重化は不要）。

■ コンパイルを確実にするルール:
F1. \begin{tikzpicture}...\end{tikzpicture} の対応を確認
F2. すべての文は ; で終わる
F3. \usepackage, \usetikzlibrary は書かない（preamble済み）
F4. 関数グラフは domain=a:b, samples=80 以上で描画

■ 数学図パターン例:

【関数グラフ（二次関数）】
\begin{tikzpicture}[>=stealth,scale=0.8]
  \draw[->] (-2.5,0)--(3.0,0) node[right]{$x$};
  \draw[->] (0,-1.5)--(0,4.5) node[above]{$y$};
  \draw[blue,very thick,domain=-2.2:2.7,samples=80] plot(\x,{(\x-0.5)^2-1.25});
  \fill[red] (0.5,-1.25) circle (2.5pt) node[below right]{頂点};
  \fill (0,-1.0) circle (2pt) node[left]{$-1$};
  \draw[dashed,thin] (0,-1.25)--++(0.5,0)--(0.5,0);
  \node[below] at (0.5,0) {$\frac{1}{2}$};
  \node[left] at (0,-1.25) {$-\frac{5}{4}$};
\end{tikzpicture}

【確率: 樹形図】
\begin{tikzpicture}[>=stealth,grow=right,level distance=2.2cm,
  level 1/.style={sibling distance=2.8cm},
  level 2/.style={sibling distance=1.4cm}]
  \node {start}
    child { node {表} edge from parent[->]
      child { node {表} edge from parent[->] node[above,font=\small]{$\frac{1}{2}$} }
      child { node {裏} edge from parent[->] node[below,font=\small]{$\frac{1}{2}$} }
      edge from parent node[above,font=\small]{$\frac{1}{2}$}
    }
    child { node {裏} edge from parent[->]
      child { node {表} edge from parent[->] node[above,font=\small]{$\frac{1}{2}$} }
      child { node {裏} edge from parent[->] node[below,font=\small]{$\frac{1}{2}$} }
      edge from parent node[below,font=\small]{$\frac{1}{2}$}
    };
\end{tikzpicture}

図が不要な純粋計算問題は %%% FIGURE %%% セクションを省略してください。
"""
    else:
        figure_guide = r"""
【図のガイドライン】
%%% FIGURE %%% の中に tikzpicture でグラフや概念図を記述できます。
コンパイルエラーを防ぐため:
- \begin{tikzpicture}...\end{tikzpicture} の対応を確認
- すべての文は ; で終わる
- \usepackage, \usetikzlibrary は書かない
不要な場合は %%% FIGURE %%% セクションを省略してください。
"""

    return f"""あなたは日本の大学受験{subject}の問題作成の最高権威です。
センター試験・共通テスト・国公立大二次・早慶の過去問と完全に同等の品質で練習問題を作成してください。

【生成条件】
- 科目: {subject}
- 分野: {topic_str}
- 難易度: {difficulty}
- 問題数: {num_questions}問（各問題に小問 2〜3 問含む）
{figure_guide}
【数式の記法ルール（厳守）】
- インライン数式: $a^2 + b^2 = c^2$
- ディスプレイ数式: \\[...\\] を使用。$$ は絶対禁止。
- 分数: \\frac{{分子}}{{分母}} — 必ず2つの {{}} を書く
  ○正: \\frac{{x+1}}{{x-1}}  ← {{分子}}{{分母}}が必須
  ×誤: \\frac x+1 x-1       ← {{}} なしは禁止
  ×誤: \\frac{{}}{{x}}       ← 空の分子・分母は禁止
  ×誤: \\frac{{x}}           ← 分母の {{}} が欠落
- 入れ子分数: \\frac{{\\frac{{a}}{{b}}}}{{c}} — 各 \\frac に必ず2つの {{}}
- 関数名: 必ずバックスラッシュ付き \\sin, \\cos, \\tan, \\log, \\ln, \\exp, \\lim, \\arctan
  ×誤: sin x  ○正: \\sin x
- 添字: 2文字以上は {{}} で囲む: $x_1$, $x_{{10}}$, $a_{{ij}}$
- 根号: \\sqrt{{x}}, \\sqrt[3]{{x}}
- 積分: \\int_0^1 f(x) \\, dx
- 掛け算: \\times, \\cdot
- 単位: \\mathrm{{}} で記述: $9.8\\,\\mathrm{{m/s^2}}$
- align*/cases 等の行末改行: \\\\ のみ。\\\\[2mm] 等の寸法付き改行は禁止

【ネスト・環境整合ルール（厳守 — 違反=コンパイルエラー）】
N1. \\begin{{X}} を書いたら、必ず同じ環境名で \\end{{X}} を書く
    ×誤: \\begin{{align*}}...\\end{{equation}} ← 環境名不一致
N2. 中括弧 {{}} は開いたら必ず閉じる。出力完了前に {{ と }} の数を数えて一致を確認
N3. 環境のネスト順序を厳守: 内側の環境は外側より先に閉じる
    ○正: \\begin{{A}}\\begin{{B}}...\\end{{B}}\\end{{A}}
    ×誤: \\begin{{A}}\\begin{{B}}...\\end{{A}}\\end{{B}} ← 順序逆
N4. tikzpicture 内の \\begin{{scope}}...\\end{{scope}} も必ずペアで閉じる
N5. \\left と \\right は必ずペアで使う（片方だけは禁止）
N6. \\frac{{A}}{{B}} の A, B は絶対に空にしない

【出力ルール — LaTeX直接出力（JSONは使わない）】

★★★ 最重要: JSON形式ではなく、以下の構造化マーカー付きLaTeXテキストで出力してください。
LaTeXコマンドはそのまま書いてください（バックスラッシュの二重化は不要です）。

★★★ マーカーに関する絶対ルール:
- %%% マーカー行は必ず独立した行に書く（前後に他テキストを混在させない）
- 問題本文・解答・解説の中に %%% を絶対に書かない
- PROBLEM番号は必ず 1, 2, 3 ... と連番にする（スキップ禁止）
- END PROBLEM N は対応するPROBLEM N の番号と一致させる

1. 数式は LaTeX 記法（インライン: $...$、ディスプレイ: \\[...\\]）で書いてください。
2. stem（状況設定）は実際の入試問題と同等の詳細な条件を記載してください。
   - 全ての数値・単位を明示（例: 質量 $m = 2.0\\,\\mathrm{{kg}}$, $g = 9.8\\,\\mathrm{{m/s^2}}$）
   - 「ただし〜」「〜とする」の条件節を必ず入れる
3. 小問は誘導形式（2〜3 問）にしてください。
4. 各小問には配点を必ず設定してください。1問あたりの合計は25点とし、小問ごとに配分してください。
   %%% POINTS (N) %%% マーカーで各小問の配点を必ず明記すること。配点 0 は禁止です。
   例: 小問3つなら 8+8+9=25、小問2つなら 12+13=25 のように合計25点にする。
5. 解答は数式で正確に記載。
6. 解説は法則の適用 → 式変形 → 数値代入の順で段階的に記載。
7. 各小問に %%% SCORING (N) %%% マーカーで配点基準を必ず記載。部分点の条件を具体的に示す。
   - 「正しい式を立てた: +○点」「正しい数値を代入: +○点」「最終答えが正しい: +○点」のように段階的に配分
   - 部分点がある場合はその条件も明記（例: 式は正しいが計算ミス → −2点）
   - 合計が %%% POINTS (N) %%% と一致すること
8. 数式以外の装飾コマンド（\\textbf, \\textit, \\noindent, \\begin{{itemize}} 等）は使わず、プレーンテキスト＋数式（$...$, \\[...\\]）のみで書いてください。

【出力形式（各問題を下記のマーカー形式で出力）】

%%% PROBLEM 1 %%%
%%% TOPIC: 力学・運動方程式 %%%
%%% DIFFICULTY: {difficulty} %%%
%%% STEM %%%
質量 $m$ の物体が、ばね定数 $k$ のばねの一端に取り付けられ、なめらかな水平面上に置かれている。ばねの自然長からの伸びを $x$ とする。時刻 $t = 0$ で物体を自然長の位置から距離 $A$ だけ引いて静かに放した。ただし、重力加速度を $g$ とする。
%%% FIGURE %%%
（TikZコードをここに直書き。不要なら省略）
%%% SUBPROBLEM (1) %%%
物体の運動方程式を $m$, $k$, $x$ を用いて表せ。
%%% POINTS (1) %%%
8
%%% ANSWER (1) %%%
$m\\ddot{{x}} = -kx$（または $m\\frac{{d^2 x}}{{dt^2}} = -kx$）
%%% EXPLANATION (1) %%%
ばねの復元力は $F=-kx$ であり、ニュートンの第二法則 $F=ma$ より $m\\ddot{{x}} = -kx$ が得られる。
%%% SCORING (1) %%%
復元力 $F=-kx$ を正しく書いた: +4点
運動方程式 $m\\ddot{{x}}=-kx$ を正しく導いた: +4点
%%% SUBPROBLEM (2) %%%
この運動の周期 $T$ を $m$, $k$ を用いて表せ。
%%% POINTS (2) %%%
8
%%% ANSWER (2) %%%
$T = 2\\pi\\sqrt{{\\frac{{m}}{{k}}}}$
%%% EXPLANATION (2) %%%
(1)の運動方程式は角振動数 $\\omega = \\sqrt{{\\frac{{k}}{{m}}}}$ の単振動を表す。周期は $T = \\frac{{2\\pi}}{{\\omega}} = 2\\pi\\sqrt{{\\frac{{m}}{{k}}}}$ となる。
%%% SCORING (2) %%%
角振動数 $\\omega=\\sqrt{{k/m}}$ を求めた: +4点
周期 $T=2\\pi/\\omega$ から正しい式を導いた: +4点
%%% SUBPROBLEM (3) %%%
物体が自然長の位置を通過する瞬間の速さ $v$ を $A$, $k$, $m$ を用いて表せ。
%%% POINTS (3) %%%
9
%%% ANSWER (3) %%%
$v = A\\sqrt{{\\frac{{k}}{{m}}}}$
%%% EXPLANATION (3) %%%
力学的エネルギー保存則より $\\frac{{1}}{{2}}kA^2 = \\frac{{1}}{{2}}mv^2$ が成り立つ。これを $v$ について解くと $v = A\\sqrt{{\\frac{{k}}{{m}}}}$ が得られる。
%%% SCORING (3) %%%
エネルギー保存則の式を正しく立てた: +4点
$v$ について正しく整理した: +5点（式変形の途中まで正しい: +2点）
%%% END PROBLEM 1 %%%

%%% PROBLEM 2 %%%
（以降同じ形式）
%%% END PROBLEM 2 %%%

★★★ 重要: 解答は文字式で表す問題を中心に出題してください。
物理量の関係式や導出過程を問う問題を優先し、数値を代入して計算するだけの問題は避けてください。
「〜を $m$, $g$, $\\theta$ を用いて表せ」「〜の式を導け」のような出題を心がけてください。

【品質基準】
- 設定に矛盾なく解答が一意に定まること
- 計算結果が整数または簡単な分数になる数値を選ぶ
- (1)→(2)→(3) の誘導形式、前問の結果を次問で使う
- TikZ: 全文は ; で終わる、\\usepackage/\\usetikzlibrary は書かない

【★★★ LaTeX コンパイルを確実にするための絶対ルール ★★★】
1. \\documentclass, \\usepackage, \\begin{{document}}, \\end{{document}} は絶対に書かない（preambleは自動付加される）
2. \\newcommand, \\renewcommand, \\def は絶対に使わない
3. \\textbf, \\textit, \\textcolor, \\colorbox, \\fbox 等の書式コマンドは使わない（プレーンテキスト＋数式のみ）
4. \\begin{{itemize}}, \\begin{{enumerate}}, \\begin{{description}} は使わない（問題文はプレーンテキストで書く）
5. \\noindent, \\vspace, \\hspace, \\medskip, \\bigskip 等のレイアウトコマンドは使わない
6. 数式モード内で \\text{{}} の代わりに \\mathrm{{}} を使う
7. \\left と \\right は必ずペアで使う。\\left{{ は \\left\\{{ と書く
8. 分数 \\frac{{}}{{}} の中身は空にしない。\\frac{{x}} のように分母だけ欠落するのも禁止
9. tikzpicture は %%% FIGURE %%% 内のみ。本文中に tikzpicture を書かない
10. 解説・解答のテキストは自然な日本語の文章として書く（LaTeXコマンドで装飾しない）
11. $$ は使わない。ディスプレイ数式は必ず \\[...\\] を使う
12. align* や cases の行末改行は \\\\ のみ。\\\\[2mm] 等の寸法付き改行は禁止
13. \\begin{{X}} と \\end{{X}} の環境名は必ず一致させる。\\begin{{scope}} には \\end{{scope}}
14. 中括弧 {{ と }} の数が必ず一致すること。出力完了前にカウントして検算
15. 添字2文字以上は {{}} で囲む: $x_1$ は OK、$x_{{10}}$, $a_{{ij}}$ のように
16. stem・小問・answer・explanation に使える数式環境は $...$ と \\[...\\] のみ。
    \\begin{{align*}}, \\begin{{cases}}, \\begin{{gather*}}, \\begin{{equation}} 等の環境は一切書かない。
    複数行の式を縦に並べたい場合は \\[ x=1 \\\\ y=2 \\] のように \\[...\\] 内で \\\\ を使う。
17. tikzpicture 内の scope ネストは最大1段（scope 内に scope を書かない）。
    複雑な配置が必要な場合は座標計算で対応し、scope のネストを避けること。

【出力前の最終チェック】
☐ \\begin と \\end の数・環境名が全て一致しているか
☐ {{ と }} の数が一致しているか
☐ \\frac{{}}{{}} に空の引数がないか
☐ \\left と \\right がペアになっているか
☐ $$ を使っていないか（\\[...\\] を使う）
☐ 関数名に \\ がついているか（\\sin, \\cos, \\log 等）
☐ 単位に \\mathrm{{}} を使っているか
☐ tikzpicture が %%% FIGURE %%% 内のみにあるか
☐ stem・小問・answer・explanation 内に align*, cases, gather*, equation 環境がないか
☐ tikzpicture 内の \\begin{{scope}} と \\end{{scope}} の数が一致しているか
☐ scope のネストが1段以内か（scope 内に scope を書いていないか）
☐ 物理の図: 全ての \\draw/\\fill/\\node 文が ; で終わっているか

【禁止】JSON出力禁止 / コードフェンス禁止 / 余分なテキスト禁止 / %%% を本文中に使用禁止 / tcolorbox禁止 / mdframed禁止
絶対に \\documentclass, \\begin{{document}}, \\end{{document}}, \\usepackage を出力に含めないこと。"""


def _parse_latex_problems(raw_text: str) -> list:
    """構造化マーカー付き LaTeX テキストを問題配列にパースする。

    %%% PROBLEM N %%% 〜 %%% END PROBLEM N %%% の各ブロックを解析し、
    フロントエンドで使える problems 配列（stem, figure_tikz, subproblems, topic, difficulty）を返す。
    JSON を使わないため、LaTeX のバックスラッシュ問題が原理的に発生しない。

    堅牢化: END PROBLEM マーカーが欠落していても次の PROBLEM マーカーまたは末尾をブロック終端として処理。
    """
    problems = []

    # ──────────────────────────────────────────────
    # Phase 1: 厳密な END PROBLEM マーカーでブロック抽出
    # ──────────────────────────────────────────────
    problem_pattern = re.compile(
        r'%%%\s*PROBLEM\s+(\d+)\s*%%%\s*\n([\s\S]*?)%%%\s*END\s+PROBLEM\s+\1\s*%%%',
        re.IGNORECASE,
    )
    for m in problem_pattern.finditer(raw_text):
        block = m.group(2)
        parsed = _parse_problem_block(block)
        if parsed:
            problems.append(parsed)

    if problems:
        return problems

    # ──────────────────────────────────────────────
    # Phase 2: END PROBLEM が欠落 → 次の PROBLEM 開始 or 末尾で区切る（緩いパース）
    # ──────────────────────────────────────────────
    starts = list(re.finditer(r'%%%\s*PROBLEM\s+(\d+)\s*%%%', raw_text, re.IGNORECASE))
    if starts:
        for idx_s, sm in enumerate(starts):
            block_start = sm.end()
            # 対応する END PROBLEM があれば使う
            end_pat = re.compile(r'%%%\s*END\s+PROBLEM\s+' + re.escape(sm.group(1)) + r'\s*%%%', re.IGNORECASE)
            end_m = end_pat.search(raw_text, block_start)
            if end_m:
                block_end = end_m.start()
            elif idx_s + 1 < len(starts):
                block_end = starts[idx_s + 1].start()
            else:
                block_end = len(raw_text)
            block = raw_text[block_start:block_end]
            parsed = _parse_problem_block(block)
            if parsed:
                problems.append(parsed)

    return problems


def _parse_problem_block(block: str) -> dict | None:
    """1つの PROBLEM ブロック内テキストをパースして問題 dict を返す。"""

    # TOPIC
    topic_m = re.search(r'%%%\s*TOPIC:\s*(.*?)\s*%%%', block)
    topic = topic_m.group(1).strip() if topic_m else ''

    # DIFFICULTY
    diff_m = re.search(r'%%%\s*DIFFICULTY:\s*(.*?)\s*%%%', block)
    difficulty = diff_m.group(1).strip() if diff_m else ''

    # Recognized section keywords — used to build lookaheads so stray %%% in content don't break parsing
    _known_kw = r'(?:TOPIC|DIFFICULTY|STEM|FIGURE|SUBPROBLEM|POINTS|ANSWER|EXPLANATION|SCORING|END\s+PROBLEM)'
    _next_marker = r'(?=%%%\s*' + _known_kw + r')'          # lookahead
    _next_or_end = r'(?:%%%\s*' + _known_kw + r'|$)'        # non-lookahead version for ANSWER/EXPLANATION

    # STEM: between %%% STEM %%% and the next recognized marker
    stem_m = re.search(r'%%%\s*STEM\s*%%%([\s\S]*?)' + _next_marker, block)
    if not stem_m:
        # 緩いパース: 次のマーカーまで取る (lookahead なし)
        stem_m = re.search(r'%%%\s*STEM\s*%%%([\s\S]*?)(?:%%%|$)', block)
    stem = stem_m.group(1).strip() if stem_m else ''

    # FIGURE: between %%% FIGURE %%% and the next recognized marker
    figure_m = re.search(r'%%%\s*FIGURE\s*%%%([\s\S]*?)' + _next_marker, block)
    if not figure_m:
        figure_m = re.search(r'%%%\s*FIGURE\s*%%%([\s\S]*?)(?:%%%|$)', block)
    figure_tikz = figure_m.group(1).strip() if figure_m else None
    if figure_tikz and figure_tikz.lower() in ('', 'null', 'none', 'なし'):
        figure_tikz = None

    # SUBPROBLEMS: extract each (N) trio of SUBPROBLEM/ANSWER/EXPLANATION
    subproblems = []
    sub_pattern = re.compile(
        r'%%%\s*SUBPROBLEM\s*\((\d+)\)\s*%%%([\s\S]*?)' + _next_marker,
        re.IGNORECASE,
    )
    sub_matches = list(sub_pattern.finditer(block))
    if not sub_matches:
        # 緩いパース: lookahead なしで再試行
        sub_pattern_loose = re.compile(
            r'%%%\s*SUBPROBLEM\s*\((\d+)\)\s*%%%([\s\S]*?)(?=%%%\s*(?:SUBPROBLEM|POINTS|ANSWER|EXPLANATION|SCORING|END|PROBLEM)|$)',
            re.IGNORECASE,
        )
        sub_matches = list(sub_pattern_loose.finditer(block))

    for sm in sub_matches:
        label = f'({sm.group(1)})'
        question = sm.group(2).strip()

        # Find matching ANSWER (N) and EXPLANATION (N)
        ans_pattern = re.compile(
            r'%%%\s*ANSWER\s*\(' + re.escape(sm.group(1)) + r'\)\s*%%%([\s\S]*?)' + _next_or_end,
            re.IGNORECASE,
        )
        ans_m = ans_pattern.search(block)
        answer = ans_m.group(1).strip() if ans_m else ''

        expl_pattern = re.compile(
            r'%%%\s*EXPLANATION\s*\(' + re.escape(sm.group(1)) + r'\)\s*%%%([\s\S]*?)' + _next_or_end,
            re.IGNORECASE,
        )
        expl_m = expl_pattern.search(block)
        explanation = expl_m.group(1).strip() if expl_m else ''

        # POINTS (N)
        pts_pattern = re.compile(
            r'%%%\s*POINTS\s*\(' + re.escape(sm.group(1)) + r'\)\s*%%%(\s*\d+)',
            re.IGNORECASE,
        )
        pts_m = pts_pattern.search(block)
        points = int(pts_m.group(1).strip()) if pts_m else 0

        # SCORING (N) — 配点基準・部分点
        scoring_pattern = re.compile(
            r'%%%\s*SCORING\s*\(' + re.escape(sm.group(1)) + r'\)\s*%%%([\s\S]*?)' + _next_or_end,
            re.IGNORECASE,
        )
        scoring_m = scoring_pattern.search(block)
        scoring_criteria = scoring_m.group(1).strip() if scoring_m else ''

        subproblems.append({
            'label': label,
            'question': question,
            'answer': answer,
            'explanation': explanation,
            'points': points,
            'scoring_criteria': scoring_criteria,
        })

    # stem も subproblems も取れなかった場合は無効なブロック
    if not stem and not subproblems:
        return None

    return {
        'stem': stem,
        'figure_tikz': figure_tikz,
        'subproblems': subproblems,
        'topic': topic,
        'difficulty': difficulty,
    }


def _sanitize_practice_text(text: str) -> str:
    """LLM出力のテキスト（stem/answer/explanation）からコンパイル破壊要素を除去する。"""
    if not text:
        return text
    # \documentclass, \usepackage, \begin{document}, \end{document} を除去
    text = re.sub(r'\\documentclass\b[^\n]*\n?', '', text)
    text = re.sub(r'\\usepackage\b[^\n]*\n?', '', text)
    text = re.sub(r'\\begin\{document\}', '', text)
    text = re.sub(r'\\end\{document\}', '', text)
    text = re.sub(r'\\usetikzlibrary\b[^\n]*\n?', '', text)
    # \newcommand, \renewcommand, \def を除去（定義行全体）
    text = re.sub(r'\\(?:re)?newcommand\b[^\n]*\n?', '', text)
    text = re.sub(r'\\def\\[a-zA-Z]+[^\n]*\n?', '', text)
    # 空の \frac{}{} を除去
    text = re.sub(r'\\frac\s*\{\s*\}\s*\{\s*\}', '', text)
    # \left{ → \left\{  /  \right} → \right\}
    text = re.sub(r'\\left\{', r'\\left\\{', text)
    text = re.sub(r'\\right\}', r'\\right\\}', text)
    # 二重エスケープ防止
    text = re.sub(r'\\left\\\\\{', r'\\left\\{', text)
    text = re.sub(r'\\right\\\\\}', r'\\right\\}', text)
    # $$...$$ → \[...\]
    text = re.sub(r'\$\$([\s\S]*?)\$\$', r'\\[\1\\]', text)
    # \textbf{}, \textit{}, \textcolor{}{} 等の装飾コマンドをテキストのみに変換
    text = re.sub(r'\\textbf\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\textit\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\noindent\s*', '', text)
    # \begin{itemize/enumerate} → プレーンテキスト化
    text = re.sub(r'\\begin\{(?:itemize|enumerate)\}(?:\[[^\]]*\])?\s*', '', text)
    text = re.sub(r'\\end\{(?:itemize|enumerate)\}\s*', '', text)
    text = re.sub(r'\\item\s*', '・', text)
    # \vspace, \hspace, \medskip, \bigskip 等のレイアウトコマンドを除去
    text = re.sub(r'\\(?:vspace|hspace)\*?\{[^}]*\}\s*', '', text)
    text = re.sub(r'\\(?:medskip|bigskip|smallskip)\s*', '', text)
    # 未対応のフォント系コマンドを除去
    text = re.sub(r'\\(?:textcolor|colorbox)\{[^}]*\}\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\(?:fbox|mbox)\{([^}]*)\}', r'\1', text)
    # align*/gather*/equation 環境 → \[...\] に変換（tcolorbox内でのネスト崩れを防止）
    text = re.sub(
        r'\\begin\{(?:align\*?|gather\*?|equation\*?)\}([\s\S]*?)\\end\{(?:align\*?|gather\*?|equation\*?)\}',
        lambda m: r'\[' + m.group(1).strip() + r'\]',
        text,
    )
    # cases 環境はそのまま \[...\] の中に残す（\[ \begin{cases}...\end{cases} \]）
    # → cases が \[...\] の外に孤立している場合だけ変換
    # 注意: Python の re は可変長 lookbehind を非サポートのため lookahead のみで判定
    text = re.sub(
        r'\\begin\{cases\}([\s\S]*?)\\end\{cases\}(?!\s*\\\])',
        lambda m: r'\[\begin{cases}' + m.group(1) + r'\end{cases}\]',
        text,
    )

    # ── 裸ブラケット display math 変換 ──
    # LLM が \[...\] ではなく [...] で display math を出力するケースに対応
    # 行単位で処理: 行頭の [ → \[、行末の ] → \]
    _math_indicators = re.compile(r'[=^_&]|\\(?:frac|sqrt|sum|int|lim|sin|cos|tan|log|ln|exp|mathrm|text|left|right|begin|end|cdot|times|div|pm|mp|approx|neq|leq|geq)')
    lines = text.split('\n')
    out_lines = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        # パターン1: 行が "[" のみ → 複数行 display math 開始
        if stripped == '[':
            # 対応する "]" のみの行を探す
            j = i + 1
            while j < len(lines) and lines[j].strip() != ']':
                j += 1
            if j < len(lines) and lines[j].strip() == ']':
                inner = '\n'.join(lines[i + 1:j])
                if _math_indicators.search(inner):
                    out_lines.append('\\[')
                    out_lines.extend(lines[i + 1:j])
                    out_lines.append('\\]')
                    i = j + 1
                    continue
        # パターン2: 単一行 [ math_content ]
        m = re.match(r'^(\s*)\[(.+)\]\s*$', lines[i])
        if m:
            indent, content = m.group(1), m.group(2)
            # LaTeX コマンドのオプション引数ではないことを確認
            if _math_indicators.search(content) and not re.match(r'^\\[a-zA-Z]+\[', lines[i].strip()):
                out_lines.append(f'{indent}\\[{content}\\]')
                i += 1
                continue
        out_lines.append(lines[i])
        i += 1
    text = '\n'.join(out_lines)

    return text


def _sanitize_figure_tikz(code: str) -> str:
    """TikZ/circuitikz 図コードの典型的なコンパイルエラーを自動修復する。"""
    if not code:
        return code

    # 危険なコマンドを除去
    code = re.sub(r'\\usepackage\b[^\n]*\n?', '', code)
    code = re.sub(r'\\usetikzlibrary\b[^\n]*\n?', '', code)
    code = re.sub(r'\\documentclass\b[^\n]*\n?', '', code)
    code = re.sub(r'\\begin\{document\}', '', code)
    code = re.sub(r'\\end\{document\}', '', code)

    # バネ描画の自動修正: zigzag/snake → coil（螺旋）に置換
    code = re.sub(
        r'decoration\s*=\s*\{?\s*zigzag\b',
        r'decoration={coil, aspect=0.35, segment length=5pt, amplitude=8pt',
        code
    )
    code = re.sub(
        r'decoration\s*=\s*\{?\s*snake\b',
        r'decoration={coil, aspect=0.35, segment length=5pt, amplitude=8pt',
        code
    )

    # \draw / \fill / \node / \path / \coordinate で始まる行に
    # セミコロンが欠けている場合は自動補完する
    lines = code.split('\n')
    fixed = []
    for line in lines:
        s = line.rstrip()
        if s.lstrip().startswith('%'):
            fixed.append(s)
            continue
        if re.match(r'\s*\\(draw|fill|node|path|coordinate|clip)\b', s):
            # 行末が ; / { / } / , / % / \\ / ] でなければ ; を追加
            # ] は多行の \draw[...オプション...]\n (座標...) パターンで行末に来る
            if s and s[-1] not in (';', '{', '}', ',', '%', ']') and not s.endswith('\\\\'):
                s += ';'
        fixed.append(s)
    code = '\n'.join(fixed)

    # \begin{scope} ↔ \end{scope} のバランス修正
    nb_s = len(re.findall(r'\\begin\{scope\}', code))
    ne_s = len(re.findall(r'\\end\{scope\}', code))
    if nb_s > ne_s:
        code += '\n' + '\\end{scope}\n' * (nb_s - ne_s)
    elif ne_s > nb_s:
        excess = ne_s - nb_s
        for _ in range(excess):
            idx = code.rfind('\\end{scope}')
            if idx >= 0:
                code = code[:idx] + code[idx + len('\\end{scope}'):]

    # \begin{tikzpicture} ↔ \end{tikzpicture} のバランス修正
    nb_t = len(re.findall(r'\\begin\{tikzpicture\}', code))
    ne_t = len(re.findall(r'\\end\{tikzpicture\}', code))
    if nb_t > ne_t:
        code += '\n' + '\\end{tikzpicture}\n' * (nb_t - ne_t)

    # \begin{circuitikz} ↔ \end{circuitikz} のバランス修正
    nb_c = len(re.findall(r'\\begin\{circuitikz\}', code))
    ne_c = len(re.findall(r'\\end\{circuitikz\}', code))
    if nb_c > ne_c:
        code += '\n' + '\\end{circuitikz}\n' * (nb_c - ne_c)

    # 中括弧 { / } の数チェック: 不均衡の場合は図を空にして安全に失敗させない
    open_b = code.count('{') - code.count('\\{')
    close_b = code.count('}') - code.count('\\}')
    # コメント行を除いたカウントで極端に不均衡な場合はスキップ
    non_comment = '\n'.join(l for l in code.split('\n') if not l.lstrip().startswith('%'))
    nb_open = non_comment.count('{')
    nb_close = non_comment.count('}')
    if abs(nb_open - nb_close) > 10:
        # 中括弧が著しく不均衡 → 図ブロックごと除去してコンパイルを守る
        return ''

    return code.strip()


def _build_practice_latex(problems: list, subject: str, difficulty: str, mode: str = 'full') -> str:
    """構造化された問題データから、入試問題品質のPDF用LaTeXドキュメントを構築する。
    subproblems 配列・figure_tikz フィールドに対応。旧形式（answer/explanation トップレベル）とも互換。
    mode: 'full'=問題+解答, 'problems'=問題のみ, 'answers'=解答のみ
    """

    # ─── 科目別アクセントカラー ───
    color_map = {
        '物理': ('4C1D95', '7C3AED'),   # deep violet
        '数学': ('1E3A8A', '2563EB'),   # deep blue
        '化学': ('065F46', '059669'),   # deep emerald
    }
    main_hex, accent_hex = color_map.get(subject, ('1A5276', '2563EB'))

    # TikZ/circuitikz が必要かどうか判定
    has_tikz = any(
        p.get('figure_tikz') and str(p.get('figure_tikz', '')).strip() not in ('', 'null', 'None')
        for p in problems
    )
    has_circuit = any(
        'circuitikz' in str(p.get('figure_tikz', ''))
        for p in problems
    )

    lines = [
        # モバイル最適化: 98mm×172mm (スマホ画面幅に最適、FitHで大きく表示される)
        r'\documentclass[10pt]{ltjsarticle}',
        r'\usepackage{amsmath,amssymb,mathtools}',
        # physics パッケージは siunitx v3 と \qty が競合するため使わない。
        # よく使うコマンドを個別定義する。
        r'\usepackage{siunitx}',          # \SI{9.8}{m/s^2} 等の単位表記
        r'\sisetup{per-mode=symbol,detect-all}',
        # physics 代替マクロ（siunitx と非競合）
        r'\newcommand{\dv}[2]{\dfrac{d#1}{d#2}}',
        r'\newcommand{\pdv}[2]{\dfrac{\partial #1}{\partial #2}}',
        r'\newcommand{\abs}[1]{\left|#1\right|}',
        r'\newcommand{\norm}[1]{\left\|#1\right\|}',
        r'\newcommand{\vb}[1]{\boldsymbol{#1}}',
        r'\usepackage{geometry}',
        # スマホ画面幅(約95-100mm)に合わせたページサイズ
        # iframeのFitH表示で文字が大きく見える
        r'\geometry{paperwidth=98mm,paperheight=172mm,top=5mm,bottom=7mm,left=4mm,right=4mm}',
        r'\usepackage{adjustbox}',         # \adjustbox{max width=\linewidth} で図を自動縮小
        r'\usepackage{parskip}',
        r'\setlength{\parskip}{0.25em}',
        r'\setlength{\parindent}{0pt}',
        r'\usepackage{fancyhdr}',
        r'\usepackage{titlesec}',
        r'\usepackage{xcolor}',
        r'\usepackage{enumitem}',
        r'\usepackage{tcolorbox}',
        r'\tcbuselibrary{skins,breakable}',
        r'\usepackage{array,booktabs}',   # 美しい表
        r'\usepackage{colortbl}',          # \rowcolor
    ]

    if has_tikz or True:   # 常に TikZ を読み込む（問題文内でも使われる可能性）
        lines += [
            r'\usepackage{tikz}',
            r'\usetikzlibrary{arrows.meta,patterns,decorations.pathmorphing,decorations.markings,'
            r'calc,angles,quotes,shapes.geometric,positioning,3d}',
            r'\usepackage{pgfplots}',
            r'\pgfplotsset{compat=1.18}',
            # TikZのデフォルト設定
            r'\tikzset{',
            r'  every picture/.style={line width=0.7pt},',
            r'  every node/.style={font=\small},',
            r'}',
        ]
    if has_circuit or True:   # circuitikz も常に読み込む
        lines += [
            r'\usepackage{circuitikz}',
            r'\ctikzset{resistors/scale=0.8,capacitors/scale=0.8,sources/scale=0.9}',
        ]

    lines += [
        rf'\definecolor{{maincolor}}{{HTML}}{{{main_hex}}}',
        rf'\definecolor{{accentcolor}}{{HTML}}{{{accent_hex}}}',
        r'\definecolor{answerbox}{HTML}{F0F4FF}',
        r'\definecolor{explanbox}{HTML}{FAFFF4}',
        r'\definecolor{rulegray}{HTML}{475569}',
        '',
        r'\pagestyle{fancy}\fancyhf{}',
        r'\renewcommand{\headrulewidth}{1.2pt}',
        r'\renewcommand{\headrule}{\hbox to\headwidth{\color{maincolor}\leaders\hrule height\headrulewidth\hfill}}',
        rf'\fancyhead[L]{{\small\color{{maincolor}}\textsf{{\textbf{{{subject} {"解答・解説" if mode == "answers" else "練習問題"} \textbar\ {difficulty}}}}}}}',
        r'\fancyhead[R]{\small\color{maincolor}\textsf{\thepage}}',
        r'\fancyfoot[C]{\small\color{rulegray}\textsf{AI 生成練習問題 — 自己採点用}}',
        r'\setlength{\headheight}{12pt}',
        '',
        r'% ── セクション書式 ──',
        r'\titleformat{\section}{\Large\bfseries\color{maincolor}}{}{0em}{}[{\color{maincolor}\rule{\linewidth}{0.6pt}}]',
        r'\titleformat{\subsection}{\large\bfseries\color{accentcolor}}{}{0em}{}',
        '',
        r'% ── カスタム環境 ──',
        # 問題番号ボックス（newtcolorbox で定義 → \begin{problembox}/\end{problembox} で使用）
        r'\newtcolorbox{problembox}[2]{enhanced,colback=maincolor!6,colframe=maincolor,',
        r'  arc=3pt,left=4pt,right=4pt,top=4pt,bottom=4pt,breakable,',
        r'  before=\noindent,',
        r'  title={\bfseries\color{white} 問題\ #1\quad\normalfont\small\color{white!85!maincolor}【#2】},',
        r'  coltitle=white,attach boxed title to top left={yshift=-2pt,xshift=4pt},',
        r'  boxed title style={colback=maincolor,arc=2pt}}',
        # 解答・解説ボックス
        r'\newtcolorbox{solutionbox}[2]{enhanced,colback=answerbox,colframe=accentcolor!60,',
        r'  arc=3pt,left=4pt,right=4pt,top=4pt,bottom=4pt,breakable,',
        r'  before=\noindent,',
        r'  title={\bfseries\color{accentcolor} 解答\ #1\quad\normalfont\small\color{accentcolor!70}【#2】},',
        r'  coltitle=accentcolor,attach boxed title to top left={yshift=-2pt,xshift=4pt},',
        r'  boxed title style={colback=answerbox,colframe=accentcolor!60,arc=2pt}}',
        # 小問ラベル — \par で前のパラグラフを確実に終了
        r'\newcommand{\subq}[1]{\par\medskip\noindent\textcolor{accentcolor}{\textbf{#1}}\ }',
        r'\newcommand{\suba}[1]{\par\smallskip\noindent\textcolor{accentcolor!80!black}{\textbf{#1}}\ }',
        # 答えの枠線 — \par で確実に段落を閉じてから罫線
        r'\newcommand{\ansline}{\par\vspace{0.3em}\noindent\textcolor{accentcolor!40}{\rule{\linewidth}{0.4pt}}\vspace{0.2em}}',
        # 解答セクション用の色付きボックス
        r'\newtcolorbox{ansblock}{enhanced,colback=accentcolor!4,colframe=accentcolor!35,',
        r'  arc=2pt,left=5pt,right=5pt,top=3pt,bottom=3pt,breakable,',
        r'  leftrule=2.5pt,rightrule=0.4pt,toprule=0.4pt,bottomrule=0.4pt}',
        r'\newtcolorbox{expblock}{enhanced,colback=green!3!white,colframe=green!30!black!20,',
        r'  arc=2pt,left=5pt,right=5pt,top=3pt,bottom=3pt,breakable,',
        r'  leftrule=2.5pt,rightrule=0.4pt,toprule=0.4pt,bottomrule=0.4pt}',
        r'\newtcolorbox{scrblock}{enhanced,colback=maincolor!4,colframe=maincolor!30,',
        r'  arc=2pt,left=5pt,right=5pt,top=3pt,bottom=3pt,breakable,',
        r'  leftrule=2.5pt,rightrule=0.4pt,toprule=0.4pt,bottomrule=0.4pt}',
        '',
        r'\begin{document}',
        # LuaTeX-Ja: 本文内で和欧文間スペースを設定（プリアンブルより安全）
        r'\ltjsetparameter{xkanjiskip=0pt plus 0.12em minus 0.06em}',
        '',
    ]

    # ─── タイトルブロック ───
    if mode == 'answers':
        title_text = f'{subject} 解答・解説'
    else:
        title_text = f'{subject} 練習問題'
    lines += [
        rf'\begin{{center}}',
        rf'  {{\Large\bfseries\color{{maincolor}} {title_text}}} \\[4pt]',
        rf'  {{\normalsize\color{{rulegray}} 難易度: {difficulty}\quad|\quad AI 生成}}',
        rf'\end{{center}}',
        r'\medskip',
        r'\noindent{\color{maincolor}\rule{\linewidth}{1.2pt}}',
        r'\bigskip',
        '',
    ]

    def _normalize_subproblems(p):
        subs = p.get('subproblems') or []
        if not subs:
            old_answer = p.get('answer') or ''
            old_explanation = p.get('explanation') or ''
            if old_answer or old_explanation:
                subs = [{'label': '(1)', 'question': '', 'answer': old_answer, 'explanation': old_explanation}]
        return subs

    # ─── 問題セクション ───
    if mode in ('full', 'problems'):
        lines.append(r'\section*{\textcolor{maincolor}{問題}}')
        lines.append('')

        for i, p in enumerate(problems, 1):
            stem = _sanitize_practice_text(p.get('stem') or '')
            topic = p.get('topic') or ''
            figure_tikz = p.get('figure_tikz') or ''
            subproblems = _normalize_subproblems(p)

            # 問題ボックス開始（\begin{problembox} 環境）
            lines.append(rf'\begin{{problembox}}{{{i}}}{{{topic}}}')
            lines.append('')

            # 状況説明文
            if stem:
                lines.append(stem)
                lines.append('')

            # 図（figure_tikz）— TikZ コードをサニタイズして安全にラップ
            if figure_tikz and str(figure_tikz).strip() not in ('', 'null', 'None'):
                fig_code = _sanitize_figure_tikz(str(figure_tikz).strip())
                if fig_code:
                    # tikzpicture/circuitikz/axis 環境が含まれているか確認
                    has_env = re.search(r'\\begin\{(tikzpicture|circuitikz|axis)\}', fig_code)
                    if has_env:
                        # adjustbox でモバイル最適化: 幅が \linewidth を超えたとき自動縮小
                        lines.append(r'\begin{center}')
                        lines.append(r'\adjustbox{max width=\linewidth}{%')
                        lines.append(fig_code)
                        lines.append(r'}%')
                        lines.append(r'\end{center}')
                        lines.append('')
                    # 環境がない場合は tikzpicture で囲む
                    elif not fig_code.startswith('%'):
                        lines.append(r'\begin{center}')
                        lines.append(r'\adjustbox{max width=\linewidth}{%')
                        lines.append(r'\begin{tikzpicture}[>=stealth]')
                        lines.append(fig_code)
                        lines.append(r'\end{tikzpicture}')
                        lines.append(r'}%')
                        lines.append(r'\end{center}')
                        lines.append('')

            # 小問 — 各小問を \subq ラベル + 問題文 で1行出力
            for sp in subproblems:
                label = sp.get('label', '')
                question = _sanitize_practice_text(sp.get('question', ''))
                points = sp.get('points', 0)
                pts_str = f' \\hfill {{\\small\\color{{rulegray}}[{points}点]}}' if points else ''
                lines.append(rf'\subq{{{label}}} {question}{pts_str}')
                lines.append('')
                # 解答欄の罫線
                lines.append(r'\ansline')
                lines.append('')

            # 問題ボックス終了
            lines.append(r'\end{problembox}')
            lines.append(r'\medskip')
            lines.append('')

    # ─── 解答・解説セクション ───
    if mode in ('full', 'answers'):
        if mode == 'full':
            lines.append(r'\newpage')
            lines.append('')
        lines.append(r'\section*{\textcolor{maincolor}{解答・解説}}')
        lines.append('')

        for i, p in enumerate(problems, 1):
            stem = _sanitize_practice_text(p.get('stem') or '')
            topic = p.get('topic') or ''
            subproblems = _normalize_subproblems(p)

            lines.append(rf'\begin{{solutionbox}}{{{i}}}{{{topic}}}')
            lines.append('')

            # 問題の要約（最初の80文字）
            if stem:
                stem_snip = stem[:80] + ('…' if len(stem) > 80 else '')
                lines.append(rf'{{\small\color{{rulegray}}\textit{{設定: {stem_snip}}}}}')
                lines.append('')

            for sp in subproblems:
                label = sp.get('label', '')
                answer = _sanitize_practice_text(sp.get('answer', ''))
                explanation = _sanitize_practice_text(sp.get('explanation', ''))
                scoring_criteria = _sanitize_practice_text(sp.get('scoring_criteria', ''))
                points = sp.get('points', 0)
                pts_str = f' \\hfill {{\\small\\color{{rulegray}}[{points}点]}}' if points else ''

                if answer:
                    lines.append(rf'\par\medskip\noindent\colorbox{{accentcolor!10}}{{\textbf{{\textcolor{{accentcolor}}{{{label} 解答:}}}}}}{pts_str}')
                    lines.append(r'\begin{ansblock}')
                    lines.append(rf'{answer}')
                    lines.append(r'\end{ansblock}')
                if explanation:
                    lines.append(rf'\par\smallskip\noindent\textbf{{\textcolor{{accentcolor!70!black}}{{\small 解説}}}}')
                    lines.append(r'\begin{expblock}')
                    lines.append(rf'{{\small {explanation}}}')
                    lines.append(r'\end{expblock}')
                if scoring_criteria:
                    lines.append(rf'\par\smallskip\noindent\colorbox{{maincolor!8}}{{\textbf{{\textcolor{{maincolor}}{{\small 配点基準}}}}}}')
                    lines.append(r'\begin{scrblock}')
                    # 各行を箇条書き風に整形
                    for sc_line in scoring_criteria.split('\n'):
                        sc_line = sc_line.strip()
                        if sc_line:
                            lines.append(rf'{{\small\color{{maincolor!80!black}} {sc_line}}}')
                    lines.append(r'\end{scrblock}')
                lines.append('')

            lines.append(r'\end{solutionbox}')
            lines.append(r'\medskip')
            lines.append('')

    # ─── 自己採点表（解答解説の後に配置） ───
    if mode in ('full', 'answers'):
        lines.append(r'\bigskip')
        lines.append(r'\noindent{\color{maincolor}\rule{\linewidth}{0.6pt}}')
        lines.append(r'\section*{\textcolor{maincolor}{自己採点表}}')
        lines.append('')
        lines.append(r'\begin{center}')
        lines.append(r'\renewcommand{\arraystretch}{1.6}')
        lines.append(r'\begin{tabular}{|c|c|c|c|c|}')
        lines.append(r'\hline')
        lines.append(r'\rowcolor{maincolor!10} \textbf{問題} & \textbf{小問} & \textbf{配点} & \textbf{○/×} & \textbf{得点} \\')
        lines.append(r'\hline')
        grand_total = 0
        for i, p in enumerate(problems, 1):
            subproblems_sc = _normalize_subproblems(p)
            for sp in subproblems_sc:
                label = sp.get('label', '')
                pts = sp.get('points', 0)
                grand_total += pts
                lines.append(f'{i} & {label} & {pts}点 & \\hspace{{1.5cm}} & \\hspace{{1.5cm}} \\\\')
                lines.append(r'\hline')
        lines.append(f'\\multicolumn{{2}}{{|c|}}{{\\textbf{{合計}}}} & \\textbf{{{grand_total}点}} & & \\\\')
        lines.append(r'\hline')
        lines.append(r'\end{tabular}')
        lines.append(r'\end{center}')
        lines.append('')

    lines.append(r'\end{document}')
    return '\n'.join(lines)


async def _run_practice_job(job_id: str, openai_key: str, openai_model: str,
                             resolved_tier: str, system_prompt: str,
                             user_prompt: str, num_questions: int,
                             user_id: str, subject: str, difficulty: str):
    """バックグラウンドで OpenAI API を呼び出し、JSON問題データを _PRACTICE_JOBS に格納する。"""
    openai_url = 'https://api.openai.com/v1/chat/completions'
    _is_reasoning = bool(re.match(r'^(o1|o3|o4)', openai_model))

    messages = []
    if _is_reasoning:
        messages.append({'role': 'developer', 'content': system_prompt})
    else:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': user_prompt})

    # 3問×約1500トークン出力 + バッファ = 6000 程度で十分。コスト最適化のため上限を絞る。
    _dynamic_max_tokens = max(4096, 1600 * num_questions)
    openai_payload = {
        'model': openai_model,
        'messages': messages,
        'max_completion_tokens': _dynamic_max_tokens,
    }
    if not _is_reasoning:
        openai_payload['temperature'] = 0.3  # 出力安定化のため低め

    logger.info('Practice job %s: model=%s, max_tokens=%d', job_id, openai_model, _dynamic_max_tokens)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=30.0)) as client:
            resp = await client.post(
                openai_url,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {openai_key}',
                },
                json=openai_payload,
            )

        if resp.status_code != 200:
            error_detail = f'HTTP {resp.status_code}'
            try:
                error_body = resp.json()
                error_detail = error_body.get('error', {}).get('message', error_detail)
            except Exception:
                pass
            logger.error('Practice job %s OpenAI error: %s', job_id, error_detail)
            _PRACTICE_JOBS[job_id]['status'] = 'error'
            _PRACTICE_JOBS[job_id]['error'] = f'OpenAI API エラー: {error_detail}'
            return

        body = resp.json()

        # テキスト抽出（_run_llm_job と同じロジック）
        raw_text = ''
        choices = body.get('choices', [])
        if choices:
            message = choices[0].get('message') or {}
            content = message.get('content')
            if isinstance(content, list):
                raw_text = '\n'.join(p.get('text', '') if isinstance(p, dict) else str(p) for p in content)
            elif isinstance(content, str):
                raw_text = content
            if not raw_text:
                reasoning = message.get('reasoning_content')
                if reasoning:
                    raw_text = reasoning

        if not raw_text and isinstance(body.get('output'), list):
            for out_item in body['output']:
                if isinstance(out_item, dict) and out_item.get('type') == 'message':
                    for c in (out_item.get('content') or []):
                        if isinstance(c, dict) and c.get('type') in ('output_text', 'text'):
                            raw_text += c.get('text', '')

        if not raw_text and isinstance(body.get('output_text'), str):
            raw_text = body['output_text']

        raw_text = raw_text.strip() if raw_text else ''

        if not raw_text:
            _PRACTICE_JOBS[job_id]['status'] = 'error'
            _PRACTICE_JOBS[job_id]['error'] = 'AI からの応答が空です'
            return

        # ── 構造化マーカー付き LaTeX をパース ──
        # code fence がある場合は除去（複数フェンス対応）
        clean_text = raw_text
        if '```' in clean_text:
            fenced = re.search(r'```(?:latex|tex|plain)?\s*\n?([\s\S]*?)```', clean_text)
            if fenced:
                clean_text = fenced.group(1).strip()

        # マーカー方式でパース（code fence 除去後 → 生テキストの順で試行）
        problems = _parse_latex_problems(clean_text)
        if not problems and clean_text != raw_text:
            problems = _parse_latex_problems(raw_text)

        # マーカーが見つからなかった場合、旧JSON方式にフォールバック
        if not problems:
            parsed = _try_parse_json_fallback(raw_text)
            if parsed and isinstance(parsed.get('problems'), list):
                problems = parsed['problems']

        if not problems:
            logger.warning('Practice job %s: all parse methods failed. raw_text[:300]=%s', job_id, raw_text[:300])
            _PRACTICE_JOBS[job_id]['status'] = 'error'
            _PRACTICE_JOBS[job_id]['error'] = 'AI応答の解析に失敗しました。再度お試しください。\n\nヒント: 「手動モード」でプロンプトを再生成して試すと、より安定して動作します。'
            return

        # LaTeX ドキュメント構築（PDF用）
        latex_doc = _build_practice_latex(problems, subject, difficulty, mode='full')
        latex_problems_doc = _build_practice_latex(problems, subject, difficulty, mode='problems')
        latex_answers_doc = _build_practice_latex(problems, subject, difficulty, mode='answers')

        # 使用回数インクリメント
        if user_id:
            _increment_usage(user_id)

        updated_usage = _get_usage(user_id) if user_id else None

        _PRACTICE_JOBS[job_id]['status'] = 'completed'
        _PRACTICE_JOBS[job_id]['result'] = {
            'problems': problems,
            'latex': latex_doc,
            'latex_problems': latex_problems_doc,
            'latex_answers': latex_answers_doc,
            'model': openai_model,
            'model_tier': resolved_tier,
            'usage': updated_usage,
        }
        logger.info('Practice job %s completed: %d problems (model=%s)', job_id, len(problems), openai_model)

    except httpx.TimeoutException:
        logger.error('Practice job %s timeout', job_id)
        _PRACTICE_JOBS[job_id]['status'] = 'error'
        _PRACTICE_JOBS[job_id]['error'] = 'OpenAI API がタイムアウトしました。再度お試しください。'
    except Exception as e:
        logger.exception('Practice job %s failed', job_id)
        _PRACTICE_JOBS[job_id]['status'] = 'error'
        _PRACTICE_JOBS[job_id]['error'] = f'生成中にエラーが発生しました: {str(e)}'


@app.post('/api/practice/prompt')
async def practice_render_prompt(req: PracticeGenerateRequest = Body(...)):
    """手動モード用: プロンプトのみを返す（LLM呼び出しなし）。ゲストでも利用可能。"""
    max_q = int(os.getenv('MAX_QUESTIONS_PER_GENERATION', '3'))
    if req.num_questions > max_q:
        req.num_questions = max_q
    system_prompt = _build_practice_system_prompt(
        req.subject, req.topics or [], req.difficulty, req.num_questions
    )

    # RAG: DB から参考問題を取得
    user_prompt_parts = []
    try:
        conn = connect_db()
        cur = conn.cursor()
        _is_sq = getattr(conn, '_is_sqlite', False)
        topics = req.topics or []
        if topics:
            placeholders = ','.join(['%s'] * len(topics))
            sql = (
                f"SELECT stem, topic, difficulty FROM problems "
                f"WHERE (subject = %s OR subject LIKE %s) AND topic IN ({placeholders}) "
                f"AND stem IS NOT NULL AND stem != '' "
                f"ORDER BY {'id DESC' if _is_sq else 'created_at DESC'} LIMIT %s"
            )
            cur.execute(sql, (req.subject, req.subject + '%', *topics, 10))
        else:
            sql = (
                "SELECT stem, topic, difficulty FROM problems "
                "WHERE (subject = %s OR subject LIKE %s) "
                "AND stem IS NOT NULL AND stem != '' "
                f"ORDER BY {'id DESC' if _is_sq else 'created_at DESC'} LIMIT %s"
            )
            cur.execute(sql, (req.subject, req.subject + '%', 10))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if rows:
            user_prompt_parts.append('【参考: 過去の類似問題（出題の参考にしてください）】')
            for r in rows[:5]:
                snippet = (r[0] or '')[:400]
                user_prompt_parts.append(f'- [{r[1] or "不明"}] {snippet}')
            user_prompt_parts.append('')
    except Exception as e:
        logger.warning('Practice prompt RAG failed (non-fatal): %s', e)

    topic_str = '、'.join(req.topics) if req.topics else '全分野'
    user_prompt_parts.append(
        f'{req.subject}（{topic_str}）の{req.difficulty}レベルの問題を{req.num_questions}問、'
        f'上記の構造化マーカー形式で出力してください。'
    )
    user_prompt = '\n'.join(user_prompt_parts)

    # system + user を1つの指示文にまとめて返す
    full_prompt = system_prompt + '\n\n---\n\n' + user_prompt
    return JSONResponse({'prompt': full_prompt})


def _try_parse_json_fallback(raw_text: str) -> dict | None:
    """JSON フォールバック: code fence 内JSON → 直接parse → brace-depth → _fix_latex_json_escapes の順で試行。"""
    # 1. code fence 内 JSON
    fenced = re.search(r'```(?:json)?\s*\n?([\s\S]*?)```', raw_text)
    if fenced:
        json_text = fenced.group(1).strip()
        for attempt_text in [json_text, _fix_latex_json_escapes(json_text)]:
            try:
                parsed = json.loads(attempt_text)
                if isinstance(parsed, dict):
                    return parsed
            except (json.JSONDecodeError, Exception):
                pass

    # 2. brace-depth matching (最外側の { ... } を抽出)
    brace_start = raw_text.find('{')
    if brace_start >= 0:
        depth = 0
        for i in range(brace_start, len(raw_text)):
            if raw_text[i] == '{':
                depth += 1
            elif raw_text[i] == '}':
                depth -= 1
            if depth == 0:
                candidate = raw_text[brace_start:i + 1]
                for attempt_text in [candidate, _fix_latex_json_escapes(candidate)]:
                    try:
                        parsed = json.loads(attempt_text)
                        if isinstance(parsed, dict):
                            return parsed
                    except (json.JSONDecodeError, Exception):
                        pass
                break

    return None


def _fix_latex_json_escapes(text: str) -> str:
    """JSON文字列内のLaTeX バックスラッシュを正しくエスケープする。

    問題点:
    - \\sin → \\s はJSONで不正 → parse error
    - \\frac → \\f はJSON form feed → silent corruption（\\frac ではなく制御文字+rac になる）
    - \\theta → \\t はJSON tab → silent corruption
    - \\neq → \\n はJSON newline → silent corruption
    - \\begin → \\b はJSON backspace → silent corruption

    修正:
    Pass 1: 不正なJSONエスケープ（\\s, \\c, \\d 等）を \\\\s, \\\\c に変換
    Pass 2: \\b, \\f, \\n, \\r, \\t の後にアルファベットが続く場合はLaTeXとみなし \\\\X に変換
    """
    # Pass 1: JSON標準エスケープ以外の \X → \\X
    text = re.sub(r'\\(?!["\\bfnrtu/])', r'\\\\', text)
    # Pass 2: \b,\f,\n,\r,\t + アルファベット → LaTeXコマンドとして二重エスケープ
    # 例: \frac → \\frac, \theta → \\theta, \neq → \\neq
    # 既にエスケープ済みの \\ は negative lookbehind で除外
    text = re.sub(r'(?<!\\)\\([bfnrt])(?=[a-zA-Z])', r'\\\\\1', text)
    return text


@app.post('/api/practice/parse')
async def practice_parse_json(payload: dict = Body(...)):
    """手動モード用: ユーザーが貼り付けたテキスト（構造化マーカー付きLaTeXまたはJSON）をパースし、
    problems + latex を返す。LaTeXマーカー形式を優先的に試行する。"""
    raw = payload.get('raw_text', '')
    subject = payload.get('subject', '')
    difficulty = payload.get('difficulty', '')
    if not raw.strip():
        return JSONResponse({'error': '入力が空です。'}, status_code=400)

    text = raw.strip()

    # code fence 除去
    if '```' in text:
        m = re.search(r'```(?:json|latex|tex|plain)?\s*\n?([\s\S]*?)```', text)
        if m:
            text = m.group(1).strip()

    # Step 1: 構造化マーカー付き LaTeX としてパース（優先）
    problems = _parse_latex_problems(text)
    # code fence 除去前のテキストでも再試行
    if not problems and text != raw.strip():
        problems = _parse_latex_problems(raw.strip())

    # Step 2: JSON フォールバック（共通ヘルパー使用）
    if not problems:
        data = _try_parse_json_fallback(raw.strip())
        if data and isinstance(data.get('problems'), list):
            problems = data['problems']

    if not problems:
        logger.warning('practice_parse_json: all parse methods failed. text[:300]=%s', text[:300])
        return JSONResponse({
            'error': 'パースに失敗しました。\n\n'
                     'ヒント: LLMの出力が「%%% PROBLEM 1 %%%」「%%% STEM %%%」などの'
                     '構造化マーカー形式になっているか確認してください。\n'
                     '手動モードでプロンプトを再生成してお試しください。'
        }, status_code=400)

    diff = difficulty or '応用'
    # LaTeX 構築: 問題のみ・解答のみ・フルの3種
    try:
        latex_problems = _build_practice_latex(problems, subject, diff, mode='problems')
    except Exception:
        latex_problems = None
    try:
        latex_answers = _build_practice_latex(problems, subject, diff, mode='answers')
    except Exception:
        latex_answers = None
    try:
        latex = _build_practice_latex(problems, subject, diff, mode='full')
    except Exception:
        latex = None

    return JSONResponse({
        'problems': problems,
        'latex': latex,
        'latex_problems': latex_problems,
        'latex_answers': latex_answers,
    })


@app.post('/api/practice/generate')
async def practice_generate(req: PracticeGenerateRequest = Body(...)):
    """受験生向け練習モード: 構造化マーカー付きLaTeX形式で問題を生成する。
    ポーリング方式: 即座に job_id を返す。
    """
    user_id = req.user_id
    if not user_id or user_id == 'guest':
        return JSONResponse({
            'error': 'AI自動生成を使用するにはアカウント登録とログインが必要です。',
        }, status_code=403)

    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        return JSONResponse({'error': 'OPENAI_API_KEY が設定されていません。'}, status_code=500)

    # 使用回数チェック
    usage_info = _get_usage(user_id)
    if not usage_info.get('unlocked', False) and usage_info.get('remaining', 0) <= 0:
        return JSONResponse({
            'error': f'AI生成の無料利用上限（{usage_info["limit"]}回）に達しました。',
            'usage': usage_info,
        }, status_code=429)

    # 問題数上限
    max_q = int(os.getenv('MAX_QUESTIONS_PER_GENERATION', '3'))
    if req.num_questions > max_q:
        req.num_questions = max_q

    # モデル解決
    openai_model, resolved_tier = _resolve_model(req.model_tier or 'auto', req.subject)

    # システムプロンプト構築
    system_prompt = _build_practice_system_prompt(req.subject, req.topics or [], req.difficulty, req.num_questions)

    # RAG: DB から参考問題を取得してユーザープロンプトに注入
    user_prompt_parts = []
    try:
        conn = connect_db()
        cur = conn.cursor()
        _is_sq = getattr(conn, '_is_sqlite', False)

        topics = req.topics or []
        if topics:
            placeholders = ','.join(['%s'] * len(topics))
            sql = (
                f"SELECT stem, topic, difficulty FROM problems "
                f"WHERE (subject = %s OR subject LIKE %s) AND topic IN ({placeholders}) "
                f"AND stem IS NOT NULL AND stem != '' "
                f"ORDER BY {'id DESC' if _is_sq else 'created_at DESC'} LIMIT %s"
            )
            cur.execute(sql, (req.subject, req.subject + '%', *topics, 10))
        else:
            sql = (
                "SELECT stem, topic, difficulty FROM problems "
                "WHERE (subject = %s OR subject LIKE %s) "
                "AND stem IS NOT NULL AND stem != '' "
                f"ORDER BY {'id DESC' if _is_sq else 'created_at DESC'} LIMIT %s"
            )
            cur.execute(sql, (req.subject, req.subject + '%', 10))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        if rows:
            user_prompt_parts.append('【参考: 過去の類似問題（出題の参考にしてください）】')
            for r in rows[:5]:
                snippet = (r[0] or '')[:400]
                user_prompt_parts.append(f'- [{r[1] or "不明"}] {snippet}')
            user_prompt_parts.append('')
    except Exception as e:
        logger.warning('Practice RAG failed (non-fatal): %s', e)

    topic_str = '、'.join(req.topics) if req.topics else '全分野'
    user_prompt_parts.append(
        f'{req.subject}（{topic_str}）の{req.difficulty}レベルの問題を{req.num_questions}問、'
        f'上記の構造化マーカー形式で出力してください。'
    )
    user_prompt = '\n'.join(user_prompt_parts)

    # ジョブ作成
    _cleanup_old_practice_jobs()
    job_id = uuid.uuid4().hex
    _PRACTICE_JOBS[job_id] = {
        'status': 'processing',
        'result': None,
        'error': None,
        'created_at': time.time(),
    }

    asyncio.create_task(_run_practice_job(
        job_id=job_id,
        openai_key=openai_key,
        openai_model=openai_model,
        resolved_tier=resolved_tier,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        num_questions=req.num_questions,
        user_id=user_id,
        subject=req.subject,
        difficulty=req.difficulty,
    ))

    logger.info('Practice job %s started (model=%s, subject=%s)', job_id, openai_model, req.subject)
    return JSONResponse({'job_id': job_id, 'status': 'processing'})


@app.get('/api/practice/generate/status/{job_id}')
async def practice_generate_status(job_id: str):
    """ポーリング用: 練習モード生成ジョブのステータスを返す。"""
    job = _PRACTICE_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='ジョブが見つかりません')

    if job['status'] == 'completed':
        return JSONResponse({'status': 'completed', **job['result']})
    elif job['status'] == 'error':
        return JSONResponse({'status': 'error', 'error': job['error']}, status_code=200)
    else:
        return JSONResponse({'status': 'processing'})


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
                try:
                    only = _repair_latex_nesting(only)
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
                try:
                    only = _repair_latex_nesting(only)
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

            # ── Detect LuaTeX-ja documents (ltjsarticle etc.) ──
            # ltjsarticle internally loads luatexja, which is INCOMPATIBLE with
            # xeCJK (XeLaTeX-only). Steps 2-6 inject fontspec/xeCJK and must be
            # skipped for LuaTeX-ja documents.
            _is_luatexja_doc = bool(re.search(
                r'\\documentclass[^{]*\{ltjsarticle\}|\\documentclass[^{]*\{ltjarticle\}'
                r'|\\usepackage(\[[^\]]*\])?\{luatexja\}',
                tex
            ))

            if not _is_luatexja_doc:
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

            # 7f-2) ★ CircuiTikZ bipoles/fill=white remover ★
            #     bipoles/fill was removed in circuitikz 1.x+. Remove any
            #     \ctikzset{bipoles/fill=white} lines to prevent pgfkeys errors.
            tex = re.sub(r'\\ctikzset\{bipoles/fill=white\}\s*\n?', '', tex)

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
                - Skip \\begin/\\end inside \\newcommand definitions (they are not real begins)
                - Never remove \\end{document}
                """
                # Build a list of (position, 'begin'|'end', env_name, full_match)
                token_re = re.compile(r'\\(begin|end)\{([^}]+)\}')
                tokens = [(m.start(), m.group(1), m.group(2), m.group(0)) for m in token_re.finditer(tex_str)]

                # Identify regions inside \newcommand / \renewcommand definitions
                # These contain \begin{...} that don't represent actual environment starts
                def _find_newcommand_regions(s):
                    """Find character ranges inside \\newcommand{...}{BODY} definitions."""
                    regions = []
                    for m in re.finditer(r'\\(?:re)?newcommand\{[^}]*\}(?:\[\d+\])?\{', s):
                        start = m.end() - 1  # the opening { of the body
                        depth = 1
                        i = m.end()
                        while i < len(s) and depth > 0:
                            if s[i] == '{' and (i == 0 or s[i-1] != '\\'):
                                depth += 1
                            elif s[i] == '}' and (i == 0 or s[i-1] != '\\'):
                                depth -= 1
                            i += 1
                        regions.append((start, i))
                    return regions

                newcmd_regions = _find_newcommand_regions(tex_str)

                def _inside_newcommand(pos):
                    return any(start <= pos < end for start, end in newcmd_regions)

                # Collect environment names that have \begin{} inside \newcommand
                # These will have \end{} in the body that look like orphans but are valid
                macro_envs = set()
                for pos, kind, env, full in tokens:
                    if kind == 'begin' and _inside_newcommand(pos):
                        macro_envs.add(env)

                # Filter out tokens inside \newcommand definitions
                real_tokens = [(pos, kind, env, full) for pos, kind, env, full in tokens
                               if not _inside_newcommand(pos)]

                stack = []
                orphan_ends = []  # positions of \end{...} to remove

                for pos, kind, env, full in real_tokens:
                    if kind == 'begin':
                        stack.append((pos, env))
                    else:  # end
                        # Never treat \end{document} as orphan
                        if env == 'document' and not stack:
                            continue
                        # Skip orphan detection for envs opened inside \newcommand
                        # (their \end appears in the body and looks like an orphan)
                        if env in macro_envs and (not stack or stack[-1][1] != env):
                            continue
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
        # ltjsarticle (LuaTeX-ja) requires lualatex; prefer it over xelatex for such docs
        _needs_lualatex = bool(re.search(r'\\documentclass[^{]*\{ltjsarticle\}', fixed_body))
        if not _cloud_only:
            candidates = ('lualatex', 'xelatex', 'pdflatex') if _needs_lualatex else ('xelatex', 'lualatex', 'pdflatex')
            for cand in candidates:
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
            # ltjsarticle requires lualatex; default to xelatex for everything else
            _cloud_compiler = 'lualatex' if re.search(r'\\documentclass[^{]*\{ltjsarticle\}', body_tex) else 'xelatex'
            try:
                cloud_resp = requests.post(
                    'https://latex.ytotech.com/builds/sync',
                    json={
                        'compiler': _cloud_compiler,
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


# ── TikZ → PNG rendering endpoint ──────────────────────────
# In-memory cache: hash(tikz) → PNG bytes  (bounded LRU)
_tikz_png_cache: Dict[str, bytes] = {}
_TIKZ_CACHE_MAX = 200


def _preprocess_tikz_code(tikz_code: str) -> str:
    """TikZコードのよくある問題を自動修正する前処理。"""
    import re as _re
    code = tikz_code.strip()

    # 1. tikzpicture環境のみのコード（\begin{tikzpicture}で始まらない場合）を補完
    #    コードが\begin{tikzpicture}や\begin{circuitikz}で始まらずに
    #    TikZコマンドだけ書かれている場合、ラップする
    has_env = bool(_re.search(r'\\begin\{(tikzpicture|circuitikz|axis)\}', code))
    if not has_env:
        code = '\\begin{tikzpicture}\n' + code + '\n\\end{tikzpicture}'

    # 2. 閉じ忘れた -- cycle を補完するのは難しいので、よくある記法の崩れを修正
    #    \draw[...] (...) -- (...); の最後のセミコロン補完（最終行がセミコロンなしの場合）
    lines = code.splitlines()
    fixed_lines = []
    for ln in lines:
        stripped = ln.rstrip()
        # \draw / \fill / \node で始まりセミコロンで終わっていない行（次行が \end でない場合）
        if stripped and not stripped.endswith(';') and not stripped.endswith('{') and not stripped.endswith('}') and not stripped.endswith(','):
            # \node at ... { ... } は閉じてあることが多いので無視
            pass
        fixed_lines.append(ln)
    code = '\n'.join(fixed_lines)

    # 3. circuitikzのよくある問題: \ctikzset が \begin より前に来ていた場合は削除
    #    (standalone docでは preamble に書く必要があるが、tikzコードに混入している場合)
    code = _re.sub(r'\\ctikzset\{[^}]*\}\s*\n?', '', code)

    # 4. \usepackage{...} がtikzコード内に混入している場合は削除
    code = _re.sub(r'\\usepackage\{[^}]*\}\s*\n?', '', code)
    code = _re.sub(r'\\usetikzlibrary\{[^}]*\}\s*\n?', '', code)

    # 5. バネ描画: zigzag/snake → coil（螺旋）に自動修正
    code = _re.sub(
        r'decoration\s*=\s*\{?\s*zigzag\b',
        r'decoration={coil, aspect=0.35, segment length=5pt, amplitude=8pt',
        code
    )
    code = _re.sub(
        r'decoration\s*=\s*\{?\s*snake\b',
        r'decoration={coil, aspect=0.35, segment length=5pt, amplitude=8pt',
        code
    )

    return code.strip()


def _build_tikz_standalone(tikz_code: str, with_cjk: bool = False) -> str:
    """TikZコードからstandaloneドキュメントを構築。"""
    cjk_block = (
        "\\usepackage{iftex}\n"
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
        "  \\else\n"
        "    \\usepackage{xeCJK}\n"
        "  \\fi\n"
        "\\fi\n"
    ) if with_cjk else ''
    return (
        "\\documentclass[border=8pt]{standalone}\n"
        "\\usepackage{amsmath,amssymb,mathtools}\n"
        "\\usepackage{tikz,pgfplots}\n"
        "\\pgfplotsset{compat=1.18}\n"
        "\\usetikzlibrary{arrows.meta,calc,positioning,decorations.markings,"
        "decorations.pathmorphing,patterns,angles,quotes,intersections,shapes.geometric,"
        "3d,perspective,shapes}\n"
        "\\usepackage[siunitx]{circuitikz}\n"
        + cjk_block +
        "\\begin{document}\n"
        f"{tikz_code}\n"
        "\\end{document}\n"
    )


@app.post('/api/render_tikz')
def render_tikz(payload: dict = Body(...)):
    """Compile a TikZ snippet to a cropped PNG image.

    Payload: { "tikz": "\\begin{tikzpicture}...\\end{tikzpicture}" }
    Returns: image/png
    """
    tikz_code = (payload.get('tikz') or '').strip()
    if not tikz_code:
        return JSONResponse({'error': 'empty_tikz'}, status_code=400)

    # Safety check – reject dangerous commands
    if not _latex_sanitize_check(tikz_code):
        return JSONResponse({'error': 'tikz_forbidden'}, status_code=400)

    # 前処理: よくある問題を修正
    tikz_code = _preprocess_tikz_code(tikz_code)

    # Check cache
    import hashlib
    cache_key = hashlib.sha256(tikz_code.encode('utf-8')).hexdigest()
    if cache_key in _tikz_png_cache:
        return Response(content=_tikz_png_cache[cache_key], media_type='image/png')

    # Build standalone LaTeX document
    standalone_doc = _build_tikz_standalone(tikz_code, with_cjk=True)

    td = tempfile.mkdtemp(prefix='tikz_')
    tex_path = os.path.join(td, 'figure.tex')
    pdf_path = os.path.join(td, 'figure.pdf')
    png_path = os.path.join(td, 'figure.png')

    try:
        with open(tex_path, 'w', encoding='utf-8') as f:
            f.write(standalone_doc)

        # Find LaTeX engine
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

        # Compile
        compiled = False
        compile_log = ''
        if engine:
            try:
                result = subprocess.run(
                    [engine_name, '-interaction=nonstopmode', '-halt-on-error',
                     '-output-directory', td, tex_path],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45,
                )
                compile_log = (result.stdout or b'').decode('utf-8', errors='replace')
                compiled = result.returncode == 0 and os.path.exists(pdf_path)
                if not compiled:
                    logger.warning('TikZ local compile failed (rc=%d): %s', result.returncode, compile_log[-800:])
                    # リトライ: circuitikzなしのシンプルなドキュメントで再試行
                    simple_doc = _build_tikz_standalone(tikz_code, with_cjk=False)
                    with open(tex_path, 'w', encoding='utf-8') as f:
                        f.write(simple_doc)
                    result2 = subprocess.run(
                        [engine_name, '-interaction=nonstopmode', '-halt-on-error',
                         '-output-directory', td, tex_path],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45,
                    )
                    compiled = result2.returncode == 0 and os.path.exists(pdf_path)
                    if compiled:
                        logger.info('TikZ retry (no-CJK) succeeded')
                    else:
                        logger.warning('TikZ retry also failed')
            except (subprocess.TimeoutExpired, OSError) as exc:
                logger.warning('TikZ local compilation failed (%s): %s', engine_name, exc)

        if not compiled:
            # Cloud fallback — 最大2回試行
            for cloud_attempt in range(2):
                try:
                    # 再試行時はシンプルドキュメントを使う
                    doc_to_send = standalone_doc if cloud_attempt == 0 else _build_tikz_standalone(tikz_code, with_cjk=False)
                    cloud_resp = requests.post(
                        'https://latex.ytotech.com/builds/sync',
                        json={'compiler': 'xelatex', 'resources': [{'main': True, 'content': doc_to_send}]},
                        timeout=90,
                    )
                    if cloud_resp.status_code in (200, 201) and cloud_resp.headers.get('Content-Type', '').startswith('application/pdf'):
                        with open(pdf_path, 'wb') as pf:
                            pf.write(cloud_resp.content)
                        compiled = True
                        break
                    else:
                        logger.error('Cloud TikZ compile failed (attempt %d): %s', cloud_attempt + 1, cloud_resp.text[:500])
                except Exception as cloud_exc:
                    logger.warning('Cloud TikZ request failed (attempt %d): %s', cloud_attempt + 1, cloud_exc)

        if not compiled or not os.path.exists(pdf_path):
            return JSONResponse({'error': 'tikz_compilation_failed', 'hint': 'LaTeXコンパイルに失敗しました'}, status_code=500)

        # Convert PDF → PNG
        png_bytes = None

        # Try pdftoppm (poppler)
        pdftoppm = shutil.which('pdftoppm')
        if pdftoppm:
            try:
                out_prefix = os.path.join(td, 'out')
                subprocess.run(
                    [pdftoppm, '-png', '-r', '200', '-singlefile', pdf_path, out_prefix],
                    check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15,
                )
                out_png = out_prefix + '.png'
                if os.path.exists(out_png):
                    with open(out_png, 'rb') as pf:
                        png_bytes = pf.read()
            except Exception as e:
                logger.warning('pdftoppm failed: %s', e)

        # Try sips (macOS built-in)
        if not png_bytes and shutil.which('sips'):
            try:
                subprocess.run(
                    ['sips', '-s', 'format', 'png', pdf_path, '--out', png_path],
                    check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15,
                )
                if os.path.exists(png_path):
                    with open(png_path, 'rb') as pf:
                        png_bytes = pf.read()
            except Exception as e:
                logger.warning('sips failed: %s', e)

        # Fallback: return PDF if no PNG converter available
        if not png_bytes:
            with open(pdf_path, 'rb') as pf:
                pdf_bytes = pf.read()
            # Cache and return PDF
            if len(_tikz_png_cache) >= _TIKZ_CACHE_MAX:
                _tikz_png_cache.pop(next(iter(_tikz_png_cache)), None)
            _tikz_png_cache[cache_key] = pdf_bytes
            return Response(content=pdf_bytes, media_type='application/pdf')

        # Cache PNG
        if len(_tikz_png_cache) >= _TIKZ_CACHE_MAX:
            _tikz_png_cache.pop(next(iter(_tikz_png_cache)), None)
        _tikz_png_cache[cache_key] = png_bytes
        return Response(content=png_bytes, media_type='image/png')

    except Exception as e:
        logger.exception('render_tikz failed')
        return JSONResponse({'error': 'render_tikz_failed', 'detail': str(e)}, status_code=500)
    finally:
        shutil.rmtree(td, ignore_errors=True)


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


@app.delete('/api/template/{template_id}')
def api_delete_template(template_id: str):
    """Delete a template by ID from DB and JSON file."""
    if not template_id:
        return JSONResponse({'error': 'invalid_id'}, status_code=400)
    db_deleted = False
    try:
        conn = connect_db()
        is_sqlite = getattr(conn, '_is_sqlite', False)
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM templates WHERE id = %s", (template_id,))
        else:
            cur.execute("DELETE FROM templates WHERE id = %s", (template_id,))
        conn.commit()
        cur.close()
        conn.close()
        db_deleted = True
    except Exception as e:
        logger.warning('Failed to delete template from DB: %s', e)

    # Also remove from JSON file
    try:
        target = os.path.join(THIS_DIR, 'templates.json')
        if os.path.exists(target):
            with open(target, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if template_id in data:
                del data[template_id]
                with open(target, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning('Failed to remove template from JSON: %s', e)

    # Update in-memory cache
    tpls = globals().get('TEMPLATES') or {}
    if template_id in tpls:
        del tpls[template_id]
    globals()['TEMPLATES'] = tpls

    return JSONResponse({'deleted': True, 'id': template_id, 'db_deleted': db_deleted})