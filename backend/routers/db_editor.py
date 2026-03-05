"""DB Editor API — Excelライクな直接編集UI用のCRUDエンドポイント。

セキュリティ:
- テーブル名はホワイトリスト制御
- カラム名はスキーマから取得した有効カラムのみ許可
- 値は全てパラメータバインド（SQLインジェクション防止）
"""

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from backend.db import connect_db
import json
import logging

try:
    from backend.auth import optional_current_user
except Exception:
    try:
        from auth import optional_current_user  # type: ignore
    except Exception:
        optional_current_user = None

logger = logging.getLogger(__name__)

# 難易度推定ヘルパー (遅延インポート)
_difficulty_estimator = None

def _get_difficulty_estimator():
    global _difficulty_estimator
    if _difficulty_estimator is None:
        try:
            from workers.ingest.estimate_difficulty import estimate_difficulty_verbose
            _difficulty_estimator = estimate_difficulty_verbose
        except ImportError:
            logger.warning("estimate_difficulty not available")
            _difficulty_estimator = False  # sentinel: 利用不可
    return _difficulty_estimator if _difficulty_estimator else None

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


def _extract_org_id(request: Request) -> Optional[str]:
    """Extract org_id from JWT if available. Returns None for unauthenticated requests."""
    if optional_current_user is None:
        return None
    user = optional_current_user(request)
    if user and user.get('org_id'):
        return user['org_id']
    return None


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
    request: Request,
    table: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort: Optional[str] = Query(None),
    sort_dir: Optional[str] = Query("desc"),
    search: Optional[str] = Query(None),
):
    """ページネーション付き行取得"""
    _validate_table(table)
    org_id = _extract_org_id(request)
    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]
        cur = conn.cursor()

        # org_id フィルタ（テナント分離）
        has_org_col = "org_id" in valid_cols
        org_filter = ""
        org_params = []
        if org_id and has_org_col:
            org_filter = "org_id = %s"
            org_params = [org_id]

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
                where_clauses = "(" + " OR ".join(clause_parts) + ")"
                search_params = [f"%{search}%" for _ in text_cols]
                if org_filter:
                    where_clauses = f"{org_filter} AND {where_clauses}"
                    search_params = org_params + search_params
                cur.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE {where_clauses}",
                    search_params,
                )
            else:
                if org_filter:
                    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {org_filter}", org_params)
                else:
                    cur.execute(f"SELECT COUNT(*) FROM {table}")
                search_params = []
                where_clauses = None
        else:
            if org_filter:
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {org_filter}", org_params)
                where_clauses = org_filter
                search_params = list(org_params)
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
def update_row(request: Request, table: str, row_id: str, payload: RowUpdateRequest):
    """行更新（変更カラムのみ送信）"""
    _validate_table(table)
    if not payload.data:
        raise HTTPException(status_code=400, detail="no data to update")

    org_id = _extract_org_id(request)
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

        where = f"{pk} = %s"
        if org_id and "org_id" in valid_cols:
            where += " AND org_id = %s"
            params.append(org_id)

        sql = f"UPDATE {table} SET {', '.join(set_clauses)} WHERE {where}"
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
def create_row(request: Request, table: str, payload: RowCreateRequest):
    """新規行追加"""
    _validate_table(table)
    if not payload.data:
        raise HTTPException(status_code=400, detail="no data to insert")

    org_id = _extract_org_id(request)
    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]

        insert_data = {k: v for k, v in payload.data.items() if k in valid_cols}
        # Auto-inject org_id for tenant isolation
        if org_id and "org_id" in valid_cols:
            insert_data["org_id"] = org_id
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
def delete_row(request: Request, table: str, row_id: str):
    """行削除"""
    _validate_table(table)
    org_id = _extract_org_id(request)
    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]
        pk_type = ALLOWED_TABLES[table]["pk_type"]
        pk_val = int(row_id) if pk_type == "int" else row_id

        where = f"{pk} = %s"
        params = [pk_val]
        if org_id and "org_id" in valid_cols:
            where += " AND org_id = %s"
            params.append(org_id)

        cur = conn.cursor()
        cur.execute(f"DELETE FROM {table} WHERE {where}", params)
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


# ── スマート登録（最小フィールド → 自動補完） ──────────────

