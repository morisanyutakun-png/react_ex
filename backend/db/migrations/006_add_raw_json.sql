-- Add raw_text/raw_json/normalized_json columns to problems
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- Use JSONB for Postgres; for sqlite this will be ignored and compatible TEXT used by server logic
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS raw_json JSONB;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS normalized_json JSONB;

-- Index raw_json may be added later if needed
