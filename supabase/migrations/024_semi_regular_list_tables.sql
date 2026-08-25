-- 準レギュラーリスト：レギュラー・プールと同様に明示的に管理する
-- regular_list に存在 = レギュラー
-- semi_regular_list に存在 = 準レギュラー
-- pool_list に存在 = プール
-- どれにも存在しない = 未設定（リスト外）

CREATE TABLE district_semi_regular_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(district_id, member_id)
);

CREATE INDEX idx_district_semi_regular_list_district ON district_semi_regular_list(district_id);
CREATE INDEX idx_district_semi_regular_list_member ON district_semi_regular_list(member_id);

COMMENT ON TABLE district_semi_regular_list IS '地区の準レギュラーリスト（枠組設定・名簿編集と連動）';

CREATE TABLE group_semi_regular_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, member_id)
);

CREATE INDEX idx_group_semi_regular_list_group ON group_semi_regular_list(group_id);
CREATE INDEX idx_group_semi_regular_list_member ON group_semi_regular_list(member_id);

COMMENT ON TABLE group_semi_regular_list IS '小組の準レギュラーリスト（枠組設定・名簿編集と連動）';

ALTER TABLE district_semi_regular_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_semi_regular_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_semi_regular_list_select_authenticated" ON district_semi_regular_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "district_semi_regular_list_insert_reporter_above" ON district_semi_regular_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "district_semi_regular_list_update_reporter_above" ON district_semi_regular_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "district_semi_regular_list_delete_reporter_above" ON district_semi_regular_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "group_semi_regular_list_select_authenticated" ON group_semi_regular_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_semi_regular_list_insert_reporter_above" ON group_semi_regular_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_semi_regular_list_update_reporter_above" ON group_semi_regular_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_semi_regular_list_delete_reporter_above" ON group_semi_regular_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
