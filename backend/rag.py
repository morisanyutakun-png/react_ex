from typing import List, Tuple
import re
import logging
import unicodedata

try:
    # sklearn/numpy are optional at import-time for static checks; runtime will need them.
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
except Exception:  # pragma: no cover - handled at runtime
    TfidfVectorizer = None
    cosine_similarity = None
    np = None

logger = logging.getLogger(__name__)


# -----------------------------
# Helpers for LaTeX-aware cleaning and answer extraction
# -----------------------------

def clean_latex(latex: str) -> str:
    """Simple LaTeX normalization: strip comments, normalize line endings, collapse many blank lines."""
    if not latex:
        return ""
    text = re.sub(r"(?m)^[ \t]*%.*\n?", "", latex)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_problem_and_answer_latex(chunk: str) -> Tuple[str, str]:
    """Extract answer/solution blocks from a LaTeX-ish chunk.
    Returns (stem, solution_outline).
    """
    if not chunk:
        return '', ''
    m = re.search(r"\\begin\{(?:answer|solution)\}([\s\S]*?)\\end\{(?:answer|solution)\}", chunk, flags=re.I)
    if m:
        prob = chunk[: m.start()].strip()
        sol = m.group(1).strip()
        return prob, sol
    m2 = re.search(r"(?:\n|\A)\s*(Answer:|解答[:：]?|解説[:：]?|答[:：]?)([\s\S]*)$", chunk, flags=re.I)
    if m2:
        idx = m2.start()
        prob = chunk[:idx].strip()
        sol = m2.group(2).strip()
        return prob, sol
    inline = re.search(r"Answer:\s*(\(.+\)|.+)$", chunk, flags=re.I)
    if inline:
        sol = inline.group(1).strip()
        prob = chunk.replace(inline.group(0), '').strip()
        return prob, sol
    return chunk, ''


def split_problem_and_answer(chunk: str) -> Tuple[str, str]:
    """Plain-text variant of answer extraction."""
    if not chunk:
        return '', ''
    m = re.search(r"(?:\n|\A)\s*(Answer:|解答[:：]?|解説[:：]?|答[:：]?)([\s\S]*)$", chunk, flags=re.I)
    if m:
        idx = m.start()
        prob = chunk[:idx].strip()
        sol = m.group(2).strip()
        return prob, sol
    inline = re.search(r"Answer:\s*(\(.+\)|.+)$", chunk, flags=re.I)
    if inline:
        sol = inline.group(1).strip()
        prob = chunk.replace(inline.group(0), '').strip()
        return prob, sol
    return chunk, ''