# RAGに最低限必要なフィールド定義
SMART_FIELDS = {
    "problems": {
        "required": [
            {"name": "subject", "label": "教科", "type": "select",
             "options": ["数学", "英語", "国語", "理科", "社会", "物理", "化学", "生物", "地学", "情報"],
             "help": "問題の教科を選択"},
            {"name": "topic", "label": "分野", "type": "dependent_select",
             "depends_on": "subject",
             "help": "教科に応じた分野を選択（カスタム入力も可）"},
            {"name": "stem", "label": "問題文", "type": "rich_textarea",
             "help": "問題のテキストを入力。数式は数式パレットから挿入できます。", "rows": 6},
            {"name": "answer_brief", "label": "答え", "type": "text",
             "help": "例: 42, (B), x=3 などの簡潔な答え"},
        ],
        "auto_fill": {
            "language": "ja",
            "origin": "manual",
        },
        "recommended": [
            {"name": "answer_json", "label": "正解データ", "type": "json",
             "help": '例: {"answer": "42"} or {"choices": ["A","B","C","D"], "correct": "B"}', "rows": 3},
            {"name": "choices_json", "label": "選択肢", "type": "json",
             "help": '例: ["(A) 12", "(B) 24", "(C) 36", "(D) 48"]', "rows": 3},
            {"name": "solution_outline", "label": "解法概要", "type": "textarea",
             "help": "解き方の要点・ステップ", "rows": 3},
            {"name": "explanation", "label": "詳細解説", "type": "textarea",
             "help": "生徒向けの詳しい解説", "rows": 4},
            {"name": "difficulty", "label": "難易度", "type": "slider",
             "min": 0, "max": 1, "step": 0.05, "default": 0.5,
             "help": "0.0(易)〜1.0(難)。RAGの類似度スコアリングに使用"},
            {"name": "difficulty_level", "label": "難易度レベル", "type": "select",
             "options": ["1", "2", "3", "4", "5"],
             "help": "1(基礎)〜5(発展)"},
            {"name": "trickiness", "label": "ひっかけ度", "type": "slider",
             "min": 0, "max": 1, "step": 0.05, "default": 0.3,
             "help": "0.0(素直)〜1.0(巧妙)。RAGのスコアリングに使用"},
        ],
        "optional": [
            {"name": "subtopic", "label": "サブトピック", "type": "text",
             "help": "例: 三角関数の微分"},
            {"name": "stem_latex", "label": "LaTeX版問題文", "type": "textarea",
             "help": "LaTeX形式の問題文（embedding精度向上に有効）", "rows": 4},
            {"name": "skill_type", "label": "スキルタイプ", "type": "text",
             "help": "例: 計算、読解、推論"},
            {"name": "format", "label": "問題形式", "type": "select",
             "options": ["multiple_choice", "short_answer", "essay", "fill_in", "true_false", "calculation"],
             "help": "問題の出題形式"},
            {"name": "concepts_json", "label": "関連概念", "type": "json",
             "help": '例: ["微分", "極限", "連続性"]', "rows": 2},
            {"name": "source", "label": "出典名", "type": "text",
             "help": "例: 2024年センター試験"},
            {"name": "source_page", "label": "出典ページ", "type": "number"},
            {"name": "est_time_sec", "label": "想定解答時間(秒)", "type": "number",
             "help": "例: 180"},
        ],
    }
}


@router.get("/smart-fields/{table}")
def get_smart_fields(table: str):
    """スマート登録用のフィールド定義を返す"""
    _validate_table(table)
    fields = SMART_FIELDS.get(table)
    if not fields:
        # テーブル固有定義がない場合はスキーマから自動生成
        conn = connect_db()
        try:
            cols = _get_columns(conn, table)
            pk = ALLOWED_TABLES[table]["pk"]
            auto_fields = []
            for c in cols:
                if c["name"] == pk:
                    continue
                f = {"name": c["name"], "label": c["name"], "type": "text",
                     "help": f'{c["type"]}'}
                if "json" in (c.get("type") or "").lower():
                    f["type"] = "json"
                    f["rows"] = 3
                elif "int" in (c.get("type") or "").lower():
                    f["type"] = "number"
                elif "bool" in (c.get("type") or "").lower():
                    f["type"] = "boolean"
                elif "float" in (c.get("type") or "").lower() or "double" in (c.get("type") or "").lower():
                    f["type"] = "number"
                auto_fields.append(f)
            return {"table": table, "required": auto_fields[:5], "recommended": auto_fields[5:10], "optional": auto_fields[10:]}
        finally:
            try:
                conn.close()
            except Exception:
                pass
    return {"table": table, **fields}


