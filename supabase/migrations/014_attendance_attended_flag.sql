-- 出欠はトグルのみで判定。メモは記録するが集計には使わない。
-- attended = true: 出席, false: 欠席。トグルオフでもレコードは削除せず attended=false に更新する。

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT true;
ALTER TABLE prayer_meeting_attendance ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT true;
ALTER TABLE group_meeting_attendance ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT true;

-- 既存行で NULL の場合は出席扱いにする（マイグレーション適用前のレコードはすべて「出席」だった想定）
UPDATE attendance_records SET attended = true WHERE attended IS NULL;
UPDATE prayer_meeting_attendance SET attended = true WHERE attended IS NULL;
UPDATE group_meeting_attendance SET attended = true WHERE attended IS NULL;