def clean_text(text: str) -> str:
    """Normalize plain text: whitespace, duplicate lines, and common PDF-noise fixes."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = unicodedata.normalize("NFKC", text)

    def _keep(ch: str) -> bool:
        cat = unicodedata.category(ch)
        if ch in ("\n", "\t"):
            return True
        if cat in ("Cf", "Cc"):
            return False
        return True

    text = "".join(ch for ch in text if _keep(ch))
    text = text.replace("\t", " ")
    text = re.sub(r"[ \u00A0]+", " ", text)
    lines = [ln.strip() for ln in text.split("\n")]
    deduped_lines: List[str] = []
    prev = None
    for ln in lines:
        if not ln:
            deduped_lines.append("")
            prev = None
            continue
        if prev is not None and ln == prev:
            continue
        deduped_lines.append(ln)
        prev = ln
    text = "\n".join(deduped_lines)
    text = re.sub(r"\s*([【\[\(\（])\s*", r"\1", text)
    text = re.sub(r"\s*([】\]\)\）])\s*", r"\1", text)
    text = re.sub(r"([・。．\.\,\，:：;；!?！？])\1{1,}", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# -----------------------------
# Main chunking logic (LaTeX-aware and plain-text fallback)
# -----------------------------

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[dict]:
    """Return a list of {'stem', 'solution_outline'} dicts from the input text.

    Heuristic:
    - If input contains LaTeX-like markers (\begin{, \section, \item, $), use the
      LaTeX path which tries to split by problem-like headers and extract answer envs.
    - Otherwise use plain-text header detection and a sliding-window fallback.
    """
    if not text:
        return []

    # detect LaTeX-like input
    if re.search(r"\\begin\{|\\section|\\item\b|\\\\\[|\\\\\(|\$\$|\$", text):
        txt = clean_latex(text)
        header_re = re.compile(r"(?:\\begin\{problem\}|\\begin\{question\}|^\s*\\item\b|\\section\*?\{.*?問|(?:^|\n)Q\d+)", re.IGNORECASE | re.MULTILINE)
        matches = list(header_re.finditer(txt))
        if matches:
            out = []
            for i, m in enumerate(matches):
                start = m.start()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(txt)
                chunk = txt[start:end].strip()
                if chunk:
                    prob, sol = split_problem_and_answer_latex(chunk)
                    out.append({'stem': prob, 'solution_outline': sol})
            return out

        # fallback sliding window
        txt = txt.replace("\r\n", "\n")
        chunks = []
        start = 0
        L = len(txt)
        while start < L:
            end = start + chunk_size
            chunk = txt[start:end].strip()
            if chunk:
                prob, sol = split_problem_and_answer_latex(chunk)
                chunks.append({'stem': prob, 'solution_outline': sol})
            if end >= L:
                break
            start = end - overlap
        return chunks

    # Plain-text path
    t = clean_text(text)
    # Use a more conservative numeric-header pattern to avoid splitting on
    # ordinary enumerated steps or explanation lines that start with numbers
    # followed by punctuation and Japanese text (e.g. '1. 十の位を...'). Require
    # an ASCII-like continuation or space after the numeric marker to treat it
    # as a problem header.
    header_re = re.compile(
        r'(?:\n|\A)\s*(?:【\s*)?(?:'
        r'第\s*\d+\s*問|問\s*\d+|Problem\s*\d+|Q(?:uestion)?\s*\d+|\d+\s*[\)\．\.]\s*(?:[A-Za-z0-9\(\["\'\s]|$))',
        re.IGNORECASE,
    )
    matches = list(header_re.finditer(t))
    if matches:
        chunks_out: List[dict] = []
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(t)
            chunk = t[start:end].strip()
            if chunk:
                prob, sol = split_problem_and_answer(chunk)
                chunks_out.append({'stem': prob, 'solution_outline': sol})
        return chunks_out

    # sliding fallback for plain text
    t = t.replace("\r\n", "\n")
    chunks = []
    start = 0
    L = len(t)
    while start < L:
        end = start + chunk_size
        chunk = t[start:end].strip()
        if chunk:
            prob, sol = split_problem_and_answer(chunk)
            chunks.append({'stem': prob, 'solution_outline': sol})
        if end >= L:
            break
        start = end - overlap
    return chunks


# -----------------------------
# TF-IDF index / search helpers
# -----------------------------

def build_index(chunks: List[str]) -> Tuple[object, object]:
    """Build a TF-IDF vectorizer and matrix for a list of chunk strings.

    Returns (vectorizer, mat). If sklearn isn't available this will raise at runtime.
    """
    if TfidfVectorizer is None:
        raise RuntimeError("scikit-learn is required for build_index/search")
    if not chunks:
        vectorizer = TfidfVectorizer()
        mat = vectorizer.fit_transform([""]).toarray()
        return vectorizer, mat
    vectorizer = TfidfVectorizer()
    mat = vectorizer.fit_transform(chunks).toarray()
    return vectorizer, mat


def search(query: str, vectorizer: object, mat: object, chunks: List[str], top_k: int = 5):
    """Return top-k similar chunks for the query using the provided TF-IDF index."""
    if cosine_similarity is None or np is None:
        raise RuntimeError("scikit-learn and numpy are required for search")
    if not chunks:
        return []
    qv = vectorizer.transform([query]).toarray()
    sims = cosine_similarity(qv, mat)[0]
    idxs = np.argsort(-sims)[:top_k]
    return [{"score": float(sims[int(i)]), "text": chunks[int(i)], "idx": int(i)} for i in idxs]
