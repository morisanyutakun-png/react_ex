from fastapi.testclient import TestClient
from backend.main import app
import backend.llm_helpers as lh

client = TestClient(app)


def test_generate_similar_returns_generated_and_can_insert(monkeypatch):
    # fake generation returns a parsed JSON with 'generated'
    def fake_run(prompt, model=None, timeout=20):
        return {'raw': '{...}', 'parsed': {'schema_version':'1.0','request_id':'r','generated':[{'latex':'\\[ x^2-4x+3 = 0 \\]','stem':'x^2-4x+3 の最小値を求めよ','difficulty':0.3}]}, 'errors': None}
    monkeypatch.setattr(lh, 'run_llm_generation', fake_run)

    # monkeypatch insert_problem to avoid DB dependency
    inserted = {}
    def fake_insert(conn, prob, page=None):
        idx = len(inserted) + 1000
        inserted[idx] = prob
        return idx
    import workers.ingest.ingest as ingestmod
    monkeypatch.setattr(ingestmod, 'insert_problem', fake_insert)

    payload = {'question':'平方完成で...', 'top_k':2, 'num':2, 'use_vector': False, 'auto_insert': True}
    # include generation controls
    payload['generation_style'] = 'short_problem_statement'
    payload['min_difficulty'] = 0.2
    payload['max_difficulty'] = 0.5
    payload['prohibited_tags'] = ['proof', 'multi-step']
    r = client.post('/api/generate_similar', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'generated' in data and isinstance(data['generated'], list)
    assert data['inserted_ids'] and data['inserted_ids'][0] is not None
