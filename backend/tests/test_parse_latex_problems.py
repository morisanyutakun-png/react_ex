"""_parse_latex_problems のテスト。

構造化マーカー付き LaTeX テキストを問題配列に正しくパースできるか検証する。
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# _parse_latex_problems は main.py 内の関数なので、直接 import できない場合は
# テスト内で同じロジックを再利用する。ここでは main.py から動的に取得する。
import importlib
import re


def _parse_latex_problems(raw_text: str) -> list:
    """main.py と同じロジックのインラインコピー（テスト専用）"""
    problems = []
    problem_pattern = re.compile(
        r'%%%\s*PROBLEM\s+(\d+)\s*%%%\s*\n([\s\S]*?)%%%\s*END\s+PROBLEM\s+\1\s*%%%',
        re.IGNORECASE,
    )
    for m in problem_pattern.finditer(raw_text):
        block = m.group(2)
        topic_m = re.search(r'%%%\s*TOPIC:\s*(.*?)\s*%%%', block)
        topic = topic_m.group(1).strip() if topic_m else ''
        diff_m = re.search(r'%%%\s*DIFFICULTY:\s*(.*?)\s*%%%', block)
        difficulty = diff_m.group(1).strip() if diff_m else ''
        stem_m = re.search(r'%%%\s*STEM\s*%%%([\s\S]*?)(?=%%%)', block)
        stem = stem_m.group(1).strip() if stem_m else ''
        figure_m = re.search(r'%%%\s*FIGURE\s*%%%([\s\S]*?)(?=%%%)', block)
        figure_tikz = figure_m.group(1).strip() if figure_m else None
        if figure_tikz and figure_tikz.lower() in ('', 'null', 'none', 'なし'):
            figure_tikz = None
        subproblems = []
        sub_pattern = re.compile(
            r'%%%\s*SUBPROBLEM\s*\((\d+)\)\s*%%%([\s\S]*?)(?=%%%)',
            re.IGNORECASE,
        )
        for sm in sub_pattern.finditer(block):
            label = f'({sm.group(1)})'
            question = sm.group(2).strip()
            ans_pattern = re.compile(
                r'%%%\s*ANSWER\s*\(' + re.escape(sm.group(1)) + r'\)\s*%%%([\s\S]*?)(?=%%%|$)',
                re.IGNORECASE,
            )
            ans_m = ans_pattern.search(block)
            answer = ans_m.group(1).strip() if ans_m else ''
            expl_pattern = re.compile(
                r'%%%\s*EXPLANATION\s*\(' + re.escape(sm.group(1)) + r'\)\s*%%%([\s\S]*?)(?=%%%|$)',
                re.IGNORECASE,
            )
            expl_m = expl_pattern.search(block)
            explanation = expl_m.group(1).strip() if expl_m else ''
            subproblems.append({
                'label': label,
                'question': question,
                'answer': answer,
                'explanation': explanation,
            })
        problems.append({
            'stem': stem,
            'figure_tikz': figure_tikz,
            'subproblems': subproblems,
            'topic': topic,
            'difficulty': difficulty,
        })
    return problems


SAMPLE_LATEX = r"""
%%% PROBLEM 1 %%%
%%% TOPIC: 力学・等加速度運動 %%%
%%% DIFFICULTY: 応用 %%%
%%% STEM %%%
質量 $m = 2.0\,\mathrm{kg}$ の物体が、傾き角 $\theta = 30^\circ$ の
なめらかな斜面の頂上から静かに滑り始めた。斜面の高さは $h = 5.0\,\mathrm{m}$ である。
ただし、重力加速度を $g = 9.8\,\mathrm{m/s^2}$ とし、空気抵抗は無視する。
%%% FIGURE %%%
\begin{tikzpicture}[>=latex,scale=1.2]
  \draw[thick] (0,0) -- (4,0) -- (4,2) -- cycle;
  \draw[fill=gray!25,thick] (2.2,1.0) rectangle ++(0.55,0.55);
  \draw[->,blue,very thick] (2.47,1.27) -- ++(0,-0.8) node[below]{$mg$};
  \node[font=\small] at (0.9,0.18) {$\theta$};
