-- 枠組設定で管理するレギュラーリスト（地区集会・小組集会の「欠席者」の母集団）
-- 週別集計の欠席者・ダッシュボードの派遣モニターはこのリストを基準にする

-- 地区集会レギュラーリスト（地区ごとに「主日のレギュラー出席者」を定義）
CREATE TABLE district_regular_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(district_id, member_id)
);

CREATE INDEX idx_district_regular_list_district ON district_regular_list(district_id);
CREATE INDEX idx_district_regular_list_member ON district_regular_list(member_id);

-- 小組集会レギュラーリスト（小組ごとに「小組のレギュラー出席者」を定義）
CREATE TABLE group_regular_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, member_id)
);

CREATE INDEX idx_group_regular_list_group ON group_regular_list(group_id);
CREATE INDEX idx_group_regular_list_member ON group_regular_list(member_id);

ALTER TABLE district_regular_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_regular_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_regular_list_select_authenticated" ON district_regular_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "district_regular_list_insert_admin_coadmin" ON district_regular_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "district_regular_list_update_admin_coadmin" ON district_regular_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "district_regular_list_delete_admin_coadmin" ON district_regular_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));

CREATE POLICY "group_regular_list_select_authenticated" ON group_regular_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_regular_list_insert_admin_coadmin" ON group_regular_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "group_regular_list_update_admin_coadmin" ON group_regular_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "group_regular_list_delete_admin_coadmin" ON group_regular_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
