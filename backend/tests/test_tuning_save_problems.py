from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_bulk_save_accepts_items():
    payload = {'items': [
        {'stem': 'テスト問題 1: 1+1 は？', 'stem_latex': '$1+1$'},
        {'stem': 'テスト問題 2: x^2=4 の解は？', 'stem_latex': '$x^2=4$'}
    ]}
    r = client.post('/api/tuning/save_problems', json=payload)
    assert r.status_code == 200
    j = r.json()
    assert j.get('status') == 'ok'
    assert j.get('inserted_count', 0) >= 0
    assert isinstance(j.get('results'), list)
