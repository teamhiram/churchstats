-- 小組集会に実施日を追加（選択した週の範囲内の日付を記録）

ALTER TABLE group_meeting_records ADD COLUMN IF NOT EXISTS event_date DATE;
