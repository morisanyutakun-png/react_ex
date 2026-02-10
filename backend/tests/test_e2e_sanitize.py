"""End-to-end test: apply the backend sanitizers to the original (broken) LLM
output and verify that the result compiles with xelatex."""
import re, os, sys, subprocess, tempfile, shutil

# Read the original broken LaTeX
HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'fixture_original.tex'), 'r', encoding='utf-8') as f:
    original = f.read()

print("=== ORIGINAL (first 300 chars) ===")
print(original[:300])
print("...")

# ── Inline copies of the sanitizers (matching backend/main.py) ──

def _normalize_latex_linebreaks(blob):
    if not isinstance(blob, str) or not blob.strip():
        return blob
    return re.sub(r"(?m)(?<!\\)\\\s*$", r"\\\\", blob)

def _convert_bracket_math_blocks(blob):
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

def _unescape_latex(latex):
    if not latex or not isinstance(latex, str):
        return latex
    s = latex
    if '\\r\\n' in s or '\\n' in s:
        s = s.replace('\\r\\n', '\n')
        s = s.replace('\\n', '\n')
    s = re.sub(r"\\\\([a-zA-Z@]+)", r"\\\1", s)
    if '\t' in s:
        s = s.replace('\t', ' ')
    return s

def _collapse_internal_newlines(latex):
    if not latex or not isinstance(latex, str):
        return latex
    s = latex.replace('\r\n', '\n')
    try:
        s = re.sub(r"\$(.*?)\$", lambda m: '$' + m.group(1).replace('\n', ' ') + '$', s, flags=re.S)
    except Exception:
        pass
    s = re.sub(r"\^\s*\n\s*", "^", s)
    s = re.sub(r"\n\s*\^", "^", s)
    s = re.sub(r"\\\s*\n\s*([a-zA-Z@]+)", r"\\\1", s)
    return s

def _sanitize_fontspec_fonts(blob):
    if not isinstance(blob, str) or not blob.strip():
        return blob
    def _wrap_font(cmd, font):
        return f"\\IfFontExistsTF{{{font}}}{{\\{cmd}{{{font}}}}}{{}}"
    for cmd in ('setCJKmainfont', 'setCJKsansfont', 'setCJKmonofont'):
        # Skip if already wrapped (preceded by }{ from IfFontExistsTF)
        pattern = rf"(?<!}})\\{cmd}\{{([^}}]+)\}}"
        blob = re.sub(pattern, lambda m: _wrap_font(cmd, m.group(1)), blob)
    return blob


# ── Apply sanitizers in the same order as the backend ──
tex = original
tex = _unescape_latex(tex)
tex = _sanitize_fontspec_fonts(tex)
tex = _convert_bracket_math_blocks(tex)
tex = _collapse_internal_newlines(tex)
tex = _normalize_latex_linebreaks(tex)

# Ensure \end{document}
if '\\end{document}' not in tex:
    tex = tex.rstrip() + '\n\\end{document}\n'

print("\n=== SANITIZED (first 600 chars) ===")
print(tex[:600])
print("...")

# ── Check specific fixes ──
problems = []

# 1. No bare bracket display math remaining
for i, line in enumerate(tex.splitlines(), 1):
    s = line.strip()
    # A line that is just "[" or "]" with no backslash is suspicious
    if s == '[' or s == ']':
        # Check it's not part of \[ or \]
        if not line.strip().startswith('\\'):
            problems.append(f"Line {i}: bare bracket remains: {line!r}")

# 2. No single-backslash line endings (should be \\)
for i, line in enumerate(tex.splitlines(), 1):
    stripped = line.rstrip()
    if stripped.endswith('\\') and not stripped.endswith('\\\\'):
        # Allow \begin, \end, etc. at line end
        if not re.search(r'\\[A-Za-z]+$', stripped):
            problems.append(f"Line {i}: single backslash at EOL: {line!r}")

if problems:
    print("\n=== PROBLEMS FOUND ===")
    for p in problems:
        print(f"  ✗ {p}")
else:
    print("\n=== No obvious structural problems found ===")

# ── Try xelatex compilation if available ──
xelatex = shutil.which('xelatex')
if not xelatex:
    print("\nxelatex not found — skipping compilation test")
    print("Sanitized .tex written for manual inspection.")
else:
    td = tempfile.mkdtemp(prefix='test_sanitize_')
    tex_path = os.path.join(td, 'document.tex')
    with open(tex_path, 'w', encoding='utf-8') as f:
        f.write(tex)
    print(f"\n=== Compiling with xelatex in {td} ===")
    result = subprocess.run(
        [xelatex, '-interaction=nonstopmode', '-halt-on-error', '-output-directory', td, tex_path],
        capture_output=True, text=True, timeout=60
    )
    print("Return code:", result.returncode)
    if result.returncode != 0:
        # Show last 40 lines of stdout for error context
        lines = result.stdout.splitlines()
        print("\n--- Last 40 lines of xelatex output ---")
        for l in lines[-40:]:
            print(l)
    else:
        pdf = os.path.join(td, 'document.pdf')
        if os.path.exists(pdf):
            sz = os.path.getsize(pdf)
            print(f"✓ PDF generated successfully: {pdf} ({sz} bytes)")
        else:
            print("✗ xelatex returned 0 but no PDF found")
    # cleanup
    shutil.rmtree(td, ignore_errors=True)
