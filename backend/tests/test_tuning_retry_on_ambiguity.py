from fastapi.testclient import TestClient
from backend.main import app
import backend.llm_helpers as lh

client = TestClient(app)


def test_run_retries_on_ambiguity(monkeypatch):
    calls = {'n': 0}
    def fake_run(prompt, max_retries=2, temperature=0.0, model=None):
        calls['n'] += 1
        if calls['n'] == 1:
            return {'parsed': {'error': '解くべき具体的な問題文が特定できません。参照内に複数の二次関数が存在します。'}}
        else:
            return {'parsed': {'problem': {'stem': 'f(x)=x^2-2x+k の最小値を求める', 'final_answer': -1, 'checks': [{'desc':'derive','ok':True},{'desc':'vertex','ok':True}]}}}

    monkeypatch.setattr(lh, 'run_llm_and_validate', fake_run)
    payload = {'prompt': '平方完成で +<NUM> を足した分を -<NUM> で調整すると誤解する', 'model_name': None}
    r = client.post('/api/tuning/run', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('parsed') and data['parsed'].get('problem')
    assert data['parsed']['problem'].get('final_answer') is not None
    assert 'checks' in data['parsed']['problem']
    assert calls['n'] >= 2
