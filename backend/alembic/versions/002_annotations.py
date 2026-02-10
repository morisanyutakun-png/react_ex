"""add annotations table

Revision ID: 002_annotations
Revises: 001_init
Create Date: 2026-01-18
"""
from alembic import op
from sqlalchemy import text
import os

revision = '002_annotations'
down_revision = '001_init'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        op.execute("""
        CREATE TABLE IF NOT EXISTS annotations (
          id INTEGER PRIMARY KEY,
          segment_id INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          payload TEXT NOT NULL DEFAULT '{}',
          schema_version TEXT NOT NULL,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_latest INTEGER DEFAULT 1
        )
        """)
        op.execute('CREATE INDEX IF NOT EXISTS idx_annotations_segment_latest ON annotations (segment_id, is_latest)')
    else:
        # postgres raw SQL
        path = os.path.join(os.path.dirname(__file__), '..', '..', 'db', 'migrations', '002_annotations.sql')
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
        op.execute('DROP TABLE IF EXISTS annotations')
    else:
        pass
