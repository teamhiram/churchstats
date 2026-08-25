-- 都道府県（prefecture）を area と locality の間に追加
-- 階層: 地域(area) → 都道府県(prefecture) → 地方(locality)
-- 参照: https://church-in-chofu.com/localities/

-- 1) 都道府県テーブル
CREATE TABLE prefectures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  sort_order INT,
  UNIQUE(name)
);
CREATE INDEX IF NOT EXISTS idx_prefectures_area_id ON prefectures(area_id);
COMMENT ON TABLE prefectures IS '都道府県。地域(area)に属する。東京都・千葉県など。';

-- 2) localities に prefecture_id を追加
ALTER TABLE localities
  ADD COLUMN IF NOT EXISTS prefecture_id UUID REFERENCES prefectures(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_localities_prefecture_id ON localities(prefecture_id);
COMMENT ON COLUMN localities.prefecture_id IS '都道府県。area_id は prefecture.area_id から導出可能。';

-- 3) 都道府県の初期データ（参照ページの地域別。INSERT SELECT は 1 行ずつ）
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '北海道', id, 1 FROM areas WHERE name = '北海道・東北' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '宮城県', id, 2 FROM areas WHERE name = '北海道・東北' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '山形県', id, 3 FROM areas WHERE name = '北海道・東北' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '茨城県', id, 1 FROM areas WHERE name = '北関東' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '埼玉県', id, 2 FROM areas WHERE name = '北関東' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '千葉県', id, 1 FROM areas WHERE name = '南関東' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '東京都', id, 2 FROM areas WHERE name = '南関東' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '神奈川県', id, 3 FROM areas WHERE name = '南関東' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '富山県', id, 1 FROM areas WHERE name = '中部' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '新潟県', id, 2 FROM areas WHERE name = '中部' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '静岡県', id, 3 FROM areas WHERE name = '中部' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '岐阜県', id, 4 FROM areas WHERE name = '中部' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '愛知県', id, 5 FROM areas WHERE name = '中部' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '三重県', id, 6 FROM areas WHERE name = '中部' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '大阪府', id, 1 FROM areas WHERE name = '関西' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '京都府', id, 2 FROM areas WHERE name = '関西' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '兵庫県', id, 3 FROM areas WHERE name = '関西' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '奈良県', id, 4 FROM areas WHERE name = '関西' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '広島県', id, 1 FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '徳島県', id, 2 FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '福岡県', id, 3 FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1
ON CONFLICT (name) DO NOTHING;
INSERT INTO prefectures (name, area_id, sort_order)
SELECT '沖縄県', id, 4 FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- 4) RLS
ALTER TABLE prefectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefectures_select_authenticated" ON prefectures FOR SELECT TO authenticated USING (true);
CREATE POLICY "prefectures_all_global_admin" ON prefectures FOR ALL TO authenticated
  USING (get_my_global_role() = 'admin');
