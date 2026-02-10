-- Initialize extensions and base schema for exam-gen
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-----------------------------------------------------------------
-- problems table (one problem per row) - canonical DDL
-----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problems (
  id                      SERIAL PRIMARY KEY,

  -- classification
  subject                 TEXT NOT NULL,
  topic                   TEXT,
  subtopic                TEXT,
  language                TEXT NOT NULL DEFAULT 'ja',

  -- content
  stem                    TEXT NOT NULL,
  stem_latex              TEXT,
  choices_json            JSONB,
  answer_json             JSONB,
  solution_outline        TEXT,
  explanation             TEXT,

  -- internal vectors/controls
  difficulty              DOUBLE PRECISION CHECK (difficulty BETWEEN 0.0 AND 1.0),
  difficulty_level        SMALLINT CHECK (difficulty_level BETWEEN 1 AND 5),
  trickiness              DOUBLE PRECISION CHECK (trickiness BETWEEN 0.0 AND 1.0),

  concepts_json           JSONB,
  skill_type              TEXT,
  format                  TEXT,
  solution_archetype      TEXT,
  steps                   INTEGER CHECK (steps >= 0),

  -- similarity targets
  structural_sim_target   DOUBLE PRECISION CHECK (structural_sim_target BETWEEN 0.0 AND 1.0),
  surface_sim_target      DOUBLE PRECISION CHECK (surface_sim_target BETWEEN 0.0 AND 1.0),
  parameter_dof           INTEGER CHECK (parameter_dof >= 0),

  trap_type               TEXT,
  wrong_patterns_json     JSONB,

  context_dependency      DOUBLE PRECISION CHECK (context_dependency BETWEEN 0.0 AND 1.0),
  span_locality           INTEGER CHECK (span_locality >= 1),
  noise_robustness        DOUBLE PRECISION CHECK (noise_robustness BETWEEN 0.0 AND 1.0),

  prerequisite_level      SMALLINT CHECK (prerequisite_level BETWEEN 1 AND 5),
  learning_objective      TEXT,
  est_time_sec            INTEGER CHECK (est_time_sec >= 0),

  source                  TEXT,
  source_page             INTEGER,
  source_ref              TEXT,

  origin                  TEXT NOT NULL DEFAULT 'imported' CHECK (origin IN ('imported','generated','edited')),
  parent_problem_id       INTEGER REFERENCES problems(id),
  generator               TEXT,
  prompt_hash             TEXT,
  generation_seed         INTEGER,

  metadata_json           JSONB,

  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problems_subject_topic ON problems(subject, topic);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty_level, difficulty, trickiness);
CREATE INDEX IF NOT EXISTS idx_problems_archetype_format ON problems(solution_archetype, format);
CREATE INDEX IF NOT EXISTS idx_problems_origin_parent ON problems(origin, parent_problem_id);
CREATE INDEX IF NOT EXISTS idx_problems_trap ON problems(trap_type);

-----------------------------------------------------------------
-- embeddings: one per (problem, kind, version)
-----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embeddings (
  id SERIAL PRIMARY KEY,
  problem_id INT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  kind VARCHAR NOT NULL,
  embedding_version VARCHAR NOT NULL,
  vector vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (problem_id, kind, embedding_version)
);

-- IVFFlat index for vector similarity (lists may be tuned)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ivf ON embeddings USING ivfflat (vector) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_embeddings_kind ON embeddings (kind);

-----------------------------------------------------------------
-- rag_runs: logs of retrieval runs
-----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_runs (
  id SERIAL PRIMARY KEY,
  profile JSONB,
  query_text TEXT,
  filters JSONB,
  topk_candidates JSONB,
  selected_ids INT[],
  runtime_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-----------------------------------------------------------------
-- generation_runs: logs for generation attempts
-----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generation_runs (
  id SERIAL PRIMARY KEY,
  rag_run_id INT REFERENCES rag_runs(id) ON DELETE SET NULL,
  generator_config JSONB,
  target_difficulty DOUBLE PRECISION,
  actual_difficulty DOUBLE PRECISION,
  status VARCHAR,
  error_text TEXT,
  artifacts JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-----------------------------------------------------------------
-- artifacts
-----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifacts (
  id SERIAL PRIMARY KEY,
  generation_run_id INT REFERENCES generation_runs(id) ON DELETE CASCADE,
  type VARCHAR,
  path TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
