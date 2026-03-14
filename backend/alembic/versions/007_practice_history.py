"""Add practice_sessions table for learning history tracking.

Stores per-problem results from practice sessions, including
user's self-score and subjective difficulty rating, to enable
personalized AI problem generation.

Revision ID: 007_practice_history
Revises: 006_add_org_id
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '007_practice_history'
down_revision = '006_add_org_id'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'sqlite':
        op.execute("""
            CREATE TABLE IF NOT EXISTS practice_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                topic TEXT,
                difficulty TEXT NOT NULL,
                problem_index INTEGER NOT NULL,
                stem_summary TEXT,
                score TEXT NOT NULL,
                earned_points INTEGER,
                max_points INTEGER,
                subjective_difficulty TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        op.execute("CREATE INDEX IF NOT EXISTS idx_ps_user ON practice_sessions(user_id)")
        op.execute("CREATE INDEX IF NOT EXISTS idx_ps_user_subject ON practice_sessions(user_id, subject)")
        op.execute("CREATE INDEX IF NOT EXISTS idx_ps_session ON practice_sessions(session_id)")
    else:
        op.execute("""
            CREATE TABLE IF NOT EXISTS practice_sessions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                topic TEXT,
                difficulty TEXT NOT NULL,
                problem_index INTEGER NOT NULL,
                stem_summary TEXT,
                score TEXT NOT NULL,
                earned_points INTEGER,
                max_points INTEGER,
                subjective_difficulty TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        op.execute("CREATE INDEX IF NOT EXISTS idx_ps_user ON practice_sessions(user_id)")
        op.execute("CREATE INDEX IF NOT EXISTS idx_ps_user_subject ON practice_sessions(user_id, subject)")
        op.execute("CREATE INDEX IF NOT EXISTS idx_ps_session ON practice_sessions(session_id)")


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    try:
        if dialect != 'sqlite':
            op.execute("DROP INDEX IF EXISTS idx_ps_session")
            op.execute("DROP INDEX IF EXISTS idx_ps_user_subject")
            op.execute("DROP INDEX IF EXISTS idx_ps_user")
        op.execute("DROP TABLE IF EXISTS practice_sessions")
    except Exception:
        pass