# ── 難易度推定エンドポイント ──────────────

class EstimateDifficultyRequest(BaseModel):
    stem: str
    answer: Optional[str] = ""


@router.post("/estimate-difficulty")
def estimate_difficulty_endpoint(payload: EstimateDifficultyRequest):
    """問題文（＋答え）から難易度・難易度レベル・ひっかけ度を自動推定する。

    フロントエンドでの入力補助: stem と answer を入力したら即座に呼び出す。
    """
    estimator = _get_difficulty_estimator()
    if estimator is None:
        raise HTTPException(
            status_code=501,
            detail="難易度推定モジュールが読み込めません"
        )

    # stem + answer を結合して推定（回答パートがあると solution_len 等が効く）
    full_text = (payload.stem or "").strip()
    if payload.answer:
        full_text += "\n\n解答: " + payload.answer.strip()

    try:
        diff, level, trick, details = estimator(full_text)
        return {
            "difficulty": round(diff, 4),
            "difficulty_level": level,
            "trickiness": round(trick, 4),
            "details": {
                "features": details.get("features", {}),
                "contributions": details.get("contributions", {}),
            },
        }
    except Exception as e:
        logger.exception("difficulty estimation failed")
        raise HTTPException(status_code=500, detail=f"推定エラー: {e}")


# ── スマート行追加（難易度自動計算付き） ──────────────

class SmartCreateRequest(BaseModel):
    data: Dict[str, Any]
    auto_difficulty: Optional[bool] = True


@router.post("/{table}/smart-create")
def smart_create_row(request: Request, table: str, payload: SmartCreateRequest):
    """行挿入 + 難易度自動計算。

    auto_difficulty=True の場合、stem が含まれていれば難易度を自動計算して
    difficulty / difficulty_level / trickiness を埋める。
    """
    _validate_table(table)
    if not payload.data:
        raise HTTPException(status_code=400, detail="no data to insert")

    data = dict(payload.data)

    # Auto-inject org_id for tenant isolation
    org_id = _extract_org_id(request)
    if org_id:
        data["org_id"] = org_id

    # 自動難易度計算
    difficulty_result = None
    if payload.auto_difficulty and table == "problems":
        stem = data.get("stem", "")
        answer = data.get("answer_brief", "")
        if stem and stem.strip():
            estimator = _get_difficulty_estimator()
            if estimator:
                try:
                    full_text = stem.strip()
                    if answer:
                        full_text += "\n\n解答: " + str(answer).strip()
                    diff, level, trick, details = estimator(full_text)
                    # ユーザが明示的に入力していなければ自動補完
                    if "difficulty" not in data or data["difficulty"] in (None, "", 0):
                        data["difficulty"] = round(diff, 4)
                    if "difficulty_level" not in data or data["difficulty_level"] in (None, "", 0):
                        data["difficulty_level"] = level
                    if "trickiness" not in data or data["trickiness"] in (None, "", 0):
                        data["trickiness"] = round(trick, 4)
                    difficulty_result = {
                        "difficulty": round(diff, 4),
                        "difficulty_level": level,
                        "trickiness": round(trick, 4),
                    }
                except Exception as e:
                    logger.warning("auto difficulty failed: %s", e)

    # auto_fill
    SMART = SMART_FIELDS.get(table, {})
    auto_fill = SMART.get("auto_fill", {})
    for k, v in auto_fill.items():
        if k not in data:
            data[k] = v

    conn = connect_db()
    try:
        valid_cols = _valid_column_names(conn, table)
        pk = ALLOWED_TABLES[table]["pk"]
        insert_data = {k: v for k, v in data.items() if k in valid_cols}
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
        sql = f"INSERT INTO {table} ({col_str}) VALUES ({placeholders})"

        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()

        new_id = None
        try:
            if hasattr(cur, '_cur') and hasattr(cur._cur, 'lastrowid'):
                new_id = cur._cur.lastrowid
        except Exception:
            pass

        cur.close()
        result = {"status": "ok", "inserted_id": new_id}
        if difficulty_result:
            result["difficulty_auto"] = difficulty_result
        return result

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
