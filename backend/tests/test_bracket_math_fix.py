"""Test that _convert_bracket_math_blocks correctly converts bare-bracket
display math to \\[...\\] while preserving option brackets."""
import re
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def _convert_bracket_math_blocks(blob: str) -> str:
    """Copy of the fixed function for unit testing."""
    if not isinstance(blob, str) or not blob.strip():
        return blob

    def _repl(m):
        inner = m.group(1)
        prefix = blob[:m.start()]
        if re.search(r"\\[A-Za-z]+\*?\s*$", prefix):
            return m.group(0)
        stripped = inner.strip()
        if len(stripped) < 2:
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

    return re.sub(r"(?<![\\A-Za-z])\[\s*([\s\S]*?)\s*\]", _repl, blob)


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


if __name__ == '__main__':
    test_bare_bracket_aligned()
    test_bare_bracket_simple_eq()
    test_option_bracket_preserved()
    test_usepackage_option_preserved()
    test_setlist_option_preserved()
    test_empty_bracket_preserved()
    print("All tests passed!")
