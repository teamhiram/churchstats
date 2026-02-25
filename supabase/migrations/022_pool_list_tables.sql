-- プールリスト：レギュラー/準レギュラーに含まれない「待機メンバー」を管理
-- regular_list に存在 = レギュラー
-- pool_list に存在 = プール
-- どちらにも存在しない = 準レギュラー（デフォルト）

CREATE TABLE district_pool_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(district_id, member_id)
);

CREATE INDEX idx_district_pool_list_district ON district_pool_list(district_id);
CREATE INDEX idx_district_pool_list_member ON district_pool_list(member_id);

CREATE TABLE group_pool_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, member_id)
);

CREATE INDEX idx_group_pool_list_group ON group_pool_list(group_id);
CREATE INDEX idx_group_pool_list_member ON group_pool_list(member_id);

ALTER TABLE district_pool_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_pool_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_pool_list_select_authenticated" ON district_pool_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "district_pool_list_insert_reporter_above" ON district_pool_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "district_pool_list_update_reporter_above" ON district_pool_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "district_pool_list_delete_reporter_above" ON district_pool_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "group_pool_list_select_authenticated" ON group_pool_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_pool_list_insert_reporter_above" ON group_pool_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_pool_list_update_reporter_above" ON group_pool_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_pool_list_delete_reporter_above" ON group_pool_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
