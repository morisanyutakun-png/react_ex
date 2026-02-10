import json
from typing import Any, Dict, List, Optional

from backend.db import connect_db


def create_generation_run(conn, input_params: Dict[str, Any], retrieved_segment_ids: Optional[List[int]] = None, output_text: Optional[str] = None, model_name: Optional[str] = None, rag_run_id: Optional[int] = None) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO generation_runs (rag_run_id, generator_config, target_difficulty, actual_difficulty, status, error_text, artifacts, input_params, retrieved_segment_ids, output_text, model_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, created_at
        """,
        (
            rag_run_id,
            None,
            None,
            None,
            'created',
            None,
            None,
            json.dumps(input_params, ensure_ascii=False),
            retrieved_segment_ids,
            output_text,
            model_name,
        ),
    )
    ins = cur.fetchone()
    conn.commit()
    cur.close()
    return {
        "id": ins[0],
        "input_params": input_params,
        "retrieved_segment_ids": retrieved_segment_ids,
        "output_text": output_text,
        "model_name": model_name,
        "rag_run_id": rag_run_id,
        "created_at": ins[1],
    }


def get_generation_run(conn, run_id: int) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        "SELECT id, rag_run_id, input_params, retrieved_segment_ids, output_text, model_name, created_at FROM generation_runs WHERE id = %s",
        (run_id,),
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {
        "id": row[0],
        "rag_run_id": row[1],
        "input_params": row[2],
        "retrieved_segment_ids": row[3],
        "output_text": row[4],
        "model_name": row[5],
        "created_at": row[6],
    }


def create_generation_eval(conn, run_id: int, axes: Dict[str, Any], overall: Optional[int] = None, notes: Optional[str] = None, is_usable: Optional[bool] = None) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO generation_evals (run_id, axes, overall, notes, is_usable) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
        (run_id, json.dumps(axes, ensure_ascii=False), overall, notes, is_usable),
    )
    ins = cur.fetchone()
    conn.commit()
    cur.close()
    return {
        "id": ins[0],
        "run_id": run_id,
        "axes": axes,
        "overall": overall,
        "notes": notes,
        "is_usable": is_usable,
        "created_at": ins[1],
    }


def list_generation_evals(conn, run_id: int):
    cur = conn.cursor()
    cur.execute("SELECT id, run_id, axes, overall, notes, is_usable, created_at FROM generation_evals WHERE run_id = %s ORDER BY created_at DESC", (run_id,))
    rows = cur.fetchall()
    cur.close()
    return [
        {
            "id": r[0],
            "run_id": r[1],
            "axes": r[2],
            "overall": r[3],
            "notes": r[4],
            "is_usable": r[5],
            "created_at": r[6],
        }
        for r in rows
    ]
