-- 週別集計・一覧・レイアウトでよく使う条件用のインデックス（不足分のみ追加）
-- 既存のインデックスは 001, 002, 008, 010 等を参照

-- 地方で地区を絞るクエリ用（getListData, レイアウトの locality 絞り）
CREATE INDEX IF NOT EXISTS idx_districts_locality_id ON districts(locality_id);

-- 地区で小組を絞るクエリ用（getListData の filterGroupIds）
CREATE INDEX IF NOT EXISTS idx_groups_district_id ON groups(district_id);
