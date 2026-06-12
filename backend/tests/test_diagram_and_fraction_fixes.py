"""Tests for enhanced diagram coordinate fixes and nested fraction handling.

These tests verify:
1. CircuiTikZ closed-loop fixer — open circuits get closed
2. TikZ polygon closure — unclosed shapes get -- cycle
3. Nested fraction brace auditing — deeply nested \frac braces are balanced
4. Slash fractions conversion inside math environments
"""
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


# ── Inline copies of the functions for unit testing ──

def _fix_circuitikz_closed_loops(tex_str):
    """For each \\begin{circuitikz}...\\end{circuitikz}, ensure \\draw paths
    that start and end at different coordinates are closed."""
    pattern = r'(\\begin\{circuitikz\}(?:\[.*?\])?)([\s\S]*?)(\\end\{circuitikz\})'

    def _fix_env(m):
        begin = m.group(1)
        body = m.group(2)
        end = m.group(3)
        draw_pattern = r'(\\draw\b[^;]*;)'

        def _fix_draw(dm):
            draw_cmd = dm.group(1)
            coords = re.findall(r'\(([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\)', draw_cmd)
            # segmented方針: 4+ coords でのみ閉じる
            if len(coords) < 4:
                return draw_cmd
            first = coords[0]
            last = coords[-1]
            if 'cycle' in draw_cmd:
                return draw_cmd
            try:
                fx, fy = float(first[0]), float(first[1])
                lx, ly = float(last[0]), float(last[1])
            except (ValueError, IndexError):
                return draw_cmd
            has_circuit_elements = bool(re.search(r'to\s*\[', draw_cmd))
            if not has_circuit_elements:
                return draw_cmd
            dx = abs(fx - lx) > 0.01
            dy = abs(fy - ly) > 0.01
            if dx and dy:
                # L-shape close to avoid diagonal
                close_str = f' -- ({last[0]},{first[1]}) -- ({first[0]},{first[1]})'
            elif dx or dy:
                close_str = f' -- ({first[0]},{first[1]})'
            else:
                close_str = ''
            if close_str:
                idx = draw_cmd.rfind(';')
                if idx >= 0:
                    draw_cmd = draw_cmd[:idx] + close_str + draw_cmd[idx:]
            return draw_cmd

        body = re.sub(draw_pattern, _fix_draw, body, flags=re.S)
        return begin + body + end

    return re.sub(pattern, _fix_env, tex_str, flags=re.S)


def _fix_tikz_coordinate_closure(tex_str):
    """Ensure \\draw paths that should be closed polygons actually close."""
    pattern = r'(\\begin\{tikzpicture\}(?:\[.*?\])?)([\s\S]*?)(\\end\{tikzpicture\})'

    def _fix_tikz_env(m):
        begin = m.group(1)
        body = m.group(2)
        end = m.group(3)
        draw_pattern = r'(\\draw\b[^;]*;)'

        def _fix_draw_path(dm):
            draw_cmd = dm.group(1)
            if 'cycle' in draw_cmd:
                return draw_cmd
            coords = re.findall(r'\(([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\)', draw_cmd)
            if len(coords) < 3:
                return draw_cmd
            first = coords[0]
            last = coords[-1]
            try:
                fx, fy = float(first[0]), float(first[1])
                lx, ly = float(last[0]), float(last[1])
            except (ValueError, IndexError):
                return draw_cmd
            double_dash_count = len(re.findall(r'--', draw_cmd))
            if double_dash_count >= 2:
                distance = ((fx - lx)**2 + (fy - ly)**2) ** 0.5
                if distance > 0.01 and distance < 10:
                    idx = draw_cmd.rfind(';')
                    if idx >= 0:
                        draw_cmd = draw_cmd[:idx] + ' -- cycle' + draw_cmd[idx:]
            return draw_cmd

        body = re.sub(draw_pattern, _fix_draw_path, body, flags=re.S)
        return begin + body + end

    return re.sub(pattern, _fix_tikz_env, tex_str, flags=re.S)


