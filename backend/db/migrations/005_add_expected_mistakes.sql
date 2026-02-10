-- Add expected_mistakes column to problems
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS expected_mistakes JSONB;

-- For compatibility with older local sqlite usage the server code will create a TEXT column when needed.
