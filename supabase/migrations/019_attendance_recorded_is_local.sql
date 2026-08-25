-- attendance_records に recorded_is_local を追加
-- 既存レコードは名簿の現時点の is_local を以って backfill する

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS recorded_is_local BOOLEAN;

-- 既存レコード: NULL → 名簿の is_local で補完
UPDATE attendance_records ar
SET recorded_is_local = m.is_local
FROM members m
WHERE ar.member_id = m.id
  AND ar.recorded_is_local IS NULL;

COMMENT ON COLUMN attendance_records.recorded_is_local IS '記録時点でのローカル判定（名簿の is_local を記録）';
