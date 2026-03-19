"""Create templates, latex_presets, and fields tables.

These tables were previously only in raw SQL migrations (008-010)
but had no corresponding Alembic revisions, so they were never
created when deploying via ``alembic upgrade head``.

Revision ID: 008_add_missing_tables
Revises: 007_practice_history
Create Date: 2026-03-19
"""
from alembic import op
from sqlalchemy import text

revision = '008_add_missing_tables'
down_revision = '007_practice_history'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    conn = bind

    if dialect == 'sqlite':
        # templates
        op.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                prompt TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        # latex_presets
        op.execute("""
            CREATE TABLE IF NOT EXISTS latex_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                preamble TEXT NOT NULL,
                document_wrapper TEXT,
                prompt_instruction TEXT,
                metadata TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        # fields
        op.execute("""
            CREATE TABLE IF NOT EXISTS fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                field_code TEXT UNIQUE NOT NULL,
                subject TEXT NOT NULL,
                field_name TEXT NOT NULL,
                parent_field_id INTEGER REFERENCES fields(id),
                description TEXT,
                metadata TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
    else:
        # -- templates (SQL 008) --
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                prompt TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)"
        ))

        # -- latex_presets (SQL 009) --
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS latex_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                preamble TEXT NOT NULL,
                document_wrapper TEXT,
                prompt_instruction TEXT,
                metadata JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))

        # -- fields (SQL 010) --
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fields (
                id SERIAL PRIMARY KEY,
                field_code TEXT UNIQUE NOT NULL,
                subject TEXT NOT NULL,
                field_name TEXT NOT NULL,
                parent_field_id INTEGER REFERENCES fields(id),
                description TEXT,
                metadata JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_fields_subject ON fields(subject)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_fields_parent ON fields(parent_field_id)"
        ))

        # Add field_id to problems
        conn.execute(text("SAVEPOINT sp_field_id"))
        try:
            conn.execute(text(
                "ALTER TABLE problems ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES fields(id)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_problems_field_id ON problems(field_id)"
            ))
            conn.execute(text("RELEASE SAVEPOINT sp_field_id"))
        except Exception:
            conn.execute(text("ROLLBACK TO SAVEPOINT sp_field_id"))

    # Insert default latex presets (Postgres only — uses JSONB)
    if dialect != 'sqlite':
        conn.execute(text("""
            INSERT INTO latex_presets (id, name, description, preamble, document_wrapper, prompt_instruction, metadata) VALUES
            ('exam', '試験問題', '定期テスト・入試形式（配点・解答欄付き）',
             '\\documentclass[12pt]{article}', '\\begin{document}\\maketitle __CONTENT__ \\end{document}',
             '試験問題形式でLaTeXコードを出力', '{"format_type": "exam"}'),
            ('worksheet', '学習プリント', '演習用ワークシート',
             '\\documentclass[12pt]{article}', '\\begin{document} __CONTENT__ \\end{document}',
             '学習プリント形式でLaTeXコードを出力', '{"format_type": "worksheet"}'),
            ('flashcard', '一問一答カード', 'フラッシュカード形式',
             '\\documentclass[12pt]{article}', '\\begin{document} __CONTENT__ \\end{document}',
             '一問一答カード形式でLaTeXコードを出力', '{"format_type": "flashcard"}'),
            ('mock_exam', '模試', '模擬試験形式',
             '\\documentclass[12pt]{article}', '\\begin{document} __CONTENT__ \\end{document}',
             '模擬試験形式でLaTeXコードを出力', '{"format_type": "mock_exam"}'),
            ('report', 'レポート・解説', '解説重視のレポート形式',
             '\\documentclass[12pt]{article}', '\\begin{document}\\maketitle __CONTENT__ \\end{document}',
             'レポート・解説形式でLaTeXコードを出力', '{"format_type": "report"}'),
            ('minimal', 'シンプル', '最小限のプレーンな形式',
             '\\documentclass[12pt]{article}', '\\begin{document} __CONTENT__ \\end{document}',
             'シンプルな形式でLaTeXコードを出力', '{"format_type": "minimal"}')
            ON CONFLICT (id) DO NOTHING
        """))


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != 'sqlite':
        conn = bind
        conn.execute(text("DROP INDEX IF EXISTS idx_problems_field_id"))
        conn.execute(text("SAVEPOINT sp_drop_field_id"))
        try:
            conn.execute(text("ALTER TABLE problems DROP COLUMN IF EXISTS field_id"))
            conn.execute(text("RELEASE SAVEPOINT sp_drop_field_id"))
        except Exception:
            conn.execute(text("ROLLBACK TO SAVEPOINT sp_drop_field_id"))

    op.execute("DROP TABLE IF EXISTS fields")
    op.execute("DROP TABLE IF EXISTS latex_presets")
    op.execute("DROP TABLE IF EXISTS templates")
