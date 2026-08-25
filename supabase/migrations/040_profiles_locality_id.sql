-- 040_profiles_locality_id.sql
-- profiles に locality_id を追加。サイト初回表示のデフォルト地方に使用。
-- _RealeaseNotes/plan_v0.21.0_profile_locality_id.md

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS locality_id UUID REFERENCES localities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_locality_id ON profiles(locality_id);

-- 既存データ: main_district_id から地方を導出して埋める
UPDATE profiles
SET locality_id = (SELECT locality_id FROM districts WHERE id = profiles.main_district_id)
WHERE main_district_id IS NOT NULL AND locality_id IS NULL;
