"""
Simple problem-unit segmenter for exam problems (MVP).

Rules (MVP):
- Split when encountering clear problem headers such as '問1', '問題1', '【問題1】', 'Problem 1', or a line that starts with a numeral + punctuation (e.g. '1.' or '1）').
- Keep small subquestions like '(1)', '（1）', '（ア）' inside the same problem (do not split on them).
- Respect page breaks if form-feed characters (\f) are present — page numbers are attached to chunks.

This module exposes `segment_text(text)` which returns a list of dicts:
  { 'stem': str, 'page': Optional[int], 'metadata': dict }

The implementation is backwards-compatible: when parsing JSON input the function
accepts 'stem' keys and always emits 'stem'.
"""
import re
import json
from typing import List, Dict, Optional


PROBLEM_HEADER_PATTERNS = [
    re.compile(r"^\s*(?:問|問題)\s*\d+", re.IGNORECASE),
    re.compile(r"^\s*【問題\s*\d+】"),
    re.compile(r"^\s*Problem\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*Q(?:uestion)?\s*\d+", re.IGNORECASE),
    # More conservative numeric header: only treat as header when the marker is
    # followed by ASCII-like text or nothing. This avoids splitting on lines like
    # '2. 十の位を処理...' which are explanation lines in Japanese.
    re.compile(r"^\s*\d+\s*[\).．\.]\s*(?:[A-Za-z0-9\(\[\"']|$)"),
]


def is_problem_header(line: str) -> bool:
    for p in PROBLEM_HEADER_PATTERNS:
        if p.match(line):
            return True
    return False


def split_pages(text: str) -> List[Dict]:
    # Split on form-feed or explicit page markers. Return list of {page:int, text:str}
    pages = []
    if '\f' in text:
        parts = text.split('\f')
        for i, p in enumerate(parts, start=1):
            pages.append({'page': i, 'text': p.strip()})
    else:
        # fallback: single page
        pages.append({'page': 1, 'text': text})
    return pages


def segment_text(text: str) -> List[Dict[str, Optional[object]]]:
    """Segment input text into problem units.

    Returns list of dicts: {'stem', 'page', 'metadata'}
    """
    results: List[Dict[str, Optional[object]]] = []

    # Try to detect JSON blob and return parsed problems if present
    def _try_parse_json_blob(s: str):
        if not s:
            return None
        t = s.strip()
        # strip fences
        if t.startswith('```') and t.endswith('```'):
            lines = t.splitlines()
            if len(lines) >= 3:
                t = '\n'.join(lines[1:-1]).strip()
        try:
            return json.loads(t)
        except Exception:
            return None

    parsed_json = _try_parse_json_blob(text)
    if parsed_json is not None:
        out = []
        if isinstance(parsed_json, dict):
            # support nested 'problem' object
            if isinstance(parsed_json.get('problem'), dict):
                p = parsed_json.get('problem')
                md = p.get('metadata') or parsed_json.get('metadata') or {}
                out.append({
                    'stem': p.get('stem') if p.get('stem') is not None else (p.get('text') or json.dumps(parsed_json, ensure_ascii=False)),
                    'normalized_text': p.get('normalized_text') or parsed_json.get('normalized_text'),
                    'page': parsed_json.get('page'),
                    'metadata': md,
                    'solution_outline': p.get('solution_outline') or '',
                    'stem_latex': p.get('stem_latex') or parsed_json.get('stem_latex'),
                    'difficulty': p.get('difficulty') if p.get('difficulty') is not None else parsed_json.get('difficulty'),
                })
            else:
                # accept canonical 'stem'
                stem = parsed_json.get('stem')
                out.append({'stem': stem or json.dumps(parsed_json, ensure_ascii=False), 'page': parsed_json.get('page'), 'metadata': parsed_json.get('metadata') or {}})
        elif isinstance(parsed_json, list):
            for item in parsed_json:
                if isinstance(item, dict):
                    out.append({'stem': item.get('stem') if item.get('stem') is not None else (item.get('text') or json.dumps(item, ensure_ascii=False)), 'page': item.get('page'), 'metadata': item.get('metadata') or {}})
                else:
                    out.append({'stem': str(item), 'page': None, 'metadata': {}})
        return out

    pages = split_pages(text)
    for p in pages:
        page_no = p['page']
        body = p['text']
        lines = body.splitlines()

        current_buf: List[str] = []
        saw_header = False

        def flush(buf: List[str]):
            if not buf:
                return
            chunk = '\n'.join([l.rstrip() for l in buf]).strip()
            if chunk:
                results.append({'stem': chunk, 'page': page_no, 'metadata': {}})
            buf.clear()

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                current_buf.append('')
                continue

            if is_problem_header(stripped):
                if not saw_header:
                    current_buf.append(stripped)
                    saw_header = True
                else:
                    if current_buf:
                        flush(current_buf)
                    current_buf.append(stripped)
                    saw_header = True
            else:
                current_buf.append(line)

        flush(current_buf)

    # Post-process: merge very short items with previous to avoid over-splitting
    merged: List[Dict] = []
    for item in results:
        text_chunk = item.get('stem') if item.get('stem') is not None else (item.get('text') or '')
        if merged and (len(text_chunk) < 60 or text_chunk.strip().startswith('解答') or text_chunk.strip().startswith('解説')):
            prev = merged[-1]
            prev_stem = prev.get('stem') if prev.get('stem') is not None else (prev.get('text') or '')
            prev['stem'] = prev_stem + '\n\n' + text_chunk
        else:
            merged.append(item)

    return merged


def normalize_numbers(text: str) -> str:
    # replace digits (ASCII and fullwidth) with <NUM>
    text = re.sub(r'[0-9０-９]+', '<NUM>', text)
    return text


if __name__ == '__main__':
    sample = """
問題1
(1) 次の式を計算せよ。
1+2= ?

問題2
次の問いに答えよ。
"""
    chunks = segment_text(sample)
    for c in chunks:
        print('---')
        print('PAGE:', c['page'])
        print(c.get('stem'))