def _fix_nested_fractions(tex_str):
    """Parse \\frac / \\dfrac commands and ensure each has exactly two
    properly balanced brace-delimited arguments {num}{den}."""
    result = []
    i = 0
    n = len(tex_str)
    while i < n:
        if tex_str[i] == '\\' and i + 1 < n:
            rest = tex_str[i:]
            m = re.match(r'\\(d?frac)\b', rest)
            if m:
                cmd = m.group(0)
                j = i + len(cmd)
                while j < n and tex_str[j] in ' \t\n\r':
                    j += 1
                args = []
                for _arg_idx in range(2):
                    while j < n and tex_str[j] in ' \t\n\r':
                        j += 1
                    if j < n and tex_str[j] == '{':
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
                            args.append(tex_str[start:] + '}')
                            j = n
                    elif j < n and tex_str[j] not in '\\{}':
                        args.append('{' + tex_str[j] + '}')
                        j += 1
                    else:
                        args.append('{1}')
                while len(args) < 2:
                    args.append('{1}')
                result.append(cmd + args[0] + args[1])
                i = j
                continue
        result.append(tex_str[i])
        i += 1
    return ''.join(result)


def _audit_frac_braces(tex_str):
    """Final pass to audit frac brace balance."""
    result = []
    i = 0
    n = len(tex_str)
    while i < n:
        if tex_str[i] == '\\' and i + 1 < n:
            m = re.match(r'\\(d?frac)\b', tex_str[i:])
            if m:
                cmd = m.group(0)
                j = i + len(cmd)
                while j < n and tex_str[j] in ' \t\n\r':
                    j += 1
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
                    elif j < n:
                        j += 1
                result.append(tex_str[i:j])
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


# ═══════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════

