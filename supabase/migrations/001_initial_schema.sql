-- 召会生活統計システム (spec5) 初期スキーマ
-- Supabase SQL Editor で実行するか、supabase db push で適用

-- 拡張
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ① 組織・グループ系
CREATE TABLE localities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL
);

CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locality_id UUID NOT NULL REFERENCES localities(id) ON DELETE RESTRICT,
  name TEXT NOT NULL
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL
);

-- ② 集会
CREATE TYPE meeting_type_enum AS ENUM ('main', 'group');

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date DATE NOT NULL,
  meeting_type meeting_type_enum NOT NULL,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meetings_event_date ON meetings(event_date);
CREATE INDEX idx_meetings_district_id ON meetings(district_id);
CREATE INDEX idx_meetings_group_id ON meetings(group_id);

-- ③ メンバー
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
CREATE TYPE category_enum AS ENUM ('adult', 'university', 'high_school', 'junior_high', 'elementary', 'child');
CREATE TYPE baptism_precision_enum AS ENUM ('exact', 'unknown', 'approximate');

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  gender gender_enum NOT NULL DEFAULT 'other',
  is_local BOOLEAN NOT NULL DEFAULT true,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  current_category category_enum,
  is_baptized BOOLEAN NOT NULL DEFAULT false,
  baptism_year INT,
  baptism_month INT,
  baptism_day INT,
  baptism_date_precision baptism_precision_enum,
  language_main TEXT,
  language_sub TEXT,
  follower_id UUID REFERENCES members(id) ON DELETE SET NULL,
  vital_group_member_ids JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_members_district_id ON members(district_id);
CREATE INDEX idx_members_group_id ON members(group_id);

-- ④ レギュラーメンバーリスト
CREATE TABLE regular_member_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(meeting_id, member_id)
);

CREATE INDEX idx_rmli_meeting_id ON regular_member_list_items(meeting_id);

-- ⑤ 出席記録
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recorded_category category_enum,
  recorded_is_baptized BOOLEAN,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  reported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meeting_id, member_id)
);

CREATE INDEX idx_attendance_meeting_id ON attendance_records(meeting_id);
CREATE INDEX idx_attendance_member_id ON attendance_records(member_id);

-- ⑥ プロファイル（Supabase Auth 連携）
CREATE TYPE role_enum AS ENUM ('admin', 'co_admin', 'reporter', 'viewer');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role role_enum NOT NULL DEFAULT 'viewer',
  full_name TEXT,
  main_district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reporter_districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  UNIQUE(user_id, district_id)
);

CREATE INDEX idx_reporter_districts_user_id ON reporter_districts(user_id);

-- ⑦ 履歴
CREATE TYPE attribute_history_type_enum AS ENUM ('category', 'baptism');

CREATE TABLE attribute_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  attribute_type attribute_history_type_enum NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attr_hist_member_id ON attribute_histories(member_id);

-- システム設定（欠席アラート X など）
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 監査ログ
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ログインログ
CREATE TABLE login_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_logs_created_at ON login_logs(created_at);

-- profiles 自動作成（auth.users 挿入時）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (NEW.id, NEW.email, 'viewer', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS 有効化
ALTER TABLE localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE regular_member_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporter_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- ロール取得ヘルパー
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 閲覧者以上: 全テーブル SELECT（統計・名簿閲覧）
-- 報告者以上: 集会・出席・レギュラーメンバーリスト・小組名簿の追加削除
-- 共同管理者以上: 組織・小組設定・ユーザー管理（管理者は自分以外）
-- 管理者: 全て

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin_coadmin" ON profiles FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "localities_select_authenticated" ON localities FOR SELECT TO authenticated USING (true);
CREATE POLICY "localities_all_admin_coadmin" ON localities FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));

CREATE POLICY "districts_select_authenticated" ON districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "districts_all_admin_coadmin" ON districts FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));

CREATE POLICY "groups_select_authenticated" ON groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert_delete_admin_coadmin" ON groups FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "groups_insert_delete_admin_coadmin2" ON groups FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "groups_update_admin_coadmin_reporter" ON groups FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "meetings_select_authenticated" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert_reporter_above" ON meetings FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "meetings_update_reporter_above" ON meetings FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "members_select_authenticated" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert_reporter_above" ON members FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "members_update_reporter_above" ON members FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "regular_member_list_items_select_authenticated" ON regular_member_list_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "regular_member_list_items_all_reporter_above" ON regular_member_list_items FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "attendance_records_select_authenticated" ON attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_records_insert_reporter_above" ON attendance_records FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "attendance_records_delete_reporter_above" ON attendance_records FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "reporter_districts_select_own" ON reporter_districts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reporter_districts_admin_coadmin" ON reporter_districts FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));

CREATE POLICY "attribute_histories_select_authenticated" ON attribute_histories FOR SELECT TO authenticated USING (true);
CREATE POLICY "attribute_histories_insert_system" ON attribute_histories FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));

CREATE POLICY "system_settings_select_authenticated" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_settings_update_admin_coadmin" ON system_settings FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));

CREATE POLICY "audit_logs_select_admin_coadmin" ON audit_logs FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "login_logs_select_admin_coadmin" ON login_logs FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin'));
CREATE POLICY "login_logs_insert_authenticated" ON login_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 初期データ: 調布
INSERT INTO localities (id, name) VALUES ('11111111-1111-1111-1111-111111111111', '調布');
INSERT INTO districts (id, locality_id, name) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '調布地区');
INSERT INTO system_settings (key, value) VALUES ('absence_alert_weeks', '4'::jsonb)
ON CONFLICT (key) DO NOTHING;
