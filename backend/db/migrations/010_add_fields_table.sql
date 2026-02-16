-- 010: 分野テーブル（科目→分野の階層管理）
CREATE TABLE IF NOT EXISTS fields (
  id SERIAL PRIMARY KEY,
  field_code TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  field_name TEXT NOT NULL,
  parent_field_id INTEGER REFERENCES fields(id),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fields_subject ON fields(subject);
CREATE INDEX IF NOT EXISTS idx_fields_parent ON fields(parent_field_id);

-- problems テーブルに field_id カラムを追加
ALTER TABLE problems ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES fields(id);
CREATE INDEX IF NOT EXISTS idx_problems_field_id ON problems(field_id);

-- 既存データからフィールドをバックフィル
INSERT INTO fields (field_code, subject, field_name, description, metadata)
SELECT DISTINCT
  LOWER(REPLACE(REPLACE(CONCAT(subject, '_', COALESCE(topic, 'general')), ' ', '_'), '（', '_')),
  subject,
  CASE
    WHEN topic IS NOT NULL AND topic != '' THEN topic
    ELSE subject || '（全般）'
  END,
  CONCAT(subject, ' - ', COALESCE(topic, '全般')),
  jsonb_build_object('subject', subject, 'topic', COALESCE(topic, ''))
FROM problems
WHERE subject IS NOT NULL AND subject != ''
ON CONFLICT (field_code) DO NOTHING;

-- problems.field_id を自動設定
UPDATE problems p
SET field_id = f.id
FROM fields f
WHERE f.field_code = LOWER(REPLACE(REPLACE(CONCAT(p.subject, '_', COALESCE(p.topic, 'general')), ' ', '_'), '（', '_'))
  AND p.field_id IS NULL;
