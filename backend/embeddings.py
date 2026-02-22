"""
Embeddings module (MVP) - schema-aligned + faster inserts

- Generates embeddings for multiple "kinds" of texts per problem using sentence-transformers
- Saves into Postgres + pgvector (embeddings.vector is vector(N))
- Skips existing (problem_id, kind, version) to avoid re-encoding
- Validates embedding dimension matches DB vector dimension

Usage:
  python backend/embeddings.py --all
  python backend/embeddings.py --ids 1,2,3

Env:
  DATABASE_URL
  SENTENCE_TRANSFORMER_MODEL (default: sentence-transformers/paraphrase-multilingual-mpnet-base-v2)  # 768-dim
  EMBEDDING_BATCH_SIZE (default: 32)
  EMBEDDING_VERSION (default: v1)
"""
import os
import sys
import json
import re
from typing import List, Dict, Tuple, Optional
import time
import datetime

try:
    import psycopg2
    from psycopg2.extras import execute_values
except Exception:
    psycopg2 = None  # type: ignore[assignment]
    execute_values = None  # type: ignore[assignment]

import logging

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
except Exception:
    SentenceTransformer = None  # type: ignore[misc]
    np = None  # type: ignore[assignment]
    logging.getLogger(__name__).warning(
        "sentence-transformers not available; embedding features disabled."
    )


# ---- import safety: make project root importable ----
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from workers.ingest.pipeline.segmenter import normalize_numbers


# -----------------------------
# DB helpers
# -----------------------------
def get_db_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")
    return psycopg2.connect(db_url)


def get_vector_dim_from_db(conn) -> Optional[int]:
    """
    Read vector dimension from column type, e.g. 'vector(768)'.
    Returns None if not found (should not happen if schema is correct).
    """
    # Postgres: inspect pg_attribute to find vector(N)
    try:
        # SQLite fallback: try to infer from stored metadata if available
        if getattr(conn, '_is_sqlite', False):
            cur = conn.cursor()
            try:
                cur.execute('SELECT metadata FROM embeddings LIMIT 1')
                row = cur.fetchone()
                if row and row[0]:
                    try:
                        md = json.loads(row[0])
                        if isinstance(md, dict) and 'dim' in md:
                            return int(md['dim'])
                    except Exception:
                        pass
                return None
            finally:
                try:
                    cur.close()
                except Exception:
                    pass

        cur = conn.cursor()
        cur.execute(
            """
            SELECT format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'embeddings' AND a.attname = 'vector' AND a.attnum > 0
            """
        )
        row = cur.fetchone()
        cur.close()
        if not row or not row[0]:
            return None
        s = row[0]  # e.g. "vector(768)"
        m = re.search(r"vector\((\d+)\)", s)
        return int(m.group(1)) if m else None
    except Exception as e:
        # likely running on SQLite or a DB without pg_attribute; return None to indicate unknown
        logging.getLogger(__name__).warning('Could not read vector dim from DB: %s', e)
        return None


def already_embedded(conn, problem_ids: List[int], kind: str, version: str) -> set:
    if not problem_ids:
        return set()
    cur = conn.cursor()
    # handle SQLite which doesn't support PostgreSQL's ANY
    try:
        if getattr(conn, '_is_sqlite', False):
            placeholders = ','.join(['%s'] * len(problem_ids))
            params = [kind, version] + list(problem_ids)
            q = f"SELECT problem_id FROM embeddings WHERE kind = %s AND embedding_version = %s AND problem_id IN ({placeholders})"
            cur.execute(q, params)
        else:
            cur.execute(
                "SELECT problem_id FROM embeddings WHERE kind = %s AND embedding_version = %s AND problem_id = ANY(%s)",
                (kind, version, problem_ids),
            )
    except Exception:
        # fallback: try a simple query per id (safe but slower)
        found = set()
        for pid in problem_ids:
            try:
                cur.execute('SELECT problem_id FROM embeddings WHERE kind = %s AND embedding_version = %s AND problem_id = %s', (kind, version, pid))
                r = cur.fetchone()
                if r:
                    found.add(r[0])
            except Exception:
                continue
        cur.close()
        return found
    rows = cur.fetchall()
    cur.close()
    return {r[0] for r in rows}


