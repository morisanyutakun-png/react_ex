-- Add annotations table for JSON-editable annotations tied to segments/problems
CREATE TABLE IF NOT EXISTS annotations (
  id SERIAL PRIMARY KEY,
  segment_id INT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  revision INT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}' ,
  schema_version VARCHAR NOT NULL,
  created_by VARCHAR NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_latest BOOLEAN DEFAULT TRUE
);

-- Ensure a segment+revision is unique (we always insert new revision rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_annotations_segment_revision_unique ON annotations (segment_id, revision);

-- Useful index for queries by segment and revision
CREATE INDEX IF NOT EXISTS idx_annotations_segment_revision ON annotations (segment_id, revision);

-- Partial index to quickly find the latest annotation per segment
CREATE INDEX IF NOT EXISTS idx_annotations_segment_is_latest ON annotations (segment_id) WHERE is_latest;
