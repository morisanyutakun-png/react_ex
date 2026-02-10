-- SQLite schema for local development (adapted from Postgres DDL)
-- Covers: problems, embeddings (text), rag_runs, generation_runs,
--         generation_evals, annotations, tuning_logs

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─────────────────────────────────────────────
-- problems
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL DEFAULT 'general',
  topic TEXT,
  subtopic TEXT,
  language TEXT NOT NULL DEFAULT 'ja',
  stem TEXT NOT NULL,
  stem_latex TEXT,
  choices_json TEXT,
  answer_json TEXT,
  solution_outline TEXT,
  explanation TEXT,
  difficulty REAL,
  difficulty_level INTEGER,
  trickiness REAL,
  concepts_json TEXT,
  skill_type TEXT,
  format TEXT,
  solution_archetype TEXT,
  steps INTEGER,
  structural_sim_target REAL,
  surface_sim_target REAL,
  parameter_dof INTEGER,
  trap_type TEXT,
  wrong_patterns_json TEXT,
  context_dependency REAL,
  span_locality INTEGER,
  noise_robustness REAL,
  prerequisite_level INTEGER,
  learning_objective TEXT,
  est_time_sec INTEGER,
  source TEXT,
  source_page INTEGER,
  source_ref TEXT,
  origin TEXT NOT NULL DEFAULT 'imported',
  parent_problem_id INTEGER,
  generator TEXT,
  prompt_hash TEXT,
  generation_seed INTEGER,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  normalized_text TEXT,
  page INTEGER,
  answer_brief TEXT,
  references_json TEXT,
  expected_mistakes TEXT,
  confidence REAL,
  raw_text TEXT,
  raw_json TEXT,
  normalized_json TEXT,
  schema_version TEXT,
  request_id TEXT,
  final_answer_text TEXT,
  final_answer_numeric REAL,
  checks_json TEXT,
  assumptions_json TEXT,
  selected_reference_json TEXT,
  solvable INTEGER
);

CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty_level, difficulty, trickiness);
CREATE INDEX IF NOT EXISTS idx_problems_subject_topic ON problems(subject, topic);
CREATE INDEX IF NOT EXISTS idx_problems_origin_parent ON problems(origin, parent_problem_id);
CREATE INDEX IF NOT EXISTS idx_problems_trap ON problems(trap_type);

-- ─────────────────────────────────────────────
-- embeddings (text blob for SQLite; no vector type)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  embedding_version TEXT NOT NULL,
  vector TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(problem_id, kind, embedding_version)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_kind ON embeddings(kind);

-- ─────────────────────────────────────────────
-- rag_runs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile TEXT,
  query_text TEXT,
  filters TEXT,
  topk_candidates TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- generation_runs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rag_run_id INTEGER REFERENCES rag_runs(id),
  input_params TEXT DEFAULT '{}',
  retrieved_segment_ids TEXT,
  output_text TEXT,
  model_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- generation_evals
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_evals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  axes TEXT DEFAULT '{}',
  overall INTEGER,
  notes TEXT,
  is_usable INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- annotations
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  payload TEXT DEFAULT '{}',
  schema_version TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_latest INTEGER DEFAULT 1
);

-- ─────────────────────────────────────────────
-- tuning_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tuning_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT,
  model_name TEXT,
  model_output TEXT,
  expected_output TEXT,
  score REAL,
  notes TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- admin_jobs (background task tracking)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT DEFAULT '{}',
  result TEXT,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
