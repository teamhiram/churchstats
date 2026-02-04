-- 祈りの集会（主日集会と同構造・地区単位、日付は小組集会と同様に週内で選択式）

-- 祈りの集会記録（地区・週ごとに1行。週は月曜日を week_start とする。実施日は週内で選択）
CREATE TABLE prayer_meeting_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  event_date DATE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(district_id, week_start)
);

CREATE INDEX idx_prayer_meeting_records_district_week ON prayer_meeting_records(district_id, week_start);
CREATE INDEX idx_prayer_meeting_records_week ON prayer_meeting_records(week_start);

-- 祈りの集会出欠（主日集会と同様：出欠・オンライン・他地方で出席・メモ）
CREATE TABLE prayer_meeting_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prayer_meeting_record_id UUID NOT NULL REFERENCES prayer_meeting_records(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  memo TEXT,
  is_online BOOLEAN DEFAULT false,
  is_away BOOLEAN DEFAULT false,
  reported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prayer_meeting_record_id, member_id)
);

CREATE INDEX idx_prayer_meeting_attendance_record ON prayer_meeting_attendance(prayer_meeting_record_id);
CREATE INDEX idx_prayer_meeting_attendance_member ON prayer_meeting_attendance(member_id);

ALTER TABLE prayer_meeting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prayer_meeting_records_select_authenticated" ON prayer_meeting_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "prayer_meeting_records_insert_reporter_above" ON prayer_meeting_records FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "prayer_meeting_records_update_reporter_above" ON prayer_meeting_records FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "prayer_meeting_records_delete_reporter_above" ON prayer_meeting_records FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "prayer_meeting_attendance_select_authenticated" ON prayer_meeting_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "prayer_meeting_attendance_insert_reporter_above" ON prayer_meeting_attendance FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "prayer_meeting_attendance_update_reporter_above" ON prayer_meeting_attendance FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "prayer_meeting_attendance_delete_reporter_above" ON prayer_meeting_attendance FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
