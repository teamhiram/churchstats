-- 出欠に「他地方で出席」フラグを追加（主日集会で使用）
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_away BOOLEAN DEFAULT false;
