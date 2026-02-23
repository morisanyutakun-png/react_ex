"""fix: IVFFlat index on embeddings — explicitly specify vector_l2_ops opclass

Revision ID: 005_fix_ivfflat_opclass
Revises: 004_catchup
Create Date: 2026-02-23

The original idx_embeddings_vector_ivf index was created without an explicit
opclass.  pgvector defaults to vector_l2_ops (Euclidean / <-> operator), which
matches the queries already in use, so search results are correct.  This
migration makes the opclass explicit so that future index changes or operator
switches are immediately visible and auditable.

SQLite: no-op (pgvector extension is only available on Postgres).
"""
from alembic import op
from sqlalchemy import text

revision = '005_fix_ivfflat_opclass'
down_revision = '004_catchup'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'sqlite':
        return  # pgvector not available on SQLite

    conn = op.get_bind()
    # Drop the old index (without explicit opclass) and recreate with vector_l2_ops.
    # CONCURRENTLY is not supported inside a transaction, so we use plain DROP/CREATE.
    conn.execute(text("DROP INDEX IF EXISTS idx_embeddings_vector_ivf"))
    conn.execute(text(
        "CREATE INDEX idx_embeddings_vector_ivf "
        "ON embeddings USING ivfflat (vector vector_l2_ops) WITH (lists = 100)"
    ))


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'sqlite':
        return

    conn = op.get_bind()
    conn.execute(text("DROP INDEX IF EXISTS idx_embeddings_vector_ivf"))
    conn.execute(text(
        "CREATE INDEX idx_embeddings_vector_ivf "
        "ON embeddings USING ivfflat (vector) WITH (lists = 100)"
    ))
