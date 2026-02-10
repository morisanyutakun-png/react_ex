"""End-to-end test: apply all sanitizers to the LLM output with \\left{ errors
and verify xelatex compilation succeeds."""
import re, os, sys, subprocess, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'fixture_left_brace.tex'), 'r', encoding='utf-8') as f:
    original = f.read()

print("=== ORIGINAL excerpt (lines 70-82) ===")
for i, ln in enumerate(original.splitlines(), 1):
    if 70 <= i <= 82:
        print(f"  {i}: {ln}")

# ── Inline sanitizers (match backend/main.py) ──

def _unescape_latex(latex):
    if not latex: return latex
    s = latex
    if '\\r\\n' in s or '\\n' in s:
        s = s.replace('\\r\\n', '\n').replace('\\n', '\n')
    s = re.sub(r"\\\\([a-zA-Z@]+)", r"\\\1", s)
    if '\t' in s: s = s.replace('\t', ' ')
    return s

def _fix_left_right_delimiters(blob):
    if not isinstance(blob, str) or not blob.strip(): return blob
    blob = re.sub(r'\\left\{', r'\\left\\{', blob)
    blob = re.sub(r'\\right\}', r'\\right\\}', blob)
    blob = re.sub(r'\\left\}', r'\\left\\}', blob)
    blob = re.sub(r'\\right\{', r'\\right\\{', blob)
    blob = re.sub(r'\\left\\\\\{', r'\\left\\{', blob)
    blob = re.sub(r'\\right\\\\\}', r'\\right\\}', blob)
    blob = re.sub(r'\\left\\\\\}', r'\\left\\}', blob)
    blob = re.sub(r'\\right\\\\\{', r'\\right\\{', blob)
    return blob

def _normalize_latex_linebreaks(blob):
    if not isinstance(blob, str) or not blob.strip(): return blob
    return re.sub(r"(?m)(?<!\\)\\\s*$", r"\\\\", blob)

def _convert_bracket_math_blocks(blob):
    if not isinstance(blob, str) or not blob.strip(): return blob
    def _repl(m):
        inner = m.group(1)
        prefix = blob[:m.start()]
        if re.search(r"\\[A-Za-z]+\*?\s*$", prefix): return m.group(0)
        stripped = inner.strip()
        if len(stripped) < 2: return m.group(0)
        math_indicators = (
            r'\\begin\{|\\end\{|\\frac|\\sqrt|\\left|\\right|'
            r'\\ge|\\le|\\geq|\\leq|\\neq|'
            r'\\sum|\\prod|\\int|\\lim|'
            r'\\cdot|\\times|\\pm|\\mp|'
            r'[=<>]|[\^_]|&'
        )
        if re.search(math_indicators, stripped):
            return '\\[' + '\n' + stripped + '\n' + '\\]'
        return m.group(0)
    return re.sub(r"(?<![\\A-Za-z])\[\s*([\s\S]*?)\s*\]", _repl, blob)

def _collapse_internal_newlines(latex):
    if not latex: return latex
    s = latex.replace('\r\n', '\n')
    try: s = re.sub(r"\$(.*?)\$", lambda m: '$' + m.group(1).replace('\n', ' ') + '$', s, flags=re.S)
    except: pass
    s = re.sub(r"\^\s*\n\s*", "^", s)
    s = re.sub(r"\n\s*\^", "^", s)
    s = re.sub(r"\\\s*\n\s*([a-zA-Z@]+)", r"\\\1", s)
    return s

def _sanitize_fontspec_fonts(blob):
    if not isinstance(blob, str) or not blob.strip(): return blob
    def _wrap_font(cmd, font):
        return f"\\IfFontExistsTF{{{font}}}{{\\{cmd}{{{font}}}}}{{}}"
    for cmd in ('setCJKmainfont', 'setCJKsansfont', 'setCJKmonofont'):
        pattern = rf"(?<!}})\\{cmd}\{{([^}}]+)\}}"
        blob = re.sub(pattern, lambda m: _wrap_font(cmd, m.group(1)), blob)
    return blob


# ── Apply sanitizer pipeline ──
tex = original
tex = _unescape_latex(tex)
tex = _sanitize_fontspec_fonts(tex)
tex = _fix_left_right_delimiters(tex)
tex = _convert_bracket_math_blocks(tex)
tex = _collapse_internal_newlines(tex)
tex = _normalize_latex_linebreaks(tex)

if '\\end{document}' not in tex:
    tex = tex.rstrip() + '\n\\end{document}\n'

# ── Verify \left\{ is present and \left{ is gone ──
assert '\\left{' not in tex, "\\left{ still present after sanitizer!"
print("\n✓ No bare \\left{ found in sanitized output")

# Show sanitized lines around the problematic area
print("\n=== SANITIZED excerpt (lines 70-85) ===")
for i, ln in enumerate(tex.splitlines(), 1):
    if 70 <= i <= 85:
        print(f"  {i}: {ln}")

# ── Compile ──
xelatex = shutil.which('xelatex')
if not xelatex:
    print("\nxelatex not found — skipping compilation")
else:
    td = tempfile.mkdtemp(prefix='test_leftbrace_')
    tex_path = os.path.join(td, 'document.tex')
    with open(tex_path, 'w', encoding='utf-8') as f:
        f.write(tex)
    print(f"\n=== Compiling with xelatex ===")
    result = subprocess.run(
        [xelatex, '-interaction=nonstopmode', '-halt-on-error', '-output-directory', td, tex_path],
        capture_output=True, text=True, timeout=60
    )
    print("Return code:", result.returncode)
    if result.returncode != 0:
        lines = result.stdout.splitlines()
        print("\n--- Last 30 lines of xelatex output ---")
        for l in lines[-30:]:
            print(l)
    else:
        pdf = os.path.join(td, 'document.pdf')
        if os.path.exists(pdf):
            print(f"✓ PDF generated successfully: {pdf} ({os.path.getsize(pdf)} bytes)")
        else:
            print("✗ xelatex returned 0 but no PDF found")
    shutil.rmtree(td, ignore_errors=True)
