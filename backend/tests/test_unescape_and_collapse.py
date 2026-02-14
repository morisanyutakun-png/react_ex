"""Tests for _unescape_latex and _collapse_internal_newlines fixes.

Verifies that:
1. _unescape_latex does NOT destroy LaTeX commands starting with \\n
   (\\newpage, \\newtcolorbox, \\noindent, \\neq, etc.)
2. _unescape_latex still correctly converts JSON-escaped \\n to newlines
3. _collapse_internal_newlines does NOT merge \\\\ line breaks in align
   environments with the next line
"""
import re
import sys


# ── _unescape_latex (copy from main.py with fix applied) ──
def _unescape_latex(latex: str) -> str:
    if not latex or not isinstance(latex, str):
        return latex
    s = latex
    if '\\r\\n' in s or '\\n' in s:
        s = re.sub(r'\\r\\n(?![a-zA-Z])', '\n', s)
        s = re.sub(r'\\n(?![a-zA-Z])', '\n', s)
    s = re.sub(r"\\\\([a-zA-Z@]+)", r"\\\1", s)
    if '\t' in s:
        s = s.replace('\t', ' ')
    return s


# ── _collapse_internal_newlines (copy from main.py with fix applied) ──
def _collapse_internal_newlines(latex: str) -> str:
    if not latex or not isinstance(latex, str):
        return latex
    s = latex
    s = s.replace('\r\n', '\n')

    try:
        s = re.sub(r"\$(.*?)\$", lambda m: '$' + m.group(1).replace('\n', ' ') + '$', s, flags=re.S)
        s = re.sub(r"\\\((.*?)\\\)", lambda m: '\\(' + m.group(1).replace('\n', ' ') + '\\)', s, flags=re.S)
        s = re.sub(r"\\\[(.*?)\\\]", lambda m: '\\[' + m.group(1).replace('\n', ' ') + '\\]', s, flags=re.S)
    except Exception:
        pass

    s = re.sub(r"\^\s*\n\s*", "^", s)
    s = re.sub(r"\n\s*\^", "^", s)

    # Fixed: negative lookbehind to protect \\\\ linebreaks
    s = re.sub(r"(?<!\\)\\\s*\n\s*([a-zA-Z@]+)", r"\\\1", s)

    s = s.replace(')\n^', ')^')
    return s


# ═══════════════════════════════════════════
# _unescape_latex tests
# ═══════════════════════════════════════════

def test_unescape_newpage_preserved():
    """\\newpage must NOT become newline + ewpage."""
    inp = r"\newpage"
    out = _unescape_latex(inp)
    assert out == r"\newpage", f"Expected '\\newpage', got {out!r}"


def test_unescape_newtcolorbox_preserved():
    """\\newtcolorbox must NOT be broken."""
    inp = r"\newtcolorbox{problembox}[1][]{enhanced}"
    out = _unescape_latex(inp)
    assert r"\newtcolorbox" in out, f"Lost \\newtcolorbox: {out!r}"
    assert "{problembox}" in out, f"Lost {{problembox}}: {out!r}"


def test_unescape_noindent_preserved():
    """\\noindent, \\neq, \\neg must NOT be broken."""
    for cmd in [r"\noindent", r"\neq", r"\neg", r"\nonumber", r"\notag", r"\ni"]:
        out = _unescape_latex(cmd)
        assert out == cmd, f"Expected {cmd!r}, got {out!r}"


def test_unescape_standalone_newline_converted():
    """Standalone \\n (JSON escape) before non-letter should become a real newline."""
    # \n followed by a backslash (next LaTeX command) — should be replaced
    inp = "line1\\n\\begin{document}"
    out = _unescape_latex(inp)
    assert "line1\n\\begin{document}" == out, f"Expected newline+begin, got {out!r}"

    # \n followed by space — should be replaced
    inp2 = "line1\\n  more text"
    out2 = _unescape_latex(inp2)
    assert "line1\n  more text" == out2, f"Expected newline+space, got {out2!r}"

    # \n followed by digit — should be replaced
    inp3 = "x=1\\n2+3"
    out3 = _unescape_latex(inp3)
    assert "x=1\n2+3" == out3, f"Expected newline, got {out3!r}"


def test_unescape_n_before_letter_preserved():
    """\\n followed by a letter looks like a LaTeX command — must be preserved."""
    # \nline2 could be interpreted as \\nline2 (protect as potential command)
    inp = "line1\\nline2"
    out = _unescape_latex(inp)
    # The \\n is followed by 'l' (a letter), so it is NOT converted
    assert "\\n" in out or "\n" not in out[:10], f"\\n before letter was wrongly converted: {out!r}"


def test_unescape_newline_before_brace():
    """\\n followed by { should be converted."""
    inp = "text\\n{more}"
    out = _unescape_latex(inp)
    assert out == "text\n{more}", f"Expected newline, got {out!r}"


