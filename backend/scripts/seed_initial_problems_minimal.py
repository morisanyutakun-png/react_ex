"""Insert a minimal set of seed problems directly into sqlite DB without importing the ingest module
This is a fallback used when dependencies like jsonschema are missing in the environment.
"""
import os
import sys
import json
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(THIS_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
from backend.db import connect_db

PROBLEMS = [
    {'stem': '二次関数 f(x)=x^2-4x+3 の最小値を求めよ', 'stem_latex': r'$f(x)=x^2-4x+3$ の最小値を求めよ', 'metadata': {'subject': '数学', 'topic': '二次関数'}},
    {'stem': '一次方程式 3x+5=20 を解け', 'stem_latex': r'$3x+5=20$ を解け', 'metadata': {'subject': '数学', 'topic': '方程式'}},
    {'stem': '直角三角形において、斜辺が5、他の辺が3のとき、残りの辺の長さを求めよ', 'stem_latex': r'直角三角形: c=5, a=3 のとき b=\\sqrt{c^2-a^2}', 'metadata': {'subject': '数学', 'topic': '三角形'}},
    {'stem': '等差数列の1項が2、公差が3のとき、5項目の値を求めよ', 'stem_latex': r'等差数列: a_1=2, d=3 のとき a_5 を求めよ', 'metadata': {'subject': '数学', 'topic': '数列'}},
    {'stem': '関数 f(x)=\\sin x の導関数を求めよ', 'stem_latex': r'$f(x)=\\sin x$ の導関数を求めよ', 'metadata': {'subject': '数学', 'topic': '微分'}},
    {'stem': '二次関数 f(x)=x^2-2x+k が極小値をとるときの k の値を求めよ', 'stem_latex': r'$f(x)=x^2-2x+k$ が極小値をとるときの $k$ を求めよ', 'metadata': {'subject': '数学', 'topic': '二次関数'}},
]


def main():
    conn = connect_db()
    cur = conn.cursor()
    inserted = 0
    for p in PROBLEMS:
        stem = p['stem']
        cur.execute('SELECT id FROM problems WHERE stem = %s', (stem,))
        rows = cur.fetchall()
        if rows:
            continue
        try:
            cur.execute(
                """
                INSERT INTO problems (source, page, stem, normalized_text, solution_outline, stem_latex, difficulty, difficulty_level, trickiness, metadata, explanation, answer_brief, references_json, expected_mistakes, confidence, raw_text, raw_json, normalized_json, schema_version, request_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    'seed',
                    None,
                    stem,
                    stem,
                    None,
                    p.get('stem_latex'),
                    None,
                    None,
                    None,
                    json.dumps(p.get('metadata', {}), ensure_ascii=False),
                    None,
                    None,
                    None,
                    None,
                    None,
                    stem,
                    None,
                    None,
                    '1.0',
                    '',
                )
            )
            inserted += 1
        except Exception as e:
            print('Failed to insert', stem[:60], 'error:', e)
    conn.commit()
    cur.close()
    conn.close()
    print('Inserted', inserted, 'seed problems')


if __name__ == '__main__':
    main()
