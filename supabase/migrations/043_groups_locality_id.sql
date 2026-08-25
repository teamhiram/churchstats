-- 043_groups_locality_id.sql
-- groups に locality_id を追加。地方ラベル（市川・調布など）は localities を JOIN して name を取得する。

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS locality_id UUID REFERENCES localities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_groups_locality_id ON groups(locality_id);

-- 既存データ: district 経由で locality_id を投入
UPDATE groups
SET locality_id = (SELECT locality_id FROM districts WHERE districts.id = groups.district_id)
WHERE locality_id IS NULL;
