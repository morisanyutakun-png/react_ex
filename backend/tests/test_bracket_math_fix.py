"""Test that _convert_bracket_math_blocks correctly converts bare-bracket
display math to \\[...\\] while preserving option brackets."""
import re
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def _convert_bracket_math_blocks(blob: str) -> str:
    """Copy of the fixed function for unit testing (with inline-math protection)."""
    if not isinstance(blob, str) or not blob.strip():
        return blob

    # Phase 1: protect inline math $...$ with placeholders
    _inline_stash = []
    def _stash_inline(m):
        _inline_stash.append(m.group(0))
        return f"__ILMATH{len(_inline_stash)-1}__"
    protected = re.sub(r'(?<!\\)\$([^\$\n]*?)(?<!\\)\$', _stash_inline, blob)

    def _repl(m):
        inner = m.group(1)
        prefix = protected[:m.start()]
        if re.search(r"\\[A-Za-z]+\*?\s*$", prefix):
            return m.group(0)
        if re.search(r"\}\s*$", prefix):
            return m.group(0)
        stripped = inner.strip()
        if len(stripped) < 2:
            return m.group(0)
        if '__ILMATH' in inner:
            return m.group(0)
        if re.search(r'title\s*=', stripped):
            return m.group(0)
        math_indicators = (
            r'\\begin\{|\\end\{|'
            r'\\frac|\\sqrt|\\left|\\right|'
            r'\\therefore|\\because|\\implies|\\Rightarrow|'
            r'\\ge|\\le|\\geq|\\leq|\\neq|'
            r'\\sum|\\prod|\\int|\\lim|'
            r'\\sin|\\cos|\\tan|\\log|\\exp|'
            r'\\cdot|\\times|\\pm|\\mp|'
            r'[=<>]|'
            r'[\^_]|'
            r'&'
        )
        if re.search(math_indicators, stripped):
            return '\\[' + '\n' + stripped + '\n' + '\\]'
        return m.group(0)

    result = re.sub(r"(?<![\\A-Za-z])\[\s*([\s\S]*?)\s*\]", _repl, protected)

    # Phase 3: restore inline math
    for i, orig in enumerate(_inline_stash):
        result = result.replace(f"__ILMATH{i}__", orig)
    return result


def test_bare_bracket_aligned():
    """LLM writes [ \\begin{aligned}...\\end{aligned} ] — must become \\[...\\]"""
    inp = (
        "平方完成を用いる。\n"
        "[\n"
        "\\begin{aligned}\n"
        "f(x) &= x^2 - 8x + 7 \\\\\n"
        "     &= (x-4)^2 - 9\n"
        "\\end{aligned}\n"
        "]\n"
    )
    out = _convert_bracket_math_blocks(inp)
    assert '\\[' in out, f"Expected \\\\[ in output but got: {out!r}"
    assert '\\]' in out, f"Expected \\\\] in output but got: {out!r}"
    # original bare [ ] should be gone
    lines = out.splitlines()
    for line in lines:
        s = line.strip()
        if s == '[' or s == ']':
            raise AssertionError(f"Bare bracket line remains: {line!r}")


def test_bare_bracket_simple_eq():
    """[ f(x) = (x-4)^2 - 9 \\ge -9 ] → \\[...\\]"""
    inp = "したがって\n[ f(x) = (x-4)^2 - 9 \\ge -9 ]\n"
    out = _convert_bracket_math_blocks(inp)
    assert '\\[' in out
    assert '\\]' in out


def test_option_bracket_preserved():
    """\\documentclass[a4paper] must NOT be converted."""
    inp = "\\documentclass[a4paper,11pt]{article}\n"
    out = _convert_bracket_math_blocks(inp)
    assert out == inp, f"Option bracket was incorrectly converted: {out!r}"


def test_usepackage_option_preserved():
    """\\usepackage[margin=18mm]{geometry} must NOT be converted."""
    inp = "\\usepackage[margin=18mm]{geometry}\n"
    out = _convert_bracket_math_blocks(inp)
    assert out == inp, f"Option bracket was incorrectly converted: {out!r}"


def test_setlist_option_preserved():
    """\\setlist[enumerate]{itemsep=10pt} must NOT be converted."""
    inp = "\\setlist[enumerate]{itemsep=10pt}\n"
    out = _convert_bracket_math_blocks(inp)
    assert out == inp


def test_empty_bracket_preserved():
    """Empty brackets [] should not be touched."""
    inp = "some text [] here\n"
    out = _convert_bracket_math_blocks(inp)
    assert out == inp


def test_inline_math_interval_does_not_block_display_math():
    """$[0,\\infty)$ followed by display-math [ ... ] must convert the display block.

    Previously the regex matched from the [ inside $[0,\\infty)$ all the way
    to the display-math ], and the inner $ caused it to be skipped entirely.
    """
    inp = (
        "$[0,\\infty)$ での最大値を調べる。\n"
        "[\n"
        "f'(x)=\\frac{d}{dx}\\left(x^{2}e^{-x}\\right)=e^{-x}x(2-x)\n"
        "]\n"
        "よって $x=2$ で最大。\n"
    )
    out = _convert_bracket_math_blocks(inp)
    # The $[0,\infty)$ must be preserved intact
    assert "$[0,\\infty)$" in out, f"Inline math was corrupted: {out!r}"
    # The display math must be converted
    assert '\\[' in out, f"Display math was not converted: {out!r}"
    assert '\\]' in out, f"Display math was not converted: {out!r}"


def test_tcolorbox_title_option_preserved():
    """\\begin{answerbox}[title=問題 1 の解答] must not be converted."""
    inp = "\\begin{answerbox}[title=問題 1 の解答]\n"
    out = _convert_bracket_math_blocks(inp)
    assert out == inp, f"tcolorbox option was corrupted: {out!r}"


def test_multiple_display_math_blocks_with_inline_intervals():
    """Multiple display math blocks in a document with inline $[a,b]$ intervals."""
    inp = (
        "$[0,\\infty)$ で考える。\n"
        "[\n"
        "f(2)=4e^{-2}\n"
        "]\n"
        "接線は\n"
        "[\n"
        "y=4e^{-2}\n"
        "]\n"
    )
    out = _convert_bracket_math_blocks(inp)
    assert out.count('\\[') == 2, f"Expected 2 \\\\[ but got {out.count(chr(92)+'[')}: {out!r}"
    assert out.count('\\]') == 2, f"Expected 2 \\\\] but got {out.count(chr(92)+']')}: {out!r}"
    assert "$[0,\\infty)$" in out


if __name__ == '__main__':
    test_bare_bracket_aligned()
    test_bare_bracket_simple_eq()
    test_option_bracket_preserved()
    test_usepackage_option_preserved()
    test_setlist_option_preserved()
    test_empty_bracket_preserved()
    test_inline_math_interval_does_not_block_display_math()
    test_tcolorbox_title_option_preserved()
    test_multiple_display_math_blocks_with_inline_intervals()
    print("All tests passed!")
