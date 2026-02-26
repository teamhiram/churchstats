-- 多地方運用対応: 地域・グローバル/ローカル権限・同一人物紐づけのスキーマ
-- docs/multi-region-support-plan.md に基づく

-- 1) 地域（area）
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE
);

-- 2) localities に area_id を追加
ALTER TABLE localities
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_localities_area_id ON localities(area_id);

-- 3) グローバル権限用 enum と profiles 拡張
CREATE TYPE global_role_enum AS ENUM ('admin', 'national_viewer', 'regional_viewer');

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS global_role global_role_enum DEFAULT NULL;

COMMENT ON COLUMN profiles.global_role IS 'NULL = ローカル権限のみ。admin/national_viewer/regional_viewer でグローバル権限。';

-- 4) ローカル権限用 enum
CREATE TYPE local_role_enum AS ENUM ('local_admin', 'local_reporter', 'local_viewer');

-- 5) ユーザーがアクセス可能な地方
CREATE TABLE user_localities (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locality_id UUID NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, locality_id)
);
CREATE INDEX IF NOT EXISTS idx_user_localities_user_id ON user_localities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_localities_locality_id ON user_localities(locality_id);

-- 6) 地域閲覧者が閲覧可能な地域（regional_viewer 用）
CREATE TABLE user_areas (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, area_id)
);
CREATE INDEX IF NOT EXISTS idx_user_areas_user_id ON user_areas(user_id);

-- 7) 地方ごとのローカル役割
CREATE TABLE local_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locality_id UUID NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
  role local_role_enum NOT NULL,
  PRIMARY KEY (user_id, locality_id)
);
CREATE INDEX IF NOT EXISTS idx_local_roles_user_id ON local_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_local_roles_locality_id ON local_roles(locality_id);

-- 8) 同一人物紐づけ（管理者表示用のみ、名簿に影響しない）
CREATE TABLE member_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id_a UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_id_b UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT member_links_ordering CHECK (member_id_a < member_id_b),
  CONSTRAINT member_links_unique UNIQUE (member_id_a, member_id_b)
);
CREATE INDEX IF NOT EXISTS idx_member_links_member_id_a ON member_links(member_id_a);
CREATE INDEX IF NOT EXISTS idx_member_links_member_id_b ON member_links(member_id_b);

-- 9) 既存ユーザーの global_role を設定（admin / co_admin → admin）
UPDATE profiles
SET global_role = 'admin'::global_role_enum
WHERE role IN ('admin', 'co_admin')
  AND global_role IS NULL;

-- 10) ヘルパー: 現在ユーザーのグローバル権限
CREATE OR REPLACE FUNCTION public.get_my_global_role()
RETURNS global_role_enum AS $$
  SELECT global_role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 11) RLS 有効化（新規テーブル）
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_links ENABLE ROW LEVEL SECURITY;

-- 12) areas: 認証ユーザーは閲覧可、変更は global admin のみ
CREATE POLICY "areas_select_authenticated" ON areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_all_global_admin" ON areas FOR ALL TO authenticated
  USING (get_my_global_role() = 'admin');

-- 13) user_localities: 自分分は読める、編集は global admin のみ
CREATE POLICY "user_localities_select_own" ON user_localities FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR get_my_global_role() = 'admin');
CREATE POLICY "user_localities_insert_global_admin" ON user_localities FOR INSERT TO authenticated
  WITH CHECK (get_my_global_role() = 'admin');
CREATE POLICY "user_localities_update_global_admin" ON user_localities FOR UPDATE TO authenticated
  USING (get_my_global_role() = 'admin');
CREATE POLICY "user_localities_delete_global_admin" ON user_localities FOR DELETE TO authenticated
  USING (get_my_global_role() = 'admin');

-- 14) user_areas: 同上
CREATE POLICY "user_areas_select_own" ON user_areas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR get_my_global_role() = 'admin');
CREATE POLICY "user_areas_insert_global_admin" ON user_areas FOR INSERT TO authenticated
  WITH CHECK (get_my_global_role() = 'admin');
CREATE POLICY "user_areas_delete_global_admin" ON user_areas FOR DELETE TO authenticated
  USING (get_my_global_role() = 'admin');

-- 15) local_roles: 自分分は読める、編集は global admin のみ
CREATE POLICY "local_roles_select_own" ON local_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR get_my_global_role() = 'admin');
CREATE POLICY "local_roles_insert_global_admin" ON local_roles FOR INSERT TO authenticated
  WITH CHECK (get_my_global_role() = 'admin');
CREATE POLICY "local_roles_update_global_admin" ON local_roles FOR UPDATE TO authenticated
  USING (get_my_global_role() = 'admin');
CREATE POLICY "local_roles_delete_global_admin" ON local_roles FOR DELETE TO authenticated
  USING (get_my_global_role() = 'admin');

-- 16) member_links: global admin または link のいずれかの member の locality で local_admin なら可
--     （get_my_effective_role は後続マイグレーションで定義するため、ここでは global admin のみ許可）
CREATE POLICY "member_links_select_global_admin" ON member_links FOR SELECT TO authenticated
  USING (get_my_global_role() = 'admin');
CREATE POLICY "member_links_insert_global_admin" ON member_links FOR INSERT TO authenticated
  WITH CHECK (get_my_global_role() = 'admin');
CREATE POLICY "member_links_delete_global_admin" ON member_links FOR DELETE TO authenticated
  USING (get_my_global_role() = 'admin');
