from fastapi.testclient import TestClient
from backend.main import app
import backend.llm_helpers as lh

client = TestClient(app)


def test_retry_handles_missing_coefficients(monkeypatch):
    calls = {'n': 0}
    def fake_run(prompt, max_retries=2, temperature=0.0, model=None):
        calls['n'] += 1
        if calls['n'] == 1:
            return {'parsed': {'error': '解くべき二次関数の具体的な問題文（関数式と何を求めるか）が提示されていません。'}}
        else:
            return {'parsed': {'problem': {'stem': 'f(x)=x^2-2x+k の最小値を求める', 'final_answer': 'k - 1', 'assumptions': ['treated k as symbolic'], 'checks': [{'desc':'complete square','ok':True},{'desc':'evaluate vertex','ok':True}]}}}

    monkeypatch.setattr(lh, 'run_llm_and_validate', fake_run)
    payload = {'prompt': '平方完成で +<NUM> を足した分を -<NUM> で調整すると誤解する', 'model_name': None}
    r = client.post('/api/tuning/run', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('parsed') and data['parsed'].get('problem')
    prob = data['parsed']['problem']
    assert 'final_answer' in prob
    assert 'assumptions' in prob
    assert 'checks' in prob
    assert calls['n'] >= 2
