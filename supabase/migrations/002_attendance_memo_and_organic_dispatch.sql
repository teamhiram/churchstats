-- 出欠メモ・有機的派遣用カラム・テーブル追加

-- 出席記録にメモ（欠席理由等）を追加
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS memo TEXT;

-- 出席記録のメモ更新を報告者以上に許可
CREATE POLICY "attendance_records_update_reporter_above" ON attendance_records FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

-- 有機的派遣: 派遣種類 enum
CREATE TYPE dispatch_type_enum AS ENUM ('message', 'phone', 'in_person');

-- 有機的派遣記録（小組・週ごとの名簿に対して派遣種類・日・メモを記録）
CREATE TABLE organic_dispatch_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  dispatch_type dispatch_type_enum,
  dispatch_date DATE,
  dispatch_memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, group_id, week_start)
);

CREATE INDEX idx_organic_dispatch_group_week ON organic_dispatch_records(group_id, week_start);
CREATE INDEX idx_organic_dispatch_member ON organic_dispatch_records(member_id);

ALTER TABLE organic_dispatch_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organic_dispatch_select_authenticated" ON organic_dispatch_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "organic_dispatch_insert_reporter_above" ON organic_dispatch_records FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "organic_dispatch_update_reporter_above" ON organic_dispatch_records FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "organic_dispatch_delete_reporter_above" ON organic_dispatch_records FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
