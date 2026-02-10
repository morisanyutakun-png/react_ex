-- Add additional columns to generation_runs and create generation_evals
ALTER TABLE generation_runs
  ADD COLUMN IF NOT EXISTS input_params JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retrieved_segment_ids INT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS output_text TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS model_name VARCHAR DEFAULT NULL;

CREATE TABLE IF NOT EXISTS generation_evals (
  id SERIAL PRIMARY KEY,
  run_id INT NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  axes JSONB DEFAULT '{}'::jsonb,
  overall SMALLINT,
  notes TEXT,
  is_usable BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_evals_run_id ON generation_evals (run_id);
