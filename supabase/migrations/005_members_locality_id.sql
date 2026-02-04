-- 多地方利用・ゲスト登録向け: members に locality を追加し、localities を拡張する

-- 1) members に locality_id を追加（既存の localities を参照）
ALTER TABLE members ADD COLUMN IF NOT EXISTS locality_id UUID REFERENCES localities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_members_locality_id ON members(locality_id);

-- 既存のメンバーはすべて「調布」とする
UPDATE members SET locality_id = '11111111-1111-1111-1111-111111111111' WHERE locality_id IS NULL;

-- 2) localities に以下のレコードを追加（同名がなければ挿入）
INSERT INTO localities (id, name)
SELECT uuid_generate_v4(), n FROM (VALUES
  ('札幌'), ('仙台'), ('新庄'), ('酒田'), ('下妻'), ('つくば'), ('北本'), ('川口'), ('さいたま'), ('千葉'),
  ('習志野'), ('成田'), ('市川'), ('市原'), ('松戸'), ('東京'), ('西東京'), ('小平'), ('町田'),
  ('八王子'), ('日野'), ('横浜'), ('小田原'), ('藤沢'), ('相模原'), ('富山'), ('新潟'), ('静岡'), ('掛川'),
  ('岐阜'), ('名古屋'), ('豊川'), ('鈴鹿'), ('大阪'), ('東大阪'), ('京都'), ('神戸'), ('奈良'), ('広島'),
  ('徳島'), ('北九州'), ('福岡'), ('那覇')
) AS t(n)
WHERE NOT EXISTS (SELECT 1 FROM localities l WHERE l.name = t.n);
