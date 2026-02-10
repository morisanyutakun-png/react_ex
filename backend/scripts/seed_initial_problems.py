"""Seed a small curated set of initial math problems into the local DB.

This script is conservative: it checks whether a problem with the same stem exists and skips duplicates.
It uses the project's `insert_problem` helper to ensure all normalization/validation logic is applied.

Usage:
  /Users/moriyuuta/react_ex/backend/.venv/bin/python backend/scripts/seed_initial_problems.py
"""
import sys
import os
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(THIS_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.db import connect_db
from workers.ingest.ingest import insert_problem

PROBLEMS = [
    # simple numeric problems (explicit numbers)
    {
        'stem': '二次関数 f(x)=x^2-4x+3 の最小値を求めよ',
        'stem_latex': r'$f(x)=x^2-4x+3$ の最小値を求めよ',
        'metadata': {'subject': '数学', 'topic': '二次関数'}
    },
    {
        'stem': '一次方程式 3x+5=20 を解け',
        'stem_latex': r'$3x+5=20$ を解け',
        'metadata': {'subject': '数学', 'topic': '方程式'}
    },
    {
        'stem': '直角三角形において、斜辺が5、他の辺が3のとき、残りの辺の長さを求めよ',
        'stem_latex': r'直角三角形: c=5, a=3 のとき b=\sqrt{c^2-a^2}',
        'metadata': {'subject': '数学', 'topic': '三角形'}
    },
    {
        'stem': '等差数列の1項が2、公差が3のとき、5項目の値を求めよ',
        'stem_latex': r'等差数列: a_1=2, d=3 のとき a_5 を求めよ',
        'metadata': {'subject': '数学', 'topic': '数列'}
    },
    {
        'stem': '関数 f(x)=\sin x の導関数を求めよ',
        'stem_latex': r'$f(x)=\sin x$ の導関数を求めよ',
        'metadata': {'subject': '数学', 'topic': '微分'}
    },
    # problems with masked numbers originally - but include actual numbers here for training
    {
        'stem': '二次関数 f(x)=x^2-2x+k が極小値をとるときの k の値を求めよ',
        'stem_latex': r'$f(x)=x^2-2x+k$ が極小値をとるときの $k$ を求めよ',
        'metadata': {'subject': '数学', 'topic': '二次関数'}
    },
    {
        'stem': '次の微分方程式 dy/dx=3x^2 を解け（初期条件 y(0)=1）',
        'stem_latex': r'\frac{dy}{dx}=3x^2, y(0)=1 を解け',
        'metadata': {'subject': '数学', 'topic': '微分方程式'}
    },
    {
        'stem': '行列 A=\begin{pmatrix}1&2\\3&4\end{pmatrix} の行列式を求めよ',
        'stem_latex': r'$A=\begin{pmatrix}1&2\\3&4\end{pmatrix}$ の行列式を求めよ',
        'metadata': {'subject': '数学', 'topic': '線形代数'}
    },
    {
        'stem': '単位円上の点で \sin^2\theta+\cos^2\theta=1 を示せ',
        'stem_latex': r'単位円: \sin^2\theta+\cos^2\theta=1 を示せ',
        'metadata': {'subject': '数学', 'topic': '三角関数'}
    },
    {
        'stem': '確率論: サイコロを2回振って和が7になる確率を求めよ',
        'stem_latex': r'サイコロ2回の和が7である確率を求めよ',
        'metadata': {'subject': '数学', 'topic': '確率'}
    },
    # slightly more textual problems
    {
        'stem': '図形問題: 半径 r の円に内接する正方形の面積を r を使って表せ',
        'stem_latex': r'半径 r の円に内接する正方形の面積を求めよ',
        'metadata': {'subject': '数学', 'topic': '図形'}
    },
    {
        'stem': '三角比: 角 30 度の sin 値を求めよ',
        'stem_latex': r'\sin 30^{\circ} = ?',
        'metadata': {'subject': '数学', 'topic': '三角比'}
    },
    {
        'stem': '複素数問題: (1+i)^2 を計算せよ',
        'stem_latex': r'(1+i)^2 を計算せよ',
        'metadata': {'subject': '数学', 'topic': '複素数'}
    },
    {
        'stem': '数列: 階乗 n! の定義を説明せよ',
        'stem_latex': r'n! の定義を説明せよ',
        'metadata': {'subject': '数学', 'topic': '数列'}
    },
    {
        'stem': '不等式: 0<x<1 のとき 1+x\le e^x を示せ',
        'stem_latex': r'0<x<1 のとき 1+x\le e^x を示せ',
        'metadata': {'subject': '数学', 'topic': '不等式'}
    },
]


def main():
    conn = connect_db(None)
    cur = conn.cursor()
    inserted = 0
    skipped = 0
    for p in PROBLEMS:
        stem = p.get('stem')
        cur.execute('SELECT id FROM problems WHERE stem = %s', (stem,))
        rows = cur.fetchall()
        if rows:
            skipped += 1
            continue
        try:
            pid = insert_problem(conn, p)
            print('Inserted id=', pid, 'stem=', stem[:60])
            inserted += 1
        except Exception as e:
            print('Failed to insert:', stem[:80], 'error:', e)
    conn.close()
    print('Seed complete: inserted=', inserted, 'skipped=', skipped)

if __name__ == '__main__':
    main()
