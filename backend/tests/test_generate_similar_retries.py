import backend.llm_helpers as lh
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_generate_similar_retries_for_latex(monkeypatch):
    calls = {'n': 0}
    def fake_run(prompt, model=None, timeout=20):
        calls['n'] += 1
        if calls['n'] == 1:
            return {'raw': '...', 'parsed': {'schema_version':'1.0','request_id':'r','generated':[{'stem':'x^2-4x+3 の最小値を求めよ'}]}, 'errors': None}
        else:
            return {'raw': '...', 'parsed': {'schema_version':'1.0','request_id':'r','generated':[{'latex':'\\\\[ x^2-4x+3 = (x-2)^2-1 \\\\]','stem':'x^2-4x+3 の最小値を求めよ'}]}, 'errors': None}

    monkeypatch.setattr(lh, 'run_llm_generation', fake_run)
    # monkeypatch insert_problem
    import workers.ingest.ingest as ingestmod
    monkeypatch.setattr(ingestmod, 'insert_problem', lambda conn, prob, page=None: 12345)

    payload = {'question':'平方完成で...', 'top_k':2, 'num':2, 'use_vector': False, 'auto_insert': True}
    r = client.post('/api/generate_similar', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'generated' in data and isinstance(data['generated'], list)
    assert data['generated'][0].get('latex')
    assert calls['n'] >= 2
