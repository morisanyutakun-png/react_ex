"""Test that POINTS markers are parsed and scoring table is generated."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import _parse_latex_problems, _build_practice_latex

SAMPLE = r"""
%%% PROBLEM 1 %%%
%%% TOPIC: 力学・等加速度運動 %%%
%%% DIFFICULTY: 応用 %%%
%%% STEM %%%
質量 $m = 2.0\,\mathrm{kg}$ の物体が斜面を滑り始めた。
%%% SUBPROBLEM (1) %%%
速さを求めよ。
%%% POINTS (1) %%%
10
%%% ANSWER (1) %%%
$v = 9.9\,\mathrm{m/s}$
%%% EXPLANATION (1) %%%
エネルギー保存則より。
%%% SUBPROBLEM (2) %%%
時間を求めよ。
%%% POINTS (2) %%%
15
%%% ANSWER (2) %%%
$t = 2.0\,\mathrm{s}$
%%% EXPLANATION (2) %%%
等加速度運動の式より。
%%% END PROBLEM 1 %%%

%%% PROBLEM 2 %%%
%%% TOPIC: 波動 %%%
%%% DIFFICULTY: 応用 %%%
%%% STEM %%%
弦の振動について考える。
%%% SUBPROBLEM (1) %%%
周波数を求めよ。
%%% POINTS (1) %%%
12
%%% ANSWER (1) %%%
$f = 440\,\mathrm{Hz}$
%%% EXPLANATION (1) %%%
基本振動数の式より。
%%% SUBPROBLEM (2) %%%
波長を求めよ。
%%% POINTS (2) %%%
13
%%% ANSWER (2) %%%
$\lambda = 0.5\,\mathrm{m}$
%%% EXPLANATION (2) %%%
$v = f\lambda$ より。
%%% END PROBLEM 2 %%%
"""


def test_points_parsing():
    problems = _parse_latex_problems(SAMPLE)
    assert len(problems) == 2
    # Problem 1
    subs1 = problems[0]['subproblems']
    assert len(subs1) == 2
    assert subs1[0]['points'] == 10
    assert subs1[1]['points'] == 15
    # Problem 2
    subs2 = problems[1]['subproblems']
    assert len(subs2) == 2
    assert subs2[0]['points'] == 12
    assert subs2[1]['points'] == 13


def test_problems_mode_has_scoring_table():
    problems = _parse_latex_problems(SAMPLE)
    latex = _build_practice_latex(problems, '物理', '応用', mode='problems')
    assert '自己採点表' in latex
    assert '10点' in latex
    assert '15点' in latex
    assert '12点' in latex
    assert '13点' in latex
    assert '合計' in latex
    assert '50点' in latex  # 10+15+12+13 = 50


def test_points_in_problem_box():
    problems = _parse_latex_problems(SAMPLE)
    latex = _build_practice_latex(problems, '物理', '応用', mode='problems')
    # Each subproblem should show its point value
    assert '[10点]' in latex
    assert '[15点]' in latex


def test_answers_mode_has_points():
    problems = _parse_latex_problems(SAMPLE)
    latex = _build_practice_latex(problems, '物理', '応用', mode='answers')
    assert '[10点]' in latex
    assert '[15点]' in latex


def test_full_mode_has_scoring_table():
    """Full mode should NOT have scoring table (only problems mode does)."""
    problems = _parse_latex_problems(SAMPLE)
    latex = _build_practice_latex(problems, '物理', '応用', mode='full')
    assert '自己採点表' not in latex


def test_no_points_graceful():
    """When POINTS markers are missing, points should default to 0."""
    sample_no_pts = r"""
%%% PROBLEM 1 %%%
%%% TOPIC: テスト %%%
%%% DIFFICULTY: 基礎 %%%
%%% STEM %%%
テスト問題。
%%% SUBPROBLEM (1) %%%
求めよ。
%%% ANSWER (1) %%%
答え
%%% EXPLANATION (1) %%%
解説
%%% END PROBLEM 1 %%%
"""
    problems = _parse_latex_problems(sample_no_pts)
    assert problems[0]['subproblems'][0]['points'] == 0
