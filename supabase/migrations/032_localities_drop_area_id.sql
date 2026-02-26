-- localities から area_id を削除。地域(area)は都道府県(prefecture)経由でのみ参照する。
-- 階層: area → prefecture → locality。prefecture 未設定の地方は各地域の「その他」都道府県に紐づける。

-- 1) 各地域に「その他」都道府県がなければ作成（名前は地域ごとに一意）
INSERT INTO prefectures (name, area_id, sort_order)
SELECT 'その他（' || a.name || '）', a.id, 999
FROM areas a
WHERE NOT EXISTS (SELECT 1 FROM prefectures p WHERE p.area_id = a.id AND p.name = 'その他（' || a.name || '）');

-- 2) prefecture_id が NULL で area_id が設定されている地方を、その地域の「その他」に紐づけ
UPDATE localities l
SET prefecture_id = (
  SELECT p.id FROM prefectures p
  WHERE p.area_id = l.area_id AND p.name = 'その他（' || (SELECT a.name FROM areas a WHERE a.id = l.area_id) || '）'
  LIMIT 1
)
WHERE l.prefecture_id IS NULL AND l.area_id IS NOT NULL;

-- 3) localities から area_id を削除
ALTER TABLE localities DROP COLUMN IF EXISTS area_id;
