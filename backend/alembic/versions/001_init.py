"""init schema

Revision ID: 001_init
Revises: 
Create Date: 2026-01-18
"""
from alembic import op
import sqlalchemy as sa
import os
from sqlalchemy import text

revision = '001_init'
down_revision = None
branch_labels = None
depends_on = None


def _apply_postgres_sql(path):
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
        # create sqlite tables; problems table follows the new canonical DDL for local dev
        # Note: other tables are kept minimal for sqlite compatibility
        op.execute("""
        CREATE TABLE IF NOT EXISTS problems (
          id                      INTEGER PRIMARY KEY AUTOINCREMENT,
          subject                 TEXT NOT NULL,
          topic                   TEXT,
          subtopic                TEXT,
          language                TEXT NOT NULL DEFAULT 'ja',

          stem                    TEXT NOT NULL,
          stem_latex              TEXT,
          choices_json            TEXT,
          answer_json             TEXT,
          solution_outline        TEXT,
          explanation             TEXT,

          difficulty              REAL CHECK (difficulty BETWEEN 0.0 AND 1.0),
          difficulty_level        INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
          trickiness              REAL CHECK (trickiness BETWEEN 0.0 AND 1.0),

          concepts_json           TEXT,
          skill_type              TEXT,
          format                  TEXT,
          solution_archetype      TEXT,
          steps                   INTEGER CHECK (steps >= 0),

          structural_sim_target   REAL CHECK (structural_sim_target BETWEEN 0.0 AND 1.0),
          surface_sim_target      REAL CHECK (surface_sim_target BETWEEN 0.0 AND 1.0),
          parameter_dof           INTEGER CHECK (parameter_dof >= 0),

          trap_type               TEXT,
          wrong_patterns_json     TEXT,

          context_dependency      REAL CHECK (context_dependency BETWEEN 0.0 AND 1.0),
          span_locality           INTEGER CHECK (span_locality >= 1),
          noise_robustness        REAL CHECK (noise_robustness BETWEEN 0.0 AND 1.0),

          prerequisite_level      INTEGER CHECK (prerequisite_level BETWEEN 1 AND 5),
          learning_objective      TEXT,
          est_time_sec            INTEGER CHECK (est_time_sec >= 0),

          source                  TEXT,
          source_page             INTEGER,
          source_ref              TEXT,

          origin                  TEXT NOT NULL DEFAULT 'imported' CHECK (origin IN ('imported','generated','edited')),
          parent_problem_id       INTEGER,
          generator               TEXT,
          prompt_hash             TEXT,
          generation_seed         INTEGER,

          metadata_json           TEXT,

          created_at              TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """)

        op.execute("""
        CREATE INDEX IF NOT EXISTS idx_problems_subject_topic ON problems(subject, topic);
        """)

        op.execute("""
        CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty_level, difficulty, trickiness);
        """)

        op.execute("""
        CREATE INDEX IF NOT EXISTS idx_problems_archetype_format ON problems(solution_archetype, format);
        """)

        op.execute("""
        CREATE INDEX IF NOT EXISTS idx_problems_origin_parent ON problems(origin, parent_problem_id);
        """)

        op.execute("""
        CREATE INDEX IF NOT EXISTS idx_problems_trap ON problems(trap_type);
        """)

        op.execute("""
        CREATE TRIGGER IF NOT EXISTS trg_problems_updated_at
        AFTER UPDATE ON problems
        FOR EACH ROW
        BEGIN
          UPDATE problems SET updated_at = datetime('now') WHERE id = NEW.id;
        END;
        """)

        # minimal other tables kept for sqlite migrations
        op.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY,
          problem_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          embedding_version TEXT NOT NULL,
          vector BLOB,
          metadata TEXT DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
    else:
        # Postgres: run raw migration SQL
        path = os.path.join(os.path.dirname(__file__), '..', '..', 'db', 'migrations', '001_init.sql')
        _apply_postgres_sql(path)


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        op.execute('DROP TABLE IF EXISTS artifacts')
        op.execute('DROP TABLE IF EXISTS generation_runs')
        op.execute('DROP TABLE IF EXISTS rag_runs')
        op.execute('DROP TABLE IF EXISTS embeddings')
        op.execute('DROP TABLE IF EXISTS problems')
    else:
        # no-op for postgres downgrade here
        pass
