from fastapi import APIRouter, HTTPException, status
from typing import List
import os

from backend.db import connect_db
from backend.schemas.generation import (
    GenerationRunCreate,
    GenerationRunRead,
    GenerationEvalCreate,
    GenerationEvalRead,
)
from backend.services.generation_service import (
    create_generation_run,
    get_generation_run,
    create_generation_eval,
    list_generation_evals,
)

router = APIRouter(prefix="/api", tags=["generation"])


@router.post('/generation_runs', response_model=GenerationRunRead, status_code=status.HTTP_201_CREATED)
def post_generation_run(body: GenerationRunCreate):
    DB = os.environ.get('DATABASE_URL')
    if not DB:
        raise HTTPException(status_code=500, detail='DATABASE_URL not set')
    conn = connect_db(DB)
    try:
        run = create_generation_run(conn, body.input_params, body.retrieved_segment_ids, body.output_text, body.model_name, body.rag_run_id)
        return GenerationRunRead(**run)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.get('/generation_runs/{run_id}', response_model=GenerationRunRead)
def get_generation_run_endpoint(run_id: int):
    DB = os.environ.get('DATABASE_URL')
    if not DB:
        raise HTTPException(status_code=500, detail='DATABASE_URL not set')
    conn = connect_db(DB)
    try:
        run = get_generation_run(conn, run_id)
        if not run:
            raise HTTPException(status_code=404, detail='run not found')
        return GenerationRunRead(**run)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.post('/generation_runs/{run_id}/evals', response_model=GenerationEvalRead, status_code=status.HTTP_201_CREATED)
def post_generation_eval(run_id: int, body: GenerationEvalCreate):
    DB = os.environ.get('DATABASE_URL')
    if not DB:
        raise HTTPException(status_code=500, detail='DATABASE_URL not set')
    conn = connect_db(DB)
    try:
        # ensure run exists
        from backend.services.generation_service import get_generation_run as _get

        existing = _get(conn, run_id)
        if not existing:
            raise HTTPException(status_code=404, detail='run not found')
        ev = create_generation_eval(conn, run_id, body.axes, body.overall, body.notes, body.is_usable)
        return GenerationEvalRead(**ev)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.get('/generation_runs/{run_id}/evals', response_model=List[GenerationEvalRead])
def list_evals_endpoint(run_id: int):
    DB = os.environ.get('DATABASE_URL')
    if not DB:
        raise HTTPException(status_code=500, detail='DATABASE_URL not set')
    conn = connect_db(DB)
    try:
        evs = list_generation_evals(conn, run_id)
        return [GenerationEvalRead(**e) for e in evs]
    finally:
        try:
            conn.close()
        except Exception:
            pass
