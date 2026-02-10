import json
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_assemble_prompt_includes_strict_instructions_for_tuning():
    payload = {
        'question': '平方完成で +<NUM> を足した分を -<NUM> で調整すると誤解する',
        'top_k': 3,
        'tuning_mode': True,
        'tuning_profile': 'json_only',
        'tuning_include_refs': True
    }
    r = client.post('/api/assemble_prompt', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'strict_prompt' in data
    assert 'prompt_tuning' in data
    assert 'prompt_tuning_summarized' in data
    sp = data['strict_prompt']
    # strict prompt should explicitly require final_answer and checks
    assert 'final_answer' in sp
    assert 'checks' in sp
    # must instruct selection of a single reference when multiple are present
    assert 'selected_reference' in sp
    # request_id should be present and look like a uuid string
    assert 'request_id' in data
    rid = data['request_id']
    assert isinstance(rid, str) and len(rid) > 8
