import os
import tempfile
import sqlite3
from backend.db import connect_db
from backend import retriever


def create_tmp_db(path):
    # create a sqlite DB file with minimal problems table
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE problems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT,
        page INTEGER,
        stem TEXT,
        stem_latex TEXT,
        normalized_text TEXT
    )
    ''')
    # insert a few sample problems
    cur.execute('INSERT INTO problems (source, page, stem, stem_latex, normalized_text) VALUES (?, ?, ?, ?, ?)', ('gen', 1, '二次関数の最小値を求めよ', None, '<NUM> 問題'))
    cur.execute('INSERT INTO problems (source, page, stem, stem_latex, normalized_text) VALUES (?, ?, ?, ?, ?)', ('gen', 1, '三角比の基本', '\\sin^2\theta + \\cos^2\theta = 1', '<NUM> 問題'))
    conn.commit()
    conn.close()


def test_tfidf_search_self():
    fd, tmp = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    create_tmp_db(tmp)
    db_url = f'sqlite:///{tmp}'
    conn = connect_db(db_url)
    # run TF-IDF search
    results = retriever._tfidf_search(conn, '二次関数 最小値', top_k=5)
    # expect the first result id to correspond to the first inserted row
    assert results, 'No results returned'
    best_id, score = results[0]
    assert int(best_id) == 1
    # LaTeX-aware query should match the second row containing sin/cos identity
    results_latex = retriever._tfidf_search(conn, '\\sin', top_k=5)
    assert results_latex, 'No results for LaTeX query'
    best_id_latex, _ = results_latex[0]
    assert int(best_id_latex) == 2
    conn.close()
    os.remove(tmp)
