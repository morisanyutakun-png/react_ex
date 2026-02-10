from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any
import os, json, subprocess, sys
from backend.main import ADMIN_SECRET
from backend.db import connect_db

router = APIRouter(prefix="/api", tags=["eval"])

EVAL_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'eval_candidates.json')
EVAL_PATH = os.path.abspath(EVAL_PATH)


def _check_admin_token(request: Request):
    token = request.headers.get('x-admin-token') or request.query_params.get('admin_token')
    if token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail='forbidden')


@router.get('/eval_candidates')
def get_eval_candidates():
    if not os.path.exists(EVAL_PATH):
        return {'cases': []}
    try:
        with open(EVAL_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {'cases': data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/eval_candidates')
def save_eval_candidates(payload: List[Dict[str, Any]], request: Request):
    _check_admin_token(request)
    try:
        os.makedirs(os.path.dirname(EVAL_PATH), exist_ok=True)
        with open(EVAL_PATH, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return {'ok': True, 'count': len(payload)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/eval_candidates/generate')
def generate_candidates(n: int = 200, topk: int = 5, autofill: bool = True, request: Request = None):
    # require admin token
    if request is not None:
        _check_admin_token(request)
    # call the script using the running python executable to ensure venv
    script = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'generate_eval_candidates.py')
    cmd = [sys.executable, script, '--n', str(n), '--topk', str(topk)]
    if autofill:
        cmd.append('--auto-fill')
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        out = res.stdout.decode('utf-8', errors='ignore')
        err = res.stderr.decode('utf-8', errors='ignore')
        if res.returncode != 0:
            raise Exception(f'script failed: {res.returncode}\nSTDOUT:\n{out}\nSTDERR:\n{err}')
        # read back file
        with open(EVAL_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {'ok': True, 'cases': len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
