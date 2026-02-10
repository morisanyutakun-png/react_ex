import json
from fastapi.testclient import TestClient
from backend.main import app
import backend.llm_helpers as lh

client = TestClient(app)


def test_run_wrapping_enforces_strict_prompt(monkeypatch):
    called = {}
    def fake_run(prompt, max_retries=2, temperature=0.0, model=None):
        # ensure wrapper added strict instructions
        assert 'schema_version' in prompt or 'request_id' in prompt
        assert 'final_answer' in prompt
        assert 'checks' in prompt
        called['ok'] = True
        return {'parsed': {'problem': {'stem': 'Test', 'final_answer': -1, 'checks': [{'desc':'c','ok':True},{'desc':'c2','ok':True}]}}, 'raw': '{}', 'errors': [], 'attempts': 1}

    monkeypatch.setattr(lh, 'run_llm_and_validate', fake_run)
    payload = {'prompt': '簡単な問題: 1+1?', 'model_name': None}
    r = client.post('/api/tuning/run', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert called.get('ok')
    assert 'parsed' in data
    assert data['parsed']['problem']['final_answer'] == -1
