from backend.db import connect_db
from workers.ingest.ingest import insert_problem
from backend.routers.tuning import export_problems_table

merged1 = {
    'stem': '二次関数 f(x)=x^2-4x+k の 最大最小',
    'normalized_text': '二次関数 f(x)=x^<NUM>-<NUM>x+k の最大最小',
    'solution_outline': '平方完成して比較する',
    'stem_latex': r'\\begin{answer}...\\end{answer}',
    'difficulty': 0.218906869839074,
    'difficulty_level': 2,
    'trickiness': 0.05,
    'metadata': {'topic': '二次関数'},
    'explanation': '簡潔な解説',
    'answer_brief': r'\\begin{answer}...\\end{answer}',
    'references': [{'snippet': '平方完成を使う'}],
    'confidence': 0.85,
    'source': 'generated'
}

merged2 = {
    'stem': '別の問題文',
    'normalized_text': '別の問題文',
    'solution_outline': '解説2',
    'stem_latex': r'\\begin{answer}ANS\\end{answer}',
    'difficulty': 0.182604567759103,
    'difficulty_level': 2,
    'trickiness': 0.0,
    'metadata': {},
    'explanation': '解説2',
    'answer_brief': r'\\begin{answer}ANS\\end{answer}',
    'references': [{'snippet': '参照2'}],
    'confidence': 0.7,
    'source': 'generated'
}

if __name__ == '__main__':
    conn = connect_db()
    pid1 = insert_problem(conn, merged1, page=1)
    print('inserted1', pid1)
    pid2 = insert_problem(conn, merged2, page=2)
    print('inserted2', pid2)
    # show export of last 6
    out = export_problems_table(limit=6)
    print('\nCOLUMNS:', out['columns'])
    for r in out['rows']:
        print('\t'.join(r))
    try:
        conn.close()
    except Exception:
        pass