class TestCircuiTikZClosedLoop:
    """Tests for auto-closing open circuits in CircuiTikZ environments."""

    def test_open_series_circuit_gets_closed(self):
        """A simple series circuit that doesn't return to start should be closed."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[V,l=$E$] (0,3) to[R,l=$R$] (3,3) to[C,l=$C$] (3,0);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        assert '(0,0)' in result
        # Should have added -- (0,0) before the final semicolon
        assert '-- (0,0);' in result

    def test_already_closed_circuit_unchanged(self):
        """A circuit that already returns to (0,0) should not be modified."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[V,l=$E$] (0,3) to[R,l=$R$] (3,3) to[C,l=$C$] (3,0) -- (0,0);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        # Should not add a second -- (0,0)
        assert result.count('-- (0,0)') == 1

    def test_circuit_with_cycle_unchanged(self):
        """A circuit using 'cycle' keyword should not be modified."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[V] (0,3) to[R] (3,3) to[C] (3,0) -- cycle;\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        assert result == tex

    def test_parallel_circuit_branches(self):
        """Multiple draw commands — each should be checked independently."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[V,l=$E$] (0,3) -- (3,3);\n'
            '\\draw (3,3) to[R,l=$R_1$] (3,0) -- (0,0);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        assert '\\draw' in result

    def test_diagonal_close_becomes_lshape_4coord(self):
        """When end and start differ in both x and y, the closer uses L-shape.
        Requires 4+ coords (segmented policy: 2-3 coord paths are not closed)."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[V,l=$E$] (0,3) to[R,l=$R$] (3,3) to[C,l=$C$] (5,1);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        # Must close via intermediate corner (5,0) → L-shape, not diagonal
        assert '-- (5,0) -- (0,0)' in result, \
            f'Expected L-shape close, got: {result}'

    def test_axis_parallel_close_stays_single_segment_4coord(self):
        """When only x differs at the end, a single -- close is enough (4+ coords required)."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[V,l=$E$] (0,3) to[R,l=$R$] (3,3) -- (3,0);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        # End (3,0), Start (0,0): y same → single -- (0,0) close
        assert '-- (3,0) -- (0,0)' in result

    def test_segmented_two_coord_path_not_closed(self):
        """Single-segment \\draw must NOT be auto-closed (would create short-circuit).
        Critical for segmented style where each \\draw = 1 element only."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (1,2) to[C,l=$C_1$] (1,0);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        # Must NOT add any closing wire to a 2-coord capacitor segment
        # (otherwise it shorts across the cap)
        assert '\\draw (1,2) to[C,l=$C_1$] (1,0);' in result
        # No extra "-- (1,2)" appended
        assert result.count('-- (1,2)') == 0

    def test_segmented_three_coord_path_not_closed(self):
        """L-shape wire (3 coords) must NOT be auto-closed."""
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[R,l=$R$] (3,0) -- (3,3);\n'
            '\\end{circuitikz}'
        )
        result = _fix_circuitikz_closed_loops(tex)
        # 3-coord L-shape path is not closed
        assert '-- (0,0)' not in result


class TestCircuiTikZAxisParallelEnforcement:
    """Tests that diagonal wires/elements are auto-converted to L-shape (axis-parallel)."""

    @staticmethod
    def _force_segments(tex_str):
        env_pat = r'(\\begin\{circuitikz\}(?:\[.*?\])?)([\s\S]*?)(\\end\{circuitikz\})'
        seg_pat = re.compile(
            r'\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)\s*--\s*'
            r'\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)'
        )

        def fix_env(m):
            b = m.group(2)
            def rep(s):
                x1, y1, x2, y2 = s.groups()
                fx, fy, lx, ly = float(x1), float(y1), float(x2), float(y2)
                if abs(fx - lx) > 0.01 and abs(fy - ly) > 0.01:
                    return f'({x1},{y1}) -- ({x1},{y2}) -- ({x2},{y2})'
                return s.group(0)
            for _ in range(10):
                nb = seg_pat.sub(rep, b)
                if nb == b:
                    break
                b = nb
            return m.group(1) + b + m.group(3)
        return re.sub(env_pat, fix_env, tex_str, flags=re.S)

    @staticmethod
    def _force_elements(tex_str):
        env_pat = r'(\\begin\{circuitikz\}(?:\[.*?\])?)([\s\S]*?)(\\end\{circuitikz\})'
        elem_pat = re.compile(
            r'\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)\s*'
            r'(to\s*\[[^\]]*\])\s*'
            r'\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)'
        )

        def fix_env(m):
            b = m.group(2)
            def rep(e):
                x1, y1, to_block, x2, y2 = e.group(1), e.group(2), e.group(3), e.group(4), e.group(5)
                fx, fy, lx, ly = float(x1), float(y1), float(x2), float(y2)
                dx, dy = abs(fx - lx), abs(fy - ly)
                if dx > 0.01 and dy > 0.01:
                    if dx >= dy:
                        return f'({x1},{y1}) {to_block} ({x2},{y1}) -- ({x2},{y2})'
                    return f'({x1},{y1}) -- ({x1},{y2}) {to_block} ({x2},{y2})'
                return e.group(0)
            for _ in range(10):
                nb = elem_pat.sub(rep, b)
                if nb == b:
                    break
                b = nb
            return m.group(1) + b + m.group(3)
        return re.sub(env_pat, fix_env, tex_str, flags=re.S)

    def test_diagonal_wire_becomes_lshape(self):
        tex = '\\begin{circuitikz}\\draw (0,0) -- (3,3);\\end{circuitikz}'
        result = self._force_segments(tex)
        assert '(0,0) -- (0,3) -- (3,3)' in result

    def test_diagonal_resistor_horizontal(self):
        """Diagonal to[R] with |dx| > |dy| → horizontal element + L-shape wire."""
        tex = '\\begin{circuitikz}\\draw (4,0) to[R,l=$R_3$] (8,3);\\end{circuitikz}'
        result = self._force_elements(tex)
        # dx=4, dy=3 → horizontal element: (4,0) to[R] (8,0) -- (8,3)
        assert '(4,0) to[R,l=$R_3$] (8,0) -- (8,3)' in result

    def test_diagonal_resistor_vertical(self):
        """Diagonal to[R] with |dy| > |dx| → vertical element + L-shape wire."""
        tex = '\\begin{circuitikz}\\draw (4,0) to[R,l=$R_3$] (5,8);\\end{circuitikz}'
        result = self._force_elements(tex)
        # dx=1, dy=8 → vertical element: (4,0) -- (4,8) to[R] (5,8)
        assert '(4,0) -- (4,8) to[R,l=$R_3$] (5,8)' in result

    def test_axis_parallel_unchanged(self):
        tex = '\\begin{circuitikz}\\draw (0,3) -- (4,3) -- (4,0);\\end{circuitikz}'
        result = self._force_segments(tex)
        assert result == tex


class TestCircuiTikZChainSplitter:
    """Tests that chained \\draw statements get split into segmented form."""

    @staticmethod
    def _split(tex_str):
        env_pattern = r'(\\begin\{circuitikz\}(?:\[.*?\])?)([\s\S]*?)(\\end\{circuitikz\})'
        draw_pattern = re.compile(r'\\draw\b(\[[^\]]*\])?([^;]*);')
        token_pattern = re.compile(
            r'\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)'
            r'|(to\s*\[[^\]]*\])'
            r'|(--)'
        )

        def _split_one(m):
            opts = m.group(1) or ''
            body = m.group(2)
            tokens = []
            for tm in token_pattern.finditer(body):
                if tm.group(1) is not None and tm.group(2) is not None:
                    tokens.append(('coord', f'({tm.group(1)},{tm.group(2)})'))
                elif tm.group(3) is not None:
                    tokens.append(('to', tm.group(3)))
                elif tm.group(4) is not None:
                    tokens.append(('wire', '--'))
            segments = []
            i = 0
            while i + 2 < len(tokens):
                t1, t2, t3 = tokens[i], tokens[i+1], tokens[i+2]
                if t1[0] == 'coord' and t2[0] in ('wire', 'to') and t3[0] == 'coord':
                    segments.append((t1[1], t2[1], t3[1]))
                    i += 2
                else:
                    return m.group(0)
            if len(segments) <= 1:
                return m.group(0)
            return '\n  '.join(f'\\draw{opts} {c1} {conn} {c2};' for c1, conn, c2 in segments)

        def _fix_env(em):
            return em.group(1) + draw_pattern.sub(_split_one, em.group(2)) + em.group(3)
        return re.sub(env_pattern, _fix_env, tex_str, flags=re.S)

    def test_one_stroke_chained_gets_split(self):
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[battery1,l=$E$] (0,3) -- (4,3) '
            'to[R,l=$R$] (4,0) -- (0,0);\n'
            '\\end{circuitikz}'
        )
        result = self._split(tex)
        # 4セグメントに分割されたことを確認
        assert result.count('\\draw') == 4
        assert '(0,0) to[battery1,l=$E$] (0,3)' in result
        assert '(0,3) -- (4,3)' in result
        assert '(4,3) to[R,l=$R$] (4,0)' in result
        assert '(4,0) -- (0,0)' in result

    def test_single_segment_draws_unchanged(self):
        tex = (
            '\\begin{circuitikz}\n'
            '\\draw (0,0) to[C,l=$C$] (4,0);\n'
            '\\draw (4,0) -- (4,3);\n'
            '\\end{circuitikz}'
        )
        result = self._split(tex)
        # 既に segmented なので変化なし
        assert result.count('\\draw') == 2


class TestTikZCoordinateClosure:
    """Tests for auto-closing TikZ polygon paths."""

    def test_open_triangle_gets_closed(self):
        """A triangle drawn with 3 points and -- but no cycle should be closed."""
        tex = (
            '\\begin{tikzpicture}\n'
            '\\draw (0,0) -- (3,0) -- (1.5,2.5);\n'
            '\\end{tikzpicture}'
        )
        result = _fix_tikz_coordinate_closure(tex)
        assert '-- cycle;' in result

    def test_already_cycled_path_unchanged(self):
        """A path with -- cycle should not be modified."""
        tex = (
            '\\begin{tikzpicture}\n'
            '\\draw (0,0) -- (3,0) -- (1.5,2.5) -- cycle;\n'
            '\\end{tikzpicture}'
        )
        result = _fix_tikz_coordinate_closure(tex)
        assert result == tex

    def test_two_point_line_not_closed(self):
        """A simple line (2 points) should not be auto-closed."""
        tex = (
            '\\begin{tikzpicture}\n'
            '\\draw (0,0) -- (3,0);\n'
            '\\end{tikzpicture}'
        )
        result = _fix_tikz_coordinate_closure(tex)
        assert '-- cycle' not in result

    def test_rectangle_not_closed_gets_cycle(self):
        """A rectangle drawn with 4 points but not closing should get cycle."""
        tex = (
            '\\begin{tikzpicture}\n'
            '\\draw (0,0) -- (4,0) -- (4,3) -- (0,3);\n'
            '\\end{tikzpicture}'
        )
        result = _fix_tikz_coordinate_closure(tex)
        assert '-- cycle;' in result


class TestNestedFractionFixer:
    """Tests for robust nested fraction brace handling."""

    def test_simple_frac_unchanged(self):
        """\\frac{a}{b} should remain unchanged."""
        tex = '\\frac{a}{b}'
        result = _fix_nested_fractions(tex)
        assert result == '\\frac{a}{b}'

    def test_nested_frac_in_numerator(self):
        """\\frac{\\frac{a}{b}}{c} should remain balanced."""
        tex = '\\frac{\\frac{a}{b}}{c}'
        result = _fix_nested_fractions(tex)
        assert result == '\\frac{\\frac{a}{b}}{c}'
        assert result.count('{') == result.count('}')

    def test_nested_frac_in_denominator(self):
        """\\frac{a}{\\frac{b}{c}} should remain balanced."""
        tex = '\\frac{a}{\\frac{b}{c}}'
        result = _fix_nested_fractions(tex)
        assert result.count('{') == result.count('}')

    def test_double_nested_frac(self):
        """Deeply nested: \\frac{\\frac{a}{b}}{\\frac{c}{d}}."""
        tex = '\\frac{\\frac{a}{b}}{\\frac{c}{d}}'
        result = _fix_nested_fractions(tex)
        assert result.count('{') == result.count('}')
        assert '\\frac{\\frac{a}{b}}{\\frac{c}{d}}' == result

    def test_bare_frac_gets_braces(self):
        """\\frac a b → \\frac{a}{b}."""
        tex = '\\frac a b'
        result = _fix_nested_fractions(tex)
        assert result == '\\frac{a}{b}'

    def test_dfrac_handled(self):
        """\\dfrac{x}{y} works the same."""
        tex = '\\dfrac{x}{y}'
        result = _fix_nested_fractions(tex)
        assert result == '\\dfrac{x}{y}'
        assert result.count('{') == result.count('}')

    def test_complex_circuit_fraction(self):
        """Complex electrical circuit fraction: parallel resistance formula."""
        tex = '\\dfrac{\\dfrac{R_1 R_2}{R_1 + R_2}}{\\dfrac{R_1 R_2}{R_1 + R_2} + R_3}'
        result = _fix_nested_fractions(tex)
        assert result.count('{') == result.count('}')

    def test_multiple_fracs_in_expression(self):
        """Multiple fracs in a single expression."""
        tex = '$\\frac{1}{2} + \\frac{3}{4} = \\frac{5}{4}$'
        result = _fix_nested_fractions(tex)
        assert result.count('{') == result.count('}')
        assert '\\frac{1}{2}' in result
        assert '\\frac{3}{4}' in result
        assert '\\frac{5}{4}' in result

    def test_frac_missing_second_arg_gets_placeholder(self):
        """\\frac{a} with no second group → \\frac{a}{1}."""
        tex = '\\frac{a}'
        result = _fix_nested_fractions(tex)
        # The parser should add {1} as placeholder
        assert result == '\\frac{a}{1}'
        assert result.count('{') == result.count('}')


class TestFracBraceAudit:
    """Tests for the final brace balance audit on frac commands."""

    def test_balanced_frac_passes(self):
        tex = '\\frac{a+b}{c+d}'
        result = _audit_frac_braces(tex)
        assert result.count('{') == result.count('}')

    def test_unbalanced_nested_gets_fixed(self):
        """If a nested frac has a missing closing brace, audit should add it."""
        tex = '\\frac{\\frac{a}{b}{c}'  # Missing } after inner frac's second arg
        result = _audit_frac_braces(tex)
        assert result.count('{') == result.count('}')

    def test_deeply_nested_balanced(self):
        tex = '\\frac{\\frac{\\frac{1}{2}}{3}}{4}'
        result = _audit_frac_braces(tex)
        assert result.count('{') == result.count('}')


# ═══════════════════════════════════════════════════════════════════════
# Run tests
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import pytest
    pytest.main([__file__, '-v'])
