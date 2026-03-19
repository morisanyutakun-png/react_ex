"""Add org_id column to data tables for multi-tenant isolation.

Revision ID: 006_add_org_id
Revises: 005_fix_ivfflat_opclass
Create Date: 2026-03-05
"""
from alembic import op
import sqlalchemy as sa

revision = '006_add_org_id'
down_revision = '005_fix_ivfflat_opclass'
branch_labels = None
depends_on = None

# Tables that need org_id for tenant isolation
TABLES = ['problems', 'templates', 'tuning_logs', 'generation_runs', 'generation_evals', 'usage_limits']


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'sqlite':
        for table in TABLES:
            try:
                op.execute(f"ALTER TABLE {table} ADD COLUMN org_id TEXT DEFAULT ''")
            except Exception:
                pass  # Column may already exist
    else:
        from sqlalchemy import text
        conn = op.get_bind()
        for table in TABLES:
            # Use SAVEPOINT so a failure (e.g. table does not exist) does not
            # abort the outer transaction on PostgreSQL.
            conn.execute(text("SAVEPOINT sp_org_id"))
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT ''"))
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{table}_org_id ON {table} (org_id)"))
                conn.execute(text("RELEASE SAVEPOINT sp_org_id"))
            except Exception:
                conn.execute(text("ROLLBACK TO SAVEPOINT sp_org_id"))


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != 'sqlite':
        from sqlalchemy import text
        conn = op.get_bind()
        for table in TABLES:
            conn.execute(text("SAVEPOINT sp_org_id_down"))
            try:
                conn.execute(text(f"DROP INDEX IF EXISTS idx_{table}_org_id"))
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN IF EXISTS org_id"))
                conn.execute(text("RELEASE SAVEPOINT sp_org_id_down"))
            except Exception:
                conn.execute(text("ROLLBACK TO SAVEPOINT sp_org_id_down"))
