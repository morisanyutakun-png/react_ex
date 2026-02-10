import json
from backend.routers.tuning import save_parsed_problem
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_save_problem_requires_final_and_checks():
    payload = {
        'parsed_output': {
            'problem': {
                'stem': 'Test problem',
                'solution_outline': 'do something'
            },
            'explanation': 'explain'
        }
    }
    r = client.post('/api/tuning/save_problem', json=payload)
    assert r.status_code == 400
    assert r.json()['error'] == 'validation_failed'


def test_save_problem_accepts_good():
    payload = {
        'parsed_output': {
            'problem': {
                'stem': 'Test problem 2',
                'solution_outline': 'steps',
                'final_answer': -1,
                'checks': [
                    {'desc': 'calc', 'ok': True, 'value': -1},
                    {'desc': 'derivative', 'ok': True}
                ]
            },
            'explanation': 'explain',
            'answer_brief': 'ans'
        }
    }
    r = client.post('/api/tuning/save_problem', json=payload)
    assert r.status_code == 200
    assert r.json().get('inserted_id') is not None
