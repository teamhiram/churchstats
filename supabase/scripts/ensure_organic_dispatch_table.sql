-- 有機的派遣テーブルが無い場合に作成（002 マイグレーション相当）
-- Supabase Dashboard → SQL Editor で実行

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_type_enum') THEN
    CREATE TYPE dispatch_type_enum AS ENUM ('message', 'phone', 'in_person');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS organic_dispatch_records (
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

CREATE INDEX IF NOT EXISTS idx_organic_dispatch_group_week ON organic_dispatch_records(group_id, week_start);
CREATE INDEX IF NOT EXISTS idx_organic_dispatch_member ON organic_dispatch_records(member_id);

ALTER TABLE organic_dispatch_records ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーは無視して作成（存在すればエラーになるので DROP してから作成）
DROP POLICY IF EXISTS "organic_dispatch_select_authenticated" ON organic_dispatch_records;
DROP POLICY IF EXISTS "organic_dispatch_insert_reporter_above" ON organic_dispatch_records;
DROP POLICY IF EXISTS "organic_dispatch_update_reporter_above" ON organic_dispatch_records;
DROP POLICY IF EXISTS "organic_dispatch_delete_reporter_above" ON organic_dispatch_records;

CREATE POLICY "organic_dispatch_select_authenticated" ON organic_dispatch_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "organic_dispatch_insert_reporter_above" ON organic_dispatch_records FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "organic_dispatch_update_reporter_above" ON organic_dispatch_records FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "organic_dispatch_delete_reporter_above" ON organic_dispatch_records FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
