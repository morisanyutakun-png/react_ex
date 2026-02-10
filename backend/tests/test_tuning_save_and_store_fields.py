import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import connect_db

client = TestClient(app)


def test_save_and_store_all_fields(monkeypatch):
    payload = {
        "schema_version": "1.0",
        "request_id": "5c871cde-ac36-4a8c-a120-65387b5b3034",
        "solvable": True,
        "selected_reference": {"index": 5, "id": "1", "snippet": "二次関数 f(x)=x^2-4x+3 の最小値を求めよ"},
        "answer_brief": None,
        "explanation": "f(x)=x^2-4x+3 を平方完成する。x^2-4x+3=(x^2-4x+4)-1=(x-2)^2-1。\n平方 (x-2)^2 は常に 0 以上なので、最小は (x-2)^2=0 となる x=2 のときに達し、その最小値は -1。",
        "confidence": 0.98,
        "references": [{"id": 1, "snippet": "二次関数 f(x)=x^2-4x+3 の最小値を求める問題（平方完成で頂点と最小値を求める）。"}],
        "final_answer": -1,
        "checks": [
            {"desc": "平方完成で確認: f(x)=(x-2)^2-1 より最小値は -1", "ok": True, "value": "x=2 のとき f(2)=-1"},
            {"desc": "微分で確認: f'(x)=2x-4=0 の解 x=2、上に開くのでそこで最小", "ok": True, "value": "f(2)=4-8+3=-1"}
        ],
        "problem": {
            "stem": "二次関数 f(x)=x^2-4x+3 の最小値を求めよ。",
            "final_answer": -1,
            "checks": [
                {"desc": "平方完成: (x-2)^2-1 の形にして最小値を読む", "ok": True, "value": "最小値 -1"},
                {"desc": "頂点のx座標: -b/(2a)=4/2=2 を用いて値を代入", "ok": True, "value": "f(2)=-1"}
            ],
            "selected_reference": {"index": 5, "id": "1"}
        }
    }

    r = client.post('/api/tuning/save_problem', json={'parsed_output': payload})
    assert r.status_code == 200, r.text
    data = r.json()
    pid = data.get('inserted_id')
    assert pid is not None

    conn = connect_db()
    cur = conn.cursor()
    cur.execute('SELECT final_answer_text, final_answer_numeric, checks_json, assumptions_json, selected_reference_json, solvable, explanation, confidence, references_json FROM problems WHERE id = %s', (pid,))
    row = cur.fetchone()
    assert row is not None
    final_text = row[0]
    final_num = row[1]
    checks_json = row[2]
    assumptions_json = row[3]
    sel_ref_json = row[4]
    solv = row[5]
    explanation = row[6]
    confidence = row[7]
    references_json = row[8]

    assert final_text == '-1' or final_num == -1
    assert checks_json is not None
    assert sel_ref_json is not None
    assert solv == 1 or solv is True
    assert '平方完成' in explanation
    assert float(confidence) == 0.98
    assert references_json is not None

    conn.close()