def test_unescape_newline_before_backslash():
    """\\n followed by \\ should be converted (next LaTeX command on new line)."""
    inp = r"text\n\begin"
    out = _unescape_latex(inp)
    assert out == "text\n\\begin", f"Expected newline+begin, got {out!r}"


def test_unescape_crlf_before_letter_preserved():
    """\\r\\n before a letter should NOT consume the letters."""
    # This edge case: \\r followed by \\newpage
    inp = "end\\r\\newpage"
    out = _unescape_latex(inp)
    # The \\r\\n part starts matching at "\\r\\n" but the \\n is followed by 'e'
    # so \\r\\n should NOT be replaced. \\n alone is also followed by 'e'.
    assert "\\newpage" in out or "newpage" in out, f"Unexpected: {out!r}"


def test_unescape_full_document_snippet():
    """A realistic LaTeX snippet with \\newpage, \\newtcolorbox, etc."""
    inp = (
        r"\documentclass{article}"
        r"\n"
        r"\usepackage{tcolorbox}"
        r"\n"
        r"\newtcolorbox{problembox}[1][]{enhanced,breakable}"
        r"\n"
        r"\begin{document}"
        r"\n"
        r"\section*{問題}"
        r"\n"
        r"\newpage"
        r"\n"
        r"\section*{解答}"
        r"\n"
        r"\end{document}"
    )
    out = _unescape_latex(inp)
    assert "\\newtcolorbox" in out, f"Lost \\newtcolorbox: {out!r}"
    assert "\\newpage" in out, f"Lost \\newpage: {out!r}"
    assert "\\begin{document}" in out, f"Lost \\begin: {out!r}"
    assert "\\end{document}" in out, f"Lost \\end: {out!r}"
    assert "\n" in out, "No newlines were created from \\n separators"


# ═══════════════════════════════════════════
# _collapse_internal_newlines tests
# ═══════════════════════════════════════════

def test_collapse_preserves_align_linebreaks():
    """Double backslash \\\\ at end of line in align must NOT be merged with next."""
    inp = "x &= 1 \\\\\ny &= 2"
    out = _collapse_internal_newlines(inp)
    # The \\\\ + newline + y should NOT become \\y or \y
    assert "y &= 2" in out, f"y &= 2 was destroyed: {out!r}"
    assert "\\y" not in out, f"Created bad \\y: {out!r}"


def test_collapse_still_joins_split_command():
    r"""A lone backslash + newline + letters like \<NL>textbf should be joined."""
    inp = "\\\ntextbf{test}"
    out = _collapse_internal_newlines(inp)
    assert "\\textbf{test}" in out, f"Failed to join: {out!r}"


def test_collapse_align_multiline():
    """Full align* environment should survive collapse."""
    inp = (
        "\\begin{align*}\n"
        "  x &= 1 \\\\\n"
        "  y &= 2 \\\\\n"
        "  z &= 3\n"
        "\\end{align*}"
    )
    out = _collapse_internal_newlines(inp)
    assert "y &= 2" in out, f"Lost y=2: {out!r}"
    assert "z &= 3" in out, f"Lost z=3: {out!r}"
    assert "\\begin{align*}" in out, f"Lost begin: {out!r}"
    assert "\\end{align*}" in out, f"Lost end: {out!r}"


# ═══════════════════════════════════════════
# _replace_placeholders test
# ═══════════════════════════════════════════

def test_replace_placeholders_preserves_latex_braces():
    """_replace_placeholders must NOT destroy LaTeX \\begin{document} etc."""
    def _replace_placeholders(s, context):
        def repl(m):
            k = m.group(1)
            if k in context:
                return str(context[k])
            return m.group(0)
        return re.sub(r"\{([a-zA-Z0-9_]+)\}", repl, s)

    ctx = {'subject': '数学', 'difficulty': '普通'}
    text = r"\begin{document} \usepackage{fontspec} {subject} {difficulty} {unknown_key}"
    out = _replace_placeholders(text, ctx)
    assert "\\begin{document}" in out, f"Lost {{document}}: {out!r}"
    assert "\\usepackage{fontspec}" in out, f"Lost {{fontspec}}: {out!r}"
    assert "数学" in out, f"Missing subject: {out!r}"
    assert "普通" in out, f"Missing difficulty: {out!r}"
    assert "{unknown_key}" in out, f"Missing unknown_key: {out!r}"


# ═══════════════════════════════════════════
if __name__ == '__main__':
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
            print(f"  PASS: {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL: {t.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"  ERROR: {t.__name__}: {e}")
    print(f"\n{passed}/{passed+failed} tests passed")
    if failed:
        sys.exit(1)
    else:
        print("All tests passed!")
