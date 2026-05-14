#!/usr/bin/env python3
"""DB クリアスクリプト

ユーザコンテンツ（problems / annotations）と RAG 系のシステムログ
（rag_runs / generation_runs / generation_evals / embeddings / artifacts）
を削除する。テンプレート（templates）と LaTeX プリセット（latex_presets）
は設定データのため保持。

使い方:
    python -m backend.scripts.clear_db [--all] [--include-templates] [--dry-run]

オプション:
    --all                  user content + system logs を全削除（既定）
    --include-templates    templates / latex_presets / fields も削除
    --dry-run              実際の DELETE を実行せず削除予定件数だけ表示
"""
from __future__ import annotations

import argparse
import os
import sys

# このスクリプトは `python -m backend.scripts.clear_db` で動かす想定
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.db import connect_db  # noqa: E402

# 削除対象テーブル（依存関係順）
USER_CONTENT_TABLES = [
    'annotations',
    'generation_evals',
    'generation_runs',
    'rag_runs',
    'embeddings',
    'artifacts',
    'problems',
]

CONFIG_TABLES = [
    'templates',
    'latex_presets',
    'fields',
]


def _table_exists(cur, table: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        return cur.fetchone() is not None
    cur.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_name=%s",
        (table,),
    )
    return cur.fetchone() is not None


def _row_count(cur, table: str) -> int:
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    row = cur.fetchone()
    return int(row[0]) if row else 0


def _delete_all(cur, table: str, is_sqlite: bool) -> None:
    if is_sqlite:
        cur.execute(f"DELETE FROM {table}")
    else:
        cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")


def main() -> int:
    ap = argparse.ArgumentParser(description='DB をクリアする')
    ap.add_argument('--include-templates', action='store_true',
                    help='templates / latex_presets / fields も削除')
    ap.add_argument('--dry-run', action='store_true',
                    help='実際の DELETE を実行せず件数のみ表示')
    args = ap.parse_args()

    conn = connect_db()
    is_sqlite = getattr(conn, '_is_sqlite', False)
    cur = conn.cursor()

    targets = list(USER_CONTENT_TABLES)
    if args.include_templates:
        targets += CONFIG_TABLES

    print(f"=== DB クリア ({'DRY RUN' if args.dry_run else '実行'}) ===")
    print(f"バックエンド: {'SQLite' if is_sqlite else 'PostgreSQL'}")
    print(f"対象テーブル: {len(targets)} 件")
    print()

    total_deleted = 0
    for tbl in targets:
        if not _table_exists(cur, tbl, is_sqlite):
            print(f"  [skip] {tbl}: テーブルが存在しません")
            continue
        try:
            before = _row_count(cur, tbl)
        except Exception as e:
            print(f"  [warn] {tbl}: 件数取得失敗 ({e})")
            continue

        if before == 0:
            print(f"  [skip] {tbl}: 既に空")
            continue

        if args.dry_run:
            print(f"  [dry ] {tbl}: {before} 件削除予定")
            total_deleted += before
            continue

        try:
            _delete_all(cur, tbl, is_sqlite)
            conn.commit()
            print(f"  [ok  ] {tbl}: {before} 件削除")
            total_deleted += before
        except Exception as e:
            print(f"  [fail] {tbl}: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
            return 1

    if not args.dry_run:
        conn.commit()
    cur.close()
    conn.close()

    print()
    print(f"合計 {total_deleted} 件{'削除予定' if args.dry_run else '削除しました'}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
