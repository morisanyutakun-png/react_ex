"""_parse_latex_problems のテスト。

構造化マーカー付き LaTeX テキストを問題配列に正しくパースできるか検証する。
Phase 1（厳密 END PROBLEM）と Phase 2（緩いパース）の両方をテスト。
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import _parse_latex_problems, _parse_problem_block


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
    """不完全なマーカー（END PROBLEM なし）→ Phase 2 で緩くパースされる"""
    partial = "%%% PROBLEM 1 %%%\n%%% STEM %%%\ntest\n"
    result = _parse_latex_problems(partial)
    assert len(result) == 1, f"Expected 1 problem from loose parse, got {len(result)}"
    assert result[0]['stem'] == 'test'


def test_missing_end_problem_multiple():
    """END PROBLEM なしで複数問題 → Phase 2 で次の PROBLEM マーカーで区切る"""
    text = """%%% PROBLEM 1 %%%
%%% STEM %%%
問題1のstem
%%% SUBPROBLEM (1) %%%
小問1-1
%%% ANSWER (1) %%%
答え1-1
%%% PROBLEM 2 %%%
%%% STEM %%%
問題2のstem
%%% SUBPROBLEM (1) %%%
小問2-1
%%% ANSWER (1) %%%
答え2-1
"""
    result = _parse_latex_problems(text)
    assert len(result) == 2, f"Expected 2 problems, got {len(result)}"
    assert '問題1' in result[0]['stem']
    assert '問題2' in result[1]['stem']
    assert result[0]['subproblems'][0]['answer'] == '答え1-1'
    assert result[1]['subproblems'][0]['answer'] == '答え2-1'


def test_mixed_end_markers():
    """一部の問題のみ END PROBLEM がある場合"""
    text = """%%% PROBLEM 1 %%%
%%% STEM %%%
問題1
%%% SUBPROBLEM (1) %%%
小問1
%%% ANSWER (1) %%%
答え1
%%% END PROBLEM 1 %%%
%%% PROBLEM 2 %%%
%%% STEM %%%
問題2（ENDマーカーなし）
%%% SUBPROBLEM (1) %%%
小問2
%%% ANSWER (1) %%%
答え2
"""
    result = _parse_latex_problems(text)
    # Phase 1 で PROBLEM 1 だけ取得 → 1件しかない場合は Phase 2 にフォールバックしない (Phase 1 > 0)
    # でも Phase 1 は PROBLEM 1 のみ → 1 件返す
    assert len(result) >= 1
    assert '問題1' in result[0]['stem']


def test_parse_problem_block_direct():
    """_parse_problem_block ヘルパーの直接テスト"""
    block = """%%% TOPIC: 波動 %%%
%%% DIFFICULTY: 標準 %%%
%%% STEM %%%
波の速さを求めよ。
%%% SUBPROBLEM (1) %%%
速さ $v$ を求めよ。
%%% ANSWER (1) %%%
$v = f\\lambda$
%%% EXPLANATION (1) %%%
波の基本公式による。
%%% POINTS (1) %%%
5
%%% SCORING (1) %%%
公式を正しく適用: 3点、計算正確: 2点
"""
    result = _parse_problem_block(block)
    assert result is not None
    assert result['topic'] == '波動'
    assert result['difficulty'] == '標準'
    assert '波の速さ' in result['stem']
    assert len(result['subproblems']) == 1
    sp = result['subproblems'][0]
    assert sp['points'] == 5
    assert '公式を正しく適用' in sp['scoring_criteria']


def test_code_fence_wrapped():
    """code fence で囲まれたマーカーテキストのパース"""
    text = """```latex
%%% PROBLEM 1 %%%
%%% STEM %%%
テスト
%%% SUBPROBLEM (1) %%%
小問
%%% ANSWER (1) %%%
答え
%%% END PROBLEM 1 %%%
```"""
    # _parse_latex_problems は code fence を除去しないが、
    # 呼び出し側で除去される想定
    import re
    m = re.search(r'```(?:latex|tex|plain)?\s*\n?([\s\S]*?)```', text)
    clean = m.group(1).strip() if m else text
    result = _parse_latex_problems(clean)
    assert len(result) == 1


if __name__ == '__main__':
    test_parse_basic()
    test_problem1_fields()
    test_subproblems()
    test_problem2_no_figure()
    test_latex_in_fields()
    test_empty_input()
    test_partial_markers()
    test_missing_end_problem_multiple()
    test_mixed_end_markers()
    test_parse_problem_block_direct()
    test_code_fence_wrapped()
    print('All tests passed!')
