-- Backfill script for Postgres: populate explanation and answer_brief from metadata
BEGIN;

-- 1) metadata.explanation -> explanation
UPDATE problems
SET explanation = metadata->>'explanation'
WHERE explanation IS NULL
  AND metadata->>'explanation' IS NOT NULL;

-- 2) metadata.expected_mistakes (jsonb array) -> explanation (newline-joined)
WITH em AS (
  SELECT id, string_agg(elem, E'\n') AS txt
  FROM problems, jsonb_array_elements_text(metadata->'expected_mistakes') AS t(elem)
  WHERE metadata ? 'expected_mistakes'
  GROUP BY id
)
UPDATE problems p
SET explanation = em.txt
FROM em
WHERE p.id = em.id
  AND p.explanation IS NULL;

-- 3) metadata.answer_brief -> answer_brief
UPDATE problems
SET answer_brief = metadata->>'answer_brief'
WHERE answer_brief IS NULL
  AND metadata->>'answer_brief' IS NOT NULL;

-- 4) stem_latex -> answer_brief (fallback)
UPDATE problems
SET answer_brief = stem_latex
WHERE answer_brief IS NULL
  AND stem_latex IS NOT NULL;

-- 5) explanation -> answer_brief (short extraction)
UPDATE problems
SET answer_brief = LEFT(explanation, 1000)
WHERE answer_brief IS NULL
  AND explanation IS NOT NULL;

COMMIT;