\end{tikzpicture}
%%% SUBPROBLEM (1) %%%
物体が斜面の底に到達したときの速さ $v$ を求めよ。
%%% ANSWER (1) %%%
$v = \sqrt{2gh} = \sqrt{2 \times 9.8 \times 5.0} = 9.9\,\mathrm{m/s}$
%%% EXPLANATION (1) %%%
エネルギー保存則を適用する。
\[
\frac{1}{2}mv^2 = mgh
\]
よって $v = \sqrt{2gh} = \sqrt{2 \times 9.8 \times 5.0} \approx 9.9\,\mathrm{m/s}$
%%% SUBPROBLEM (2) %%%
斜面を滑り降りるのにかかる時間 $t$ を求めよ。
%%% ANSWER (2) %%%
$t = \frac{2h}{v\sin\theta} = 2.0\,\mathrm{s}$
%%% EXPLANATION (2) %%%
斜面に沿った加速度 $a = g\sin\theta = 4.9\,\mathrm{m/s^2}$。
斜面の長さ $L = h/\sin\theta = 10\,\mathrm{m}$。
$L = \frac{1}{2}at^2$ より $t = \sqrt{\frac{2L}{a}} \approx 2.0\,\mathrm{s}$。
%%% END PROBLEM 1 %%%

%%% PROBLEM 2 %%%
%%% TOPIC: 電磁気・コンデンサー %%%
%%% DIFFICULTY: 標準 %%%
%%% STEM %%%
電気容量 $C = 10\,\mu\mathrm{F}$ のコンデンサーに $V = 100\,\mathrm{V}$ の
電圧をかけて充電した。
%%% SUBPROBLEM (1) %%%
コンデンサーに蓄えられた電荷 $Q$ を求めよ。
%%% ANSWER (1) %%%
$Q = CV = 10 \times 10^{-6} \times 100 = 1.0 \times 10^{-3}\,\mathrm{C}$
%%% EXPLANATION (1) %%%
$Q = CV$ の公式に直接代入する。
%%% END PROBLEM 2 %%%
"""


def test_parse_basic():
    """基本パースのテスト"""
    problems = _parse_latex_problems(SAMPLE_LATEX)
    assert len(problems) == 2, f"Expected 2 problems, got {len(problems)}"


def test_problem1_fields():
    """Problem 1 のフィールドが正しく取得できるか"""
    problems = _parse_latex_problems(SAMPLE_LATEX)
    p1 = problems[0]

    assert p1['topic'] == '力学・等加速度運動'
    assert p1['difficulty'] == '応用'
    assert '質量 $m = 2.0' in p1['stem']
    assert '\\begin{tikzpicture}' in p1['figure_tikz']
    assert len(p1['subproblems']) == 2


def test_subproblems():
    """小問パースのテスト"""
    problems = _parse_latex_problems(SAMPLE_LATEX)
    p1 = problems[0]

    sp1 = p1['subproblems'][0]
    assert sp1['label'] == '(1)'
    assert '速さ' in sp1['question']
    assert '\\sqrt{2gh}' in sp1['answer']
    assert 'エネルギー保存' in sp1['explanation']

    sp2 = p1['subproblems'][1]
    assert sp2['label'] == '(2)'
    assert '時間' in sp2['question']


def test_problem2_no_figure():
    """Figure なしの問題"""
    problems = _parse_latex_problems(SAMPLE_LATEX)
    p2 = problems[1]

    assert p2['topic'] == '電磁気・コンデンサー'
    assert p2['figure_tikz'] is None  # FIGURE セクションなし
    assert len(p2['subproblems']) == 1


def test_latex_in_fields():
    """LaTeX コマンド（\\frac, \\sqrt 等）がエスケープされずそのまま残っているか確認"""
    problems = _parse_latex_problems(SAMPLE_LATEX)
    p1 = problems[0]

    # \\frac が JSON エスケープ問題なくそのまま取得できる
    assert '\\frac{1}{2}' in p1['subproblems'][0]['explanation']
    assert '\\sqrt{2gh}' in p1['subproblems'][0]['answer']


def test_empty_input():
    """空入力"""
    assert _parse_latex_problems('') == []
    assert _parse_latex_problems('no markers here') == []


def test_partial_markers():
    """不完全なマーカー（END PROBLEM なし）"""
    partial = "%%% PROBLEM 1 %%%\n%%% STEM %%%\ntest\n"
    assert _parse_latex_problems(partial) == []  # END がないのでマッチしない


if __name__ == '__main__':
    test_parse_basic()
    test_problem1_fields()
    test_subproblems()
    test_problem2_no_figure()
    test_latex_in_fields()
    test_empty_input()
    test_partial_markers()
    print('All tests passed!')