def bulk_insert_embeddings(
    conn,
    rows: List[Tuple[int, str, str, str, str]],
):
    """
    rows: [(problem_id, kind, embedding_version, vector_literal, metadata_json), ...]
    Uses ON CONFLICT DO NOTHING.
    """
    if not rows:
        return
    # SQLite doesn't support psycopg2.execute_values; use executemany there
    if getattr(conn, '_is_sqlite', False):
        cur = conn.cursor()
        # INSERT OR IGNORE approximates ON CONFLICT DO NOTHING in sqlite
        q = 'INSERT OR IGNORE INTO embeddings (problem_id, kind, embedding_version, vector, metadata) VALUES (%s,%s,%s,%s,%s)'
        cur.executemany(q, rows)
        conn.commit()
        cur.close()
        return

    cur = conn.cursor()
    sql = """
    INSERT INTO embeddings (problem_id, kind, embedding_version, vector, metadata)
    VALUES %s
    ON CONFLICT (problem_id, kind, embedding_version) DO NOTHING
    """
    execute_values(cur, sql, rows, template="(%s,%s,%s,%s,%s)")
    conn.commit()
    cur.close()


# -----------------------------
# Model + text preparation
# -----------------------------
def load_model() -> Tuple[SentenceTransformer, str]:
    # default to 768-dim multilingual model to match vector(768)
    model_name = os.environ.get(
        "SENTENCE_TRANSFORMER_MODEL",
        "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    )
    print("Loading embedding model:", model_name)
    model = SentenceTransformer(model_name, device="cpu")
    return model, model_name


def prepare_solution_outline(text: str) -> str:
    if not text:
        return ""
    # simple heuristic: find a marker and take a snippet
    for marker in ["解説", "解答", "方針", "方針：", "解:"]:
        idx = text.find(marker)
        if idx != -1:
            return text[idx : idx + 400].strip()
    return text.strip()[:250]


def prepare_latex_signature(text: str) -> str:
    if not text:
        return "no_latex"
    cmds = re.findall(r"\\[A-Za-z]+", text)
    if not cmds:
        if "$" in text or "\\(" in text or "\\[" in text:
            return "math_present"
        return "no_latex"
    uniq = sorted(set(cmds))
    return " ".join(uniq)[:500]


def vector_to_sql_literal(vec: List[float]) -> str:
    # pgvector accepts: '[0.1,0.2,...]'
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def encode_texts(model, texts: List[str], batch_size: int) -> "np.ndarray":
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        emb = model.encode(
            batch,
            batch_size=len(batch),
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        if isinstance(emb, list):
            emb = np.array(emb)
        all_embeddings.append(emb)
    return np.vstack(all_embeddings)


def fetch_problems(conn, ids: Optional[List[int]] = None) -> List[Dict]:
    cur = conn.cursor()
    if ids:
        if getattr(conn, '_is_sqlite', False):
            placeholders = ','.join(['%s'] * len(ids))
            q = f"SELECT id, stem, normalized_text, solution_outline, stem_latex,\n                   difficulty, difficulty_level, trickiness\n            FROM problems\n            WHERE id IN ({placeholders})"
            cur.execute(q, ids)
        else:
            cur.execute(
                """
                SELECT id, stem, normalized_text, solution_outline, stem_latex,
                       difficulty, difficulty_level, trickiness
                FROM problems
                WHERE id = ANY(%s)
                """,
                (ids,),
            )
    else:
        cur.execute(
            """
            SELECT id, stem, normalized_text, solution_outline, stem_latex,
                   difficulty, difficulty_level, trickiness
            FROM problems
            """
        )
    rows = cur.fetchall()
    cur.close()

    problems = []
    for r in rows:
        problems.append(
            {
                "id": int(r[0]),
                "stem": r[1] or "",
                "normalized_text": r[2] or "",
                "solution_outline": r[3] or "",
                "stem_latex": r[4] or "",
                "difficulty": float(r[5]) if r[5] is not None else None,
                "difficulty_level": int(r[6]) if r[6] is not None else None,
                "trickiness": float(r[7]) if r[7] is not None else None,
            }
        )
    return problems


def collect_kind_texts(problems: List[Dict], kind: str) -> Tuple[List[int], List[str], List[Dict]]:
    """
    Returns:
      ids_to_process, texts, metadata_per_row
    """
    ids: List[int] = []
    texts: List[str] = []
    metas: List[Dict] = []

    for p in problems:
        pid = p["id"]

        if kind == "stem":
            t = p["stem"]
            meta = {}

        elif kind == "normalized_text":
            t = p["normalized_text"] or normalize_numbers(p["stem"])
            meta = {}

        elif kind == "solution_outline":
            t = p["solution_outline"] or prepare_solution_outline(p["stem"])
            meta = {}

        elif kind == "latex_signature":
            sig_src = p.get("stem_latex") or p["stem"]
            t = prepare_latex_signature(sig_src)
            meta = {}

        elif kind == "difficulty":
            snippet = (p["normalized_text"] or normalize_numbers(p["stem"]))[:300]
            d = p.get("difficulty")
            lvl = p.get("difficulty_level")
            t = f"Difficulty: {d} Level: {lvl} Context: {snippet}"
            meta = {"difficulty": d, "difficulty_level": lvl}

        elif kind == "trickiness":
            snippet = (p["normalized_text"] or normalize_numbers(p["stem"]))[:300]
            tr = p.get("trickiness")
            t = f"Trickiness: {tr} Context: {snippet}"
            meta = {"trickiness": tr}

        else:
            raise ValueError(f"Unknown kind: {kind}")

        ids.append(pid)
        texts.append(t)
        metas.append(meta)

    return ids, texts, metas


def embed_ids(conn, ids: list, model=None, batch_size: int = None, version: str = None):
    """Embed problems with given ids using the same logic as `main`.
    Returns number of rows inserted (approx).
    """
    if not ids:
        return 0
    if batch_size is None:
        batch_size = int(os.environ.get("EMBEDDING_BATCH_SIZE", 32))
    if version is None:
        version = os.environ.get("EMBEDDING_VERSION", "v1")
    close_conn = False
    if conn is None:
        conn = get_db_conn()
        close_conn = True

    # Load model first so we can infer model dimension when DB doesn't provide it
    if model is None:
        model, model_name = load_model()
    else:
        try:
            model_name = model.__class__.__name__
        except Exception:
            model_name = 'model'

    try:
        model_dim = int(model.get_sentence_embedding_dimension())
    except Exception:
        test = model.encode(["test"], convert_to_numpy=True)
        model_dim = int(test.shape[1])

    # --- dimension check (DB vs model) ---
    db_dim = get_vector_dim_from_db(conn)
    if db_dim is None:
        logging.getLogger(__name__).warning('DB vector dimension unknown; assuming model dimension %s', model_dim)
        db_dim = model_dim

    if model_dim != db_dim:
        raise RuntimeError(
            f"Embedding dimension mismatch: DB expects vector({db_dim}) but model outputs dim={model_dim}."
        )

    problems = fetch_problems(conn, ids)
    if not problems:
        return 0

    kinds = [
        "stem",
        "normalized_text",
        "solution_outline",
        "latex_signature",
        "difficulty",
        "trickiness",
    ]

    total_inserted = 0
    all_problem_ids = [p["id"] for p in problems]

    for kind in kinds:
        existing = already_embedded(conn, all_problem_ids, kind, version)
        to_encode = [p for p in problems if p["id"] not in existing]
        if not to_encode:
            continue
        ids_to_process, texts, metas = collect_kind_texts(to_encode, kind)
        start_kind = time.time()
        embs = encode_texts(model, texts, batch_size=batch_size)
        encode_time = time.time() - start_kind
        rows = []
        for pid, vec, md in zip(ids_to_process, embs, metas):
            md2 = {
                **(md or {}),
                "model": model_name,
                "dim": model_dim,
                "kind": kind,
            }
            rows.append(
                (
                    int(pid),
                    kind,
                    version,
                    vector_to_sql_literal(vec.tolist()),
                    json.dumps(md2, ensure_ascii=False),
                )
            )
        # insert and log metrics
        inserted_before = len(rows)
        bulk_insert_embeddings(conn, rows)
        total_inserted += len(rows)
        insert_time = 0.0  # not measuring DB insert time precisely here
        metrics = {
            'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
            'model': model_name,
            'kind': kind,
            'version': version,
            'count': len(rows),
            'encode_seconds': encode_time,
        }
        _append_metrics_log(metrics)

    if close_conn:
        conn.close()
    return total_inserted


def _append_metrics_log(entry: dict, path: str = 'logs/embedding_metrics.log'):
    try:
        import os
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except Exception:
        # best-effort only
        pass


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--ids", type=str, help="comma separated problem ids")
    args = parser.parse_args()

    ids = None
    if args.ids:
        ids = [int(x) for x in args.ids.split(",") if x.strip()]

    conn = get_db_conn()

    # --- dimension check (DB vs model) ---
    db_dim = get_vector_dim_from_db(conn)
    if db_dim is None:
        raise RuntimeError("Could not read embeddings.vector dimension from DB (expected vector(N)).")

    model, model_name = load_model()

    # sentence-transformers has a helper for dimension
    try:
        model_dim = int(model.get_sentence_embedding_dimension())
    except Exception:
        # fallback
        test = model.encode(["test"], convert_to_numpy=True)
        model_dim = int(test.shape[1])

    if model_dim != db_dim:
        raise RuntimeError(
            f"Embedding dimension mismatch: DB expects vector({db_dim}) but model outputs dim={model_dim}.\n"
            f"- Option A: change SENTENCE_TRANSFORMER_MODEL to a {db_dim}-dim model.\n"
            f"- Option B: change DB schema to vector({model_dim}).\n"
            f"Current model: {model_name}"
        )

    problems = fetch_problems(conn, ids)
    if not problems:
        print("No problems found to embed")
        conn.close()
        return

    batch_size = int(os.environ.get("EMBEDDING_BATCH_SIZE", 32))
    version = os.environ.get("EMBEDDING_VERSION", "v1")

    kinds = [
        "stem",
        "normalized_text",
        "solution_outline",
        "latex_signature",
        "difficulty",
        "trickiness",
    ]

    all_problem_ids = [p["id"] for p in problems]

    for kind in kinds:
        existing = already_embedded(conn, all_problem_ids, kind, version)

        # filter problems to encode (skip existing)
        to_encode = [p for p in problems if p["id"] not in existing]
        if not to_encode:
            print(f"All problems already have embeddings kind={kind} version={version}")
            continue

        ids_to_process, texts, metas = collect_kind_texts(to_encode, kind)

        print(f"Encoding kind={kind} count={len(texts)} batch_size={batch_size}")
        embs = encode_texts(model, texts, batch_size=batch_size)

        # prepare bulk insert rows
        rows = []
        for pid, vec, md in zip(ids_to_process, embs, metas):
            md2 = {
                **(md or {}),
                "model": model_name,
                "dim": model_dim,
                "kind": kind,
            }
            rows.append(
                (
                    int(pid),
                    kind,
                    version,
                    vector_to_sql_literal(vec.tolist()),
                    json.dumps(md2, ensure_ascii=False),
                )
            )

        bulk_insert_embeddings(conn, rows)
        print(f"Inserted kind={kind} rows={len(rows)} (conflicts ignored)")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
