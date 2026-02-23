"""DB Editor API — Excelライクな直接編集UI用のCRUDエンドポイント。

セキュリティ:
- テーブル名はホワイトリスト制御
- カラム名はスキーマから取得した有効カラムのみ許可
- 値は全てパラメータバインド（SQLインジェクション防止）
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from backend.db import connect_db
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/db", tags=["db-editor"])

# 編集可能テーブルのホワイトリスト & 主キー情報
ALLOWED_TABLES = {
    "problems": {"pk": "id", "pk_type": "int"},
    "templates": {"pk": "id", "pk_type": "text"},
    "fields": {"pk": "id", "pk_type": "int"},
}


def _is_sqlite(conn) -> bool:
    """接続がSQLiteかどうかを判定"""
    return getattr(conn, '_is_sqlite', False)


def _get_columns(conn, table: str) -> List[Dict[str, Any]]:
    """テーブルのカラム情報を取得（SQLite / Postgres 両対応）"""
    cur = conn.cursor()
    cols = []
    try:
        if _is_sqlite(conn):
            # SQLite: PRAGMA table_info を使う
            cur.execute(f"PRAGMA table_info('{table}')")
            rows = cur.fetchall()
            for r in rows:
                cols.append({
                    "name": r[1], "type": r[2],
                    "notnull": bool(r[3]), "default": r[4], "pk": bool(r[5]),
                })
        else:
            # PostgreSQL: information_schema から取得
            cur.execute(
                "SELECT column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns WHERE table_name=%s "
                "ORDER BY ordinal_position",
                (table,),
            )
            for r in cur.fetchall():
                cols.append({
                    "name": r[0], "type": r[1],
                    "notnull": r[2] == "NO", "default": r[3], "pk": False,
                })
            # PK情報も取得
            try:
                cur.execute(
                    "SELECT kcu.column_name "
                    "FROM information_schema.table_constraints tc "
                    "JOIN information_schema.key_column_usage kcu "
                    "  ON tc.constraint_name = kcu.constraint_name "
                    "WHERE tc.table_name = %s AND tc.constraint_type = 'PRIMARY KEY'",
                    (table,),
                )
                pk_cols = {r[0] for r in cur.fetchall()}
                for col in cols:
                    if col["name"] in pk_cols:
                        col["pk"] = True
            except Exception:
                pass
    except Exception as e:
        # トランザクションをrollbackしてクリーンな状態に戻す
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"schema introspection failed: {e}")
    finally:
        try:
            cur.close()
        except Exception:
            pass
    return cols


def _validate_table(table: str):
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"table '{table}' is not allowed")


def _valid_column_names(conn, table: str) -> set:
    return {c["name"] for c in _get_columns(conn, table)}


@router.get("/tables")
def list_tables():
    """編集可能テーブル一覧"""
    return {"tables": [
        {"name": t, "pk": info["pk"], "pk_type": info["pk_type"]}
        for t, info in ALLOWED_TABLES.items()
    ]}


@router.get("/{table}/schema")
def get_table_schema(table: str):
    """テーブルのカラムスキーマを取得"""
    _validate_table(table)
    conn = connect_db()
    try:
        cols = _get_columns(conn, table)
        return {"table": table, "columns": cols, "pk": ALLOWED_TABLES[table]["pk"]}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"schema fetch failed: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.get("/{table}/rows")
def list_rows(
    table: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort: Optional[str] = Query(None),
    sort_dir: Optional[str] = Query("desc"),
    search: Optional[str] = Query(None),
):
    """ページネーション付き行取得"""
    _validate_table(table)
    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]
        cur = conn.cursor()

        # LIKE 演算子をDB種別で切り替え
        like_op = "LIKE" if _is_sqlite(conn) else "ILIKE"

        # COUNT
        if search and search.strip():
            # 全カラムに対するOR検索（TEXT系のみ）
            text_cols = [c["name"] for c in _get_columns(conn, table)
                         if any(t in (c.get("type") or "").upper()
                                for t in ("TEXT", "VARCHAR", "CHAR", "JSONB", "JSON"))]
            if text_cols:
                # JSONB カラムは ::text にキャストして検索
                clause_parts = []
                for c in text_cols:
                    col_schema = next((cs for cs in _get_columns(conn, table) if cs["name"] == c), None)
                    if col_schema and "JSONB" in (col_schema.get("type") or "").upper() and not _is_sqlite(conn):
                        clause_parts.append(f"{c}::text {like_op} %s")
                    else:
                        clause_parts.append(f"{c} {like_op} %s")
                where_clauses = " OR ".join(clause_parts)
                search_params = [f"%{search}%" for _ in text_cols]
                cur.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE {where_clauses}",
                    search_params,
                )
            else:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                search_params = []
                where_clauses = None
        else:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            where_clauses = None
            search_params = []

        total = cur.fetchone()[0]

        # ORDER BY
        order_col = pk
        if sort and sort in valid_cols:
            order_col = sort
        direction = "ASC" if sort_dir and sort_dir.lower() == "asc" else "DESC"

        # SELECT
        if where_clauses:
            q = f"SELECT * FROM {table} WHERE {where_clauses} ORDER BY {order_col} {direction} LIMIT %s OFFSET %s"
            cur.execute(q, search_params + [limit, offset])
        else:
            q = f"SELECT * FROM {table} ORDER BY {order_col} {direction} LIMIT %s OFFSET %s"
            cur.execute(q, (limit, offset))

        rows_raw = cur.fetchall()

        # カラム名取得 — スキーマ順をデフォルトとして使う
        schema_cols = _get_columns(conn, table)
        col_names = [c["name"] for c in schema_cols]
        try:
            # description から取得（PostgreSQL/SQLite cursor.description）
            if hasattr(cur, '_cur') and cur._cur.description:
                col_names = [d[0] for d in cur._cur.description]
            elif hasattr(cur, 'description') and cur.description:
                col_names = [d[0] for d in cur.description]
        except Exception:
            pass  # fallback: スキーマ順のまま

        rows = []
        for r in rows_raw:
            vals = list(r) if not isinstance(r, dict) else list(r.values())
            obj = {}
            for k, v in zip(col_names, vals):
                # JSON文字列をパース
                if isinstance(v, str) and v.strip() and (v.strip()[0] in ('{', '[')):
                    try:
                        obj[k] = json.loads(v)
                    except Exception:
                        obj[k] = v
                else:
                    obj[k] = v
            rows.append(obj)

        cur.close()
        return {"table": table, "total": total, "rows": rows, "limit": limit, "offset": offset}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.exception("list_rows failed for table %s", table)
        raise HTTPException(status_code=500, detail=f"data fetch failed: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


class RowUpdateRequest(BaseModel):
    data: Dict[str, Any]


@router.put("/{table}/rows/{row_id}")
def update_row(table: str, row_id: str, payload: RowUpdateRequest):
    """行更新（変更カラムのみ送信）"""
    _validate_table(table)
    if not payload.data:
        raise HTTPException(status_code=400, detail="no data to update")

    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]

        # PKは更新対象外
        update_data = {k: v for k, v in payload.data.items() if k in valid_cols and k != pk}
        if not update_data:
            raise HTTPException(status_code=400, detail="no valid columns to update")

        set_clauses = []
        params = []
        for col, val in update_data.items():
            set_clauses.append(f"{col} = %s")
            if isinstance(val, (dict, list)):
                params.append(json.dumps(val, ensure_ascii=False))
            else:
                params.append(val)

        # updated_at があれば自動更新
        if "updated_at" in valid_cols and "updated_at" not in update_data:
            set_clauses.append("updated_at = CURRENT_TIMESTAMP")

        pk_type = ALLOWED_TABLES[table]["pk_type"]
        pk_val = int(row_id) if pk_type == "int" else row_id
        params.append(pk_val)

        sql = f"UPDATE {table} SET {', '.join(set_clauses)} WHERE {pk} = %s"
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        cur.close()

        return {"status": "ok", "updated_id": row_id}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"update failed: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


class RowCreateRequest(BaseModel):
    data: Dict[str, Any]


@router.post("/{table}/rows")
def create_row(table: str, payload: RowCreateRequest):
    """新規行追加"""
    _validate_table(table)
    if not payload.data:
        raise HTTPException(status_code=400, detail="no data to insert")

    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]

        insert_data = {k: v for k, v in payload.data.items() if k in valid_cols}
        if not insert_data:
            raise HTTPException(status_code=400, detail="no valid columns to insert")

        columns = list(insert_data.keys())
        params = []
        for val in insert_data.values():
            if isinstance(val, (dict, list)):
                params.append(json.dumps(val, ensure_ascii=False))
            else:
                params.append(val)

        placeholders = ", ".join(["%s"] * len(columns))
        col_str = ", ".join(columns)

        # RETURNING 句で挿入されたIDを取得（Postgres）
        # SQLiteの場合は lastrowid を使う
        sql = f"INSERT INTO {table} ({col_str}) VALUES ({placeholders})"

        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()

        # 挿入IDの取得
        new_id = None
        try:
            if hasattr(cur, '_cur') and hasattr(cur._cur, 'lastrowid'):
                new_id = cur._cur.lastrowid
        except Exception:
            pass

        cur.close()
        return {"status": "ok", "inserted_id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"insert failed: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.delete("/{table}/rows/{row_id}")
def delete_row(table: str, row_id: str):
    """行削除"""
    _validate_table(table)
    conn = connect_db()
    try:
        pk = ALLOWED_TABLES[table]["pk"]
        pk_type = ALLOWED_TABLES[table]["pk_type"]
        pk_val = int(row_id) if pk_type == "int" else row_id

        cur = conn.cursor()
        cur.execute(f"DELETE FROM {table} WHERE {pk} = %s", (pk_val,))
        conn.commit()
        cur.close()

        return {"status": "ok", "deleted_id": row_id}
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"delete failed: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass
