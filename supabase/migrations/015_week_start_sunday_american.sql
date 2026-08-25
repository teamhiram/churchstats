-- 週の起点を月曜から日曜に変更（アメリカ式: 1/1を含む週を第1週、日曜始まり）
-- 既存の week_start（月曜日）を日曜日に変換する（1日戻す）
UPDATE group_meeting_records
SET week_start = week_start - 1;

UPDATE prayer_meeting_records
SET week_start = week_start - 1;

UPDATE organic_dispatch_records
SET week_start = week_start - 1;
