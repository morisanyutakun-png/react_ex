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


# All ALTER TABLE statements inlined to avoid SQL comment/semicolon parsing issues
_PG_STATEMENTS = [
    # 004 — add problem columns
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS explanation TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS answer_brief TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS references_json TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION",
    # 005 — add expected_mistakes
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS expected_mistakes JSONB",
    # 006 — add raw_json
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS raw_text TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS raw_json JSONB",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS normalized_json JSONB",
    # 007 — add final_answer / checks
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS final_answer_text TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS final_answer_numeric DOUBLE PRECISION",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS checks_json TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS assumptions_json TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS selected_reference_json TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS solvable BOOLEAN",
    # extra columns used by insert_problem / ingest
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS normalized_text TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS schema_version TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS request_id TEXT",
    "ALTER TABLE problems ADD COLUMN IF NOT EXISTS page INTEGER",
]

_SQLITE_COLUMNS = [
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


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        conn = op.get_bind()
        for col_name, col_type in _SQLITE_COLUMNS:
            try:
                conn.execute(text(f'ALTER TABLE problems ADD COLUMN {col_name} {col_type}'))
            except Exception:
                pass  # column already exists
    else:
        conn = op.get_bind()
        for stmt in _PG_STATEMENTS:
            conn.execute(text(stmt))


def downgrade():
    pass  # not reversible safely
