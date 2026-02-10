import os
import tempfile
import sqlite3
import json
from backend.db import connect_db
from workers.ingest.ingest import insert_problem


def test_insert_stores_final_answer_and_checks(tmp_path, monkeypatch):
    # create a temp sqlite DB and initialize schema via migrations
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(repo_root, '..', 'data')
    # use a temp file
    db_path = str(tmp_path / 'test_examgen.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    # monkeypatch DATABASE_URL to point to temp sqlite
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_path}')
    # import and run migrations via init_sqlite
    from backend.db.init_sqlite import init_db
    init_db()
    # connect and insert
    conn = connect_db()
    problem = {
        'stem': 'f(x)=x^2-2x+k の最小値を求める',
        'final_answer': 'k - 1',
        'checks': [{'desc': '平方完成', 'ok': True}, {'desc': '微分', 'ok': True}],
        'assumptions': ['k is symbolic'],
        'solvable': True,
        'selected_reference': {'index': 1, 'id': '48', 'snippet': 'f(x)=x^2-2x+k...'},
        'metadata': {'doc_id': 'testdoc'}
    }
    pid = insert_problem(conn, problem)
    # query back
    cur = conn.cursor()
    cur.execute("SELECT final_answer_text, checks_json, assumptions_json, selected_reference_json, solvable FROM problems WHERE id = %s", (pid,))
    row = cur.fetchone()
    assert row is not None
    final_text = row[0]
    checks_json = row[1]
    assumptions_json = row[2]
    selected_ref_json = row[3]
    solv = row[4]
    assert final_text is not None and 'k' in final_text
    assert checks_json is not None
    assert assumptions_json is not None
    assert selected_ref_json is not None
    assert solv == 1 or solv is True
