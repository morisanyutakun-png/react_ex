"""add generation runs/evals

Revision ID: 003_generation_runs_and_evals
Revises: 002_annotations
Create Date: 2026-01-18
"""
from alembic import op
from sqlalchemy import text
import os

revision = '003_generation_runs_and_evals'
down_revision = '002_annotations'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        # alter table generation_runs: add columns if not exists (sqlite has limited ALTER support)
        # For simplicity, create a temp table if needed
        op.execute("""
        CREATE TABLE IF NOT EXISTS generation_runs (
          id INTEGER PRIMARY KEY,
          rag_run_id INTEGER,
          generator_config TEXT,
          target_difficulty REAL,
          actual_difficulty REAL,
          status TEXT,
          error_text TEXT,
          artifacts TEXT,
          input_params TEXT DEFAULT '{}',
          retrieved_segment_ids TEXT,
          output_text TEXT,
          model_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        op.execute("""
        CREATE TABLE IF NOT EXISTS generation_evals (
          id INTEGER PRIMARY KEY,
          run_id INTEGER NOT NULL,
          axes TEXT DEFAULT '{}',
          overall INTEGER,
          notes TEXT,
          is_usable INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
    else:
        # Postgres: run existing SQL migration
        path = os.path.join(os.path.dirname(__file__), '..', '..', 'db', 'migrations', '003_generation_runs_and_evals.sql')
        with open(path, 'r', encoding='utf-8') as f:
            sql = f.read()
        conn = op.get_bind()
        for stmt in sql.split(';'):
            st = stmt.strip()
            if not st:
                continue
            conn.execute(text(st))


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        op.execute('DROP TABLE IF EXISTS generation_evals')
        op.execute('DROP TABLE IF EXISTS generation_runs')
    else:
        pass
