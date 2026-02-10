from fastapi.testclient import TestClient
from backend.main import app
import backend.llm_helpers as lh

client = TestClient(app)


def test_force_assumption_retry(monkeypatch):
    calls = {'n': 0}
    def fake_run(prompt, max_retries=2, temperature=0.0, model=None):
        calls['n'] += 1
        # first returns error, first retry still returns error, forced retry returns usable parsed
        if calls['n'] <= 2:
            return {'parsed': {'error': '解くべき設問が特定できません'}}
        else:
            return {'parsed': {'schema_version':'1.0','request_id':'r','solvable':True,'problem':{'stem':'f(x)=x^2-4x+3 の最小値を求める','final_answer':-1,'assumptions':['assumed min value'],'checks':[{'desc':'vertex','ok':True},{'desc':'eval','ok':True}]}}}

    monkeypatch.setattr(lh, 'run_llm_and_validate', fake_run)
    payload = {'prompt': '平方完成で +<NUM> を足した分を -<NUM> で調整すると誤解する', 'model_name': None}
    r = client.post('/api/tuning/run', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('parsed') and data['parsed'].get('solvable') is True
    assert 'assumptions' in data['parsed']['problem']
    assert 'final_answer' in data['parsed']['problem']
    assert calls['n'] >= 3
