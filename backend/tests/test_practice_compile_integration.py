"""ユーザー提供のLLM出力 → パース → LaTeX文書生成 → lualatex コンパイルの統合テスト"""
import sys, os, tempfile, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import _parse_latex_problems, _build_practice_latex

LLM_OUTPUT = r"""%%% PROBLEM 1 %%%
%%% TOPIC: 力学・斜面運動と摩擦 %%%
%%% DIFFICULTY: 応用 %%%
%%% STEM %%%
質量 $m = 2.0\,\mathrm{kg}$ の物体が、傾き角 $\theta = 30^\circ$ の粗い斜面上に静かに置かれている。斜面と物体の間の動摩擦係数は $\mu = 0.20$ とする。物体は時刻 $t=0$ に静かに離され、斜面に沿って滑り降りる。重力加速度は $g = 9.8\,\mathrm{m/s^2}$ とする。

%%% FIGURE %%%
\begin{tikzpicture}[>=stealth,scale=1.2]
\fill[gray!15] (0,0)--(4,0)--(4,2.31)--cycle;
\draw[thick] (0,0)--(4,0)--(4,2.31)--cycle;
\draw[thin] (0.65,0) arc[start angle=0,end angle=30,radius=0.65];
\node at (0.95,0.18) {$\theta$};
\begin{scope}[shift={(2.17,1.25)},rotate=30]
\draw[fill=blue!20,thick] (-0.3,0) rectangle ++(0.6,0.6);
\node at (0,0.3) {$m$};
\draw[->,red,very thick] (0,0.3)--++(0,1.0) node[above]{$N$};
\draw[->,green!60!black,thick] (-0.3,0.3)--++(-1.0,0) node[left]{$f$};
\end{scope}
\draw[->,blue,very thick] (2.02,1.51)--++(0,-1.0) node[below]{$mg$};
\end{tikzpicture}

%%% SUBPROBLEM (1) %%%
物体の加速度を求めよ。
%%% POINTS (1) %%%
12
%%% ANSWER (1) %%%
[
a = g(\sin\theta - \mu\cos\theta)
= 9.8\left(\frac{1}{2}-0.20\times\frac{\sqrt{3}}{2}\right)
\approx 3.2\,\mathrm{m/s^2}
]
%%% EXPLANATION (1) %%%
斜面方向の力を考える。重力の斜面方向成分は $mg\sin\theta$、法線力は $N=mg\cos\theta$ である。
動摩擦力は $f=\mu N=\mu mg\cos\theta$ である。

運動方程式より
[
ma = mg\sin\theta - \mu mg\cos\theta
]

したがって
[
a = g(\sin\theta-\mu\cos\theta)
]

数値代入して
[
a = 9.8(0.5-0.20\times0.866)\approx3.2\,\mathrm{m/s^2}
]
%%% SCORING (1) %%%
斜面方向の力の式 $mg\sin\theta-\mu mg\cos\theta$ を立てた: +6点
$a=g(\sin\theta-\mu\cos\theta)$ を導出: +4点
数値代入して正しい値: +2点（計算ミス −1点）
%%% SUBPROBLEM (2) %%%
物体が斜面に沿って $4.0\,\mathrm{m}$ 滑り降りたときの速さを求めよ。
%%% POINTS (2) %%%
13
%%% ANSWER (2) %%%
[
v=\sqrt{2as}=\sqrt{2\times3.2\times4.0}
\approx5.1\,\mathrm{m/s}
]
%%% EXPLANATION (2) %%%
等加速度運動の公式
[
v^2 = 2as
]
を用いる。

$a=3.2\,\mathrm{m/s^2}$、$s=4.0\,\mathrm{m}$ より
[
v^2=2\times3.2\times4.0=25.6
]

したがって
[
v\approx5.1\,\mathrm{m/s}
]
%%% SCORING (2) %%%
等加速度公式 $v^2=2as$ を使用: +6点
正しい代入: +4点
最終結果: +3点（計算ミス −1点）
%%% END PROBLEM 1 %%%

%%% PROBLEM 2 %%%
%%% TOPIC: 力学・滑車と運動方程式 %%%
%%% DIFFICULTY: 応用 %%%
%%% STEM %%%
水平な台の上に質量 $m_A=3.0\,\mathrm{kg}$ の物体Aがあり、軽い糸で台の端の滑車を介して質量 $m_B=2.0\,\mathrm{kg}$ の物体Bとつながれている。糸と滑車は軽く摩擦はない。台と物体Aの間の動摩擦係数は $\mu=0.20$ とする。重力加速度は $g=9.8\,\mathrm{m/s^2}$ とする。

%%% FIGURE %%%
\begin{tikzpicture}[>=stealth,scale=1.0]
\fill[pattern=north east lines] (-0.2,-0.2) rectangle (4.5,0);
\draw[thick] (-0.2,0)--(4.5,0);
\draw[thick] (4.5,0)--(4.5,-2.0);
\draw[thick] (4.5,0)--(4.5,0.25);
\fill[gray!30] (4.5,0.5) circle (0.25);
\draw[thick] (4.5,0.5) circle (0.25);
\fill (4.5,0.5) circle (1.5pt);
\draw[fill=blue!20,thick] (1.2,0) rectangle ++(1.0,0.8);
\node at (1.7,0.4) {$m_A$};
\draw[thick] (2.2,0.5)--(4.25,0.5);
\draw[thick] (4.25,0.5) arc[start angle=180,end angle=270,radius=0.25];
\draw[thick] (4.5,0.25)--(4.5,-0.6);
\draw[fill=red!20,thick] (4.15,-1.3) rectangle ++(0.7,0.7);
\node at (4.5,-0.95) {$m_B$};
\draw[->,blue,thick] (4.5,-1.3)--++(0,-0.6) node[below]{$m_B g$};
\draw[->,red,thick] (2.2,0.4)--++(0.8,0) node[above]{$T$};
\draw[->,blue,thick] (1.7,0)--++(0,-0.6) node[below]{$m_A g$};
\end{tikzpicture}

%%% SUBPROBLEM (1) %%%
系の加速度を求めよ。
%%% POINTS (1) %%%
12
%%% ANSWER (1) %%%
[
a = \frac{m_B g - \mu m_A g}{m_A + m_B}
= \frac{19.6 - 5.88}{5}
\approx 2.7\,\mathrm{m/s^2}
]
%%% EXPLANATION (1) %%%
物体Aの運動方程式
[
T-\mu m_A g = m_A a
]

物体Bの運動方程式
[
m_B g - T = m_B a
]

2式を加えると
[
m_B g - \mu m_A g = (m_A+m_B)a
]

よって
[
a = \frac{m_B g - \mu m_A g}{m_A+m_B}
]
%%% SCORING (1) %%%
2物体の運動方程式を立てた: +6点
加えて加速度式を導出: +4点
数値代入: +2点
%%% SUBPROBLEM (2) %%%
糸の張力 $T$ を求めよ。
%%% POINTS (2) %%%
13
%%% ANSWER (2) %%%
[
T = m_A a + \mu m_A g
= 3.0\times2.7 + 5.88
\approx 14\,\mathrm{N}
]
%%% EXPLANATION (2) %%%
物体Aの式
[
T-\mu m_A g = m_A a
]

より
[
T = m_A a + \mu m_A g
]

$a=2.7$ を代入して求める。
%%% SCORING (2) %%%
正しい式を立てた: +6点
$a$ を代入: +4点
最終数値: +3点
%%% END PROBLEM 2 %%%

%%% PROBLEM 3 %%%
%%% TOPIC: 力学・ばねとエネルギー保存 %%%
%%% DIFFICULTY: 応用 %%%
%%% STEM %%%
なめらかな水平面上で、ばね定数 $k=200\,\mathrm{N/m}$ のばねが壁に固定されている。ばねの先に質量 $m=1.0\,\mathrm{kg}$ の物体をつけ、自然長から $0.30\,\mathrm{m}$ 圧縮して静かに離した。重力加速度は $g=9.8\,\mathrm{m/s^2}$ とする。

%%% FIGURE %%%
\begin{tikzpicture}[>=stealth,scale=1.1]
\fill[gray!20] (0,-0.15) rectangle (0.15,0.85);
\draw[thick] (0.15,-0.1)--(0.15,0.85);
\fill[gray!10] (-0.2,-0.1) rectangle (5.0,0);
\draw[thick] (-0.2,0)--(5.0,0);
\draw[thick,decorate,decoration={coil,aspect=0.35,segment length=5pt,amplitude=7pt}]
(0.15,0.35)--(2.2,0.35);
\draw[fill=blue!20,thick] (2.2,0) rectangle ++(0.7,0.7);
\node at (2.55,0.35) {$m$};
\node at (1.17,0.62) {$k$};
\end{tikzpicture}

%%% SUBPROBLEM (1) %%%
物体が自然長位置を通過するときの速さを求めよ。
%%% POINTS (1) %%%
12
%%% ANSWER (1) %%%
[
v = 4.2\,\mathrm{m/s}
]
%%% EXPLANATION (1) %%%
エネルギー保存より
[
\frac{1}{2}kx^2 = \frac{1}{2}mv^2
]

したがって
[
v = x\sqrt{\frac{k}{m}}
]

数値代入
[
v = 0.30\sqrt{200} \approx 4.2\,\mathrm{m/s}
]
%%% SCORING (1) %%%
エネルギー保存式: +6点
$v$ を解く: +4点
数値計算: +2点
%%% SUBPROBLEM (2) %%%
最大速度を求めよ。
%%% POINTS (2) %%%
13
%%% ANSWER (2) %%%
[
v_{\max}=4.2\,\mathrm{m/s}
]
%%% EXPLANATION (2) %%%
最大速度はばねが自然長のときに生じる。
したがって (1) で求めた速度が最大速度となる。
%%% SCORING (2) %%%
自然長で最大速度と判断: +7点
(1) の結果を使用: +4点
最終答え: +2点
%%% END PROBLEM 3 %%%
"""


