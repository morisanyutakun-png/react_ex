"""Practice mode: bare bracket display math → \\[...\\] 変換テスト。

LLM が \\[...\\] の代わりに [...] で display math を出力するケースに対応。
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import _parse_latex_problems, _sanitize_practice_text


def test_bare_bracket_multiline():
    """複数行 display math: 行頭の [ と行末の ] → \\[...\\]"""
    text = (
        "運動方程式より\n"
        "[\n"
        "ma = mg\\sin\\theta - \\mu mg\\cos\\theta\n"
        "]\n"
        "したがって"
    )
    result = _sanitize_practice_text(text)
    assert '\\[' in result, f"Expected \\[ in result, got: {result}"
    assert '\\]' in result, f"Expected \\] in result, got: {result}"
    assert '[' not in result.replace('\\[', '').replace('\\]', '').replace('[', ''), \
        "Bare [ should not remain"


def test_bare_bracket_singleline():
    """単一行 display math: [math content] → \\[math content\\]"""
    text = "[v = \\sqrt{2gh} = 9.9\\,\\mathrm{m/s}]"
    result = _sanitize_practice_text(text)
    assert '\\[' in result, f"Expected \\[ in: {result}"
    assert '\\]' in result, f"Expected \\] in: {result}"


def test_already_escaped_brackets():
    """既に \\[...\\] なら変換しない"""
    text = "\\[a = g\\sin\\theta\\]"
    result = _sanitize_practice_text(text)
    assert result.count('\\[') == 1
    assert result.count('\\]') == 1


def test_non_math_brackets_preserved():
    """数学コンテンツでない [...] はそのまま"""
    text = "[注意: ここは重要]"
    result = _sanitize_practice_text(text)
    # 数学インジケータが無いので変換されない
    assert result == text


def test_real_llm_answer_block():
    """実際のLLM出力の answer ブロック"""
    text = (
        "[\n"
        "a = g(\\sin\\theta - \\mu\\cos\\theta)\n"
        "= 9.8\\left(\\frac{1}{2}-0.20\\times\\frac{\\sqrt{3}}{2}\\right)\n"
        "\\approx 3.2\\,\\mathrm{m/s^2}\n"
        "]"
    )
    result = _sanitize_practice_text(text)
    assert '\\[' in result, f"Expected \\[ in: {result}"
    assert '\\]' in result, f"Expected \\] in: {result}"
    # 数式内容はそのまま
    assert '\\sin\\theta' in result
    assert '\\frac{1}{2}' in result


def test_real_llm_explanation_block():
    """実際のLLM出力の explanation ブロック（複数の display math）"""
    text = (
        "斜面方向の力を考える。重力の斜面方向成分は $mg\\sin\\theta$、法線力は $N=mg\\cos\\theta$ である。\n"
        "\n"
        "運動方程式より\n"
        "[\n"
        "ma = mg\\sin\\theta - \\mu mg\\cos\\theta\n"
        "]\n"
        "\n"
        "したがって\n"
        "[\n"
        "a = g(\\sin\\theta-\\mu\\cos\\theta)\n"
        "]\n"
        "\n"
        "数値代入して\n"
        "[\n"
        "a = 9.8(0.5-0.20\\times0.866)\\approx3.2\\,\\mathrm{m/s^2}\n"
        "]"
    )
    result = _sanitize_practice_text(text)
    # 3つの display math ブロックがすべて変換されること
    assert result.count('\\[') == 3, f"Expected 3 \\[ but got {result.count(chr(92) + '[')}: {result}"
    assert result.count('\\]') == 3, f"Expected 3 \\] but got {result.count(chr(92) + ']')}: {result}"
    # 地の文はそのまま
    assert '斜面方向の力を考える' in result


def test_full_parse_and_sanitize():
    """パーサー → サニタイザーの統合テスト"""
    llm_output = """%%% PROBLEM 1 %%%
%%% TOPIC: 力学 %%%
%%% STEM %%%
質量 $m$ の物体が斜面を滑る。
%%% SUBPROBLEM (1) %%%
加速度を求めよ。
%%% ANSWER (1) %%%
[
a = g\\sin\\theta
]
%%% EXPLANATION (1) %%%
運動方程式より
[
ma = mg\\sin\\theta
]
したがって $a = g\\sin\\theta$
%%% END PROBLEM 1 %%%"""

    problems = _parse_latex_problems(llm_output)
    assert len(problems) == 1
    sp = problems[0]['subproblems'][0]

    # answer のサニタイズ
    answer = _sanitize_practice_text(sp['answer'])
    assert '\\[' in answer and '\\]' in answer, f"Answer not converted: {answer}"

    # explanation のサニタイズ
    explanation = _sanitize_practice_text(sp['explanation'])
    assert '\\[' in explanation and '\\]' in explanation, f"Explanation not converted: {explanation}"


if __name__ == '__main__':
    test_bare_bracket_multiline()
    test_bare_bracket_singleline()
    test_already_escaped_brackets()
    test_non_math_brackets_preserved()
    test_real_llm_answer_block()
    test_real_llm_explanation_block()
    test_full_parse_and_sanitize()
    print('All bracket math tests passed!')
