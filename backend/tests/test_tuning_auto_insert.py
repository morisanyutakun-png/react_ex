from fastapi.testclient import TestClient
from backend.main import app
import backend.llm_helpers as lh
import backend.db as dbmod

client = TestClient(app)


def test_run_auto_insert_invokes_db(monkeypatch):
    # fake LLM returns parsed with required fields
    def fake_run(prompt, max_retries=2, temperature=0.0, model=None):
        return {'parsed': {'problem': {'stem': '1+1', 'final_answer': 2, 'checks': [{'desc':'sum','ok':True},{'desc':'sanity','ok':True}]}}}
    monkeypatch.setattr(lh, 'run_llm_and_validate', fake_run)

    # fake insert_problem to return predictable id
    called = {}
    def fake_insert(conn, merged, page=None):
        called['merged'] = merged
        return 9999
    monkeypatch.setattr('workers.ingest.ingest.insert_problem', fake_insert)

    payload = {'prompt': '簡単な問題: 1+1?', 'model_name': None, 'auto_insert': True}
    r = client.post('/api/tuning/run', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('inserted_id') == 9999
    assert called.get('merged') and called['merged']['final_answer'] == 2
