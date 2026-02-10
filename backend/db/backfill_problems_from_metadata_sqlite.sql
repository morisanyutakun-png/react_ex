-- Backfill script for SQLite: populate explanation and answer_brief from metadata
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- 1) metadata.explanation -> explanation
UPDATE problems
SET explanation = json_extract(metadata, '$.explanation')
WHERE explanation IS NULL
  AND json_extract(metadata, '$.explanation') IS NOT NULL;

-- 2) metadata.expected_mistakes array -> explanation (group_concat with newline)
UPDATE problems
SET explanation = (
  SELECT group_concat(value, X'0A')
  FROM json_each(metadata, '$.expected_mistakes')
)
WHERE explanation IS NULL
  AND json_type(json_extract(metadata, '$.expected_mistakes')) = 'array';

-- 3) metadata.answer_brief -> answer_brief
UPDATE problems
SET answer_brief = json_extract(metadata, '$.answer_brief')
WHERE answer_brief IS NULL
  AND json_extract(metadata, '$.answer_brief') IS NOT NULL;

-- 4) stem_latex -> answer_brief
UPDATE problems
SET answer_brief = stem_latex
WHERE answer_brief IS NULL
  AND stem_latex IS NOT NULL;

-- 5) explanation -> answer_brief (short fallback)
UPDATE problems
SET answer_brief = substr(explanation, 1, 1000)
WHERE answer_brief IS NULL
  AND explanation IS NOT NULL;

COMMIT;
PRAGMA foreign_keys = ON;
