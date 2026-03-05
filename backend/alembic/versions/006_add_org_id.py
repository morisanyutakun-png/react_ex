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

    for table in TABLES:
        try:
            if dialect == 'sqlite':
                op.execute(f"ALTER TABLE {table} ADD COLUMN org_id TEXT DEFAULT ''")
            else:
                op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT ''")
                # Index for fast per-org lookups
                op.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_org_id ON {table} (org_id)")
        except Exception:
            # Column may already exist
            pass


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    for table in TABLES:
        try:
            if dialect != 'sqlite':
                op.execute(f"DROP INDEX IF EXISTS idx_{table}_org_id")
                op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS org_id")
        except Exception:
            pass
