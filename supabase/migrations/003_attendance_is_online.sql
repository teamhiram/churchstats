-- 主日集会の出欠に「オンライン」フラグを追加
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
