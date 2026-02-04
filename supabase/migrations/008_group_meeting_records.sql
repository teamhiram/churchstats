-- 小組集会を専用テーブルに記録（meetings + attendance_records の代わり）

-- 小組集会記録（小組・週ごとに1行。週は月曜日を week_start とする）
CREATE TABLE group_meeting_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, week_start)
);

CREATE INDEX idx_group_meeting_records_group_week ON group_meeting_records(group_id, week_start);
CREATE INDEX idx_group_meeting_records_week ON group_meeting_records(week_start);

-- 小組集会出欠（誰がどの小組集会に出席したか）
CREATE TABLE group_meeting_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_meeting_record_id UUID NOT NULL REFERENCES group_meeting_records(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  memo TEXT,
  reported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_meeting_record_id, member_id)
);

CREATE INDEX idx_group_meeting_attendance_record ON group_meeting_attendance(group_meeting_record_id);
CREATE INDEX idx_group_meeting_attendance_member ON group_meeting_attendance(member_id);

ALTER TABLE group_meeting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_meeting_records_select_authenticated" ON group_meeting_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_meeting_records_insert_reporter_above" ON group_meeting_records FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_meeting_records_update_reporter_above" ON group_meeting_records FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_meeting_records_delete_reporter_above" ON group_meeting_records FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "group_meeting_attendance_select_authenticated" ON group_meeting_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_meeting_attendance_insert_reporter_above" ON group_meeting_attendance FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_meeting_attendance_update_reporter_above" ON group_meeting_attendance FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_meeting_attendance_delete_reporter_above" ON group_meeting_attendance FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