def test_parse_full():
    problems = _parse_latex_problems(LLM_OUTPUT)
    assert len(problems) == 3, f"Expected 3 problems, got {len(problems)}"
    # PROBLEM 1: 2 subproblems
    assert len(problems[0]['subproblems']) == 2
    assert problems[0]['figure_tikz'] is not None
    # PROBLEM 2: 2 subproblems
    assert len(problems[1]['subproblems']) == 2
    # PROBLEM 3: 2 subproblems
    assert len(problems[2]['subproblems']) == 2
    print('Parse OK: 3 problems extracted')


def test_build_latex_compiles():
    problems = _parse_latex_problems(LLM_OUTPUT)
    assert problems, "Parse failed"

    for mode in ('full', 'problems', 'answers'):
        latex_doc = _build_practice_latex(problems, '物理', '応用', mode=mode)
        assert '\\documentclass' in latex_doc, f"Missing \\documentclass in {mode}"

        # 裸ブラケット display math が残っていないことを確認
        # (\\[ は OK, 裸の [ がディスプレイ数式として残っていないか)
        lines = latex_doc.split('\n')
        for line_no, line in enumerate(lines, 1):
            stripped = line.strip()
            # 行が "[" のみは display math として疑わしい
            if stripped == '[' and line_no > 10:  # プリアンブル部分はスキップ
                print(f"WARNING: bare [ at line {line_no} in {mode} mode")

        # lualatex でコンパイル試行
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = os.path.join(tmpdir, 'test.tex')
            with open(tex_path, 'w') as f:
                f.write(latex_doc)

            result = subprocess.run(
                ['lualatex', '-interaction=nonstopmode', '-halt-on-error', tex_path],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0:
                # ログから致命的エラーを出力
                log_path = os.path.join(tmpdir, 'test.log')
                if os.path.exists(log_path):
                    with open(log_path) as f:
                        log = f.read()
                    # エラー行を抽出
                    errors = [l for l in log.split('\n') if l.startswith('!') or 'Fatal' in l]
                    print(f"Compile FAILED ({mode}):")
                    for e in errors[:10]:
                        print(f"  {e}")
                    # .tex ファイルもデバッグ用に出力
                    with open(f'/tmp/debug_practice_{mode}.tex', 'w') as f:
                        f.write(latex_doc)
                    print(f"  Debug tex saved: /tmp/debug_practice_{mode}.tex")
                assert False, f"lualatex compilation failed for mode={mode}"
            else:
                pdf_path = os.path.join(tmpdir, 'test.pdf')
                pdf_size = os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 0
                print(f"Compile OK ({mode}): PDF {pdf_size} bytes")


if __name__ == '__main__':
    test_parse_full()
    test_build_latex_compiles()
    print('All integration tests passed!')
