"""apply migrations 004-007 SQL

Revision ID: 004_catchup
Revises: 003_generation_runs_and_evals
Create Date: 2026-02-12
"""
from alembic import op
from sqlalchemy import text
import os

revision = '004_catchup'
down_revision = '003_generation_runs_and_evals'
branch_labels = None
depends_on = None


def _run_sql_file(filename):
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'db', 'migrations', filename)
    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()
    conn = op.get_bind()
    for stmt in sql.split(';'):
        st = stmt.strip()
        if not st:
            continue
        conn.execute(text(st))


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        # SQLite has limited ALTER TABLE; add columns one by one, ignoring errors
        columns = [
            ('explanation', 'TEXT'),
            ('answer_brief', 'TEXT'),
            ('references_json', 'TEXT'),
            ('confidence', 'REAL'),
            ('expected_mistakes', 'TEXT'),
            ('raw_text', 'TEXT'),
            ('raw_json', 'TEXT'),
            ('normalized_json', 'TEXT'),
            ('normalized_text', 'TEXT'),
            ('final_answer_text', 'TEXT'),
            ('final_answer_numeric', 'REAL'),
            ('checks_json', 'TEXT'),
            ('assumptions_json', 'TEXT'),
            ('selected_reference_json', 'TEXT'),
            ('solvable', 'INTEGER'),
            ('schema_version', 'TEXT'),
            ('request_id', 'TEXT'),
            ('page', 'INTEGER'),
        ]
        conn = op.get_bind()
        for col_name, col_type in columns:
            try:
                conn.execute(text(f'ALTER TABLE problems ADD COLUMN {col_name} {col_type}'))
            except Exception:
                pass  # column already exists
    else:
        # Postgres: run SQL files 004-007
        for f in ['004_add_problem_columns.sql',
                   '005_add_expected_mistakes.sql',
                   '006_add_raw_json.sql',
                   '007_add_final_answer_checks.sql']:
            _run_sql_file(f)

        # Also add missing columns not in the SQL files
        extra_cols = [
            ('normalized_text', 'TEXT'),
            ('schema_version', 'TEXT'),
            ('request_id', 'TEXT'),
            ('page', 'INTEGER'),
        ]
        conn = op.get_bind()
        for col_name, col_type in extra_cols:
            try:
                conn.execute(text(f'ALTER TABLE problems ADD COLUMN IF NOT EXISTS {col_name} {col_type}'))
            except Exception:
                pass


def downgrade():
    pass  # not reversible safely
