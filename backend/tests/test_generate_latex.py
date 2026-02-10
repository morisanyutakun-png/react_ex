from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def fake_run(prompt, model=None):
    return {
        'raw': '{"generated": [{"latex": "\\\\[x^2\\]", "difficulty": 0.3}], "schema_version":"1.0" }',
        'parsed': {'generated': [{'latex': '\\[x^2\\]', 'difficulty': 0.3}]},
        'errors': []
    }


def test_generate_latex(monkeypatch):
    monkeypatch.setattr('backend.llm_helpers.run_llm_generation', fake_run)
    payload = {'prompt': '二次関数の簡単な問題を1問作って', 'num': 1}
    r = client.post('/api/generate_latex', json=payload)
    assert r.status_code == 200
    j = r.json()
    assert 'generated' in j
    assert isinstance(j['generated'], list)
    assert j['generated'][0]['latex'].startswith('\\[')
