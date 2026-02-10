-- Add columns to store LLM-extracted answers and metadata used for tuning/evaluation
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS final_answer_text TEXT;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS final_answer_numeric DOUBLE PRECISION;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS checks_json TEXT;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS assumptions_json TEXT;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS selected_reference_json TEXT;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS solvable BOOLEAN;
