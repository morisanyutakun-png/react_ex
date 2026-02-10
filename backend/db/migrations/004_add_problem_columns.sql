-- Add missing columns used by insert_problem()
-- Safe for Postgres (uses IF NOT EXISTS) and harmless if already present.

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS explanation TEXT;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS answer_brief TEXT;

-- Store as TEXT to remain compatible with SQLite local development.
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS references_json TEXT;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;
