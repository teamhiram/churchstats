-- 地域（area）の表示順と初期データ
-- 参照: https://church-in-chofu.com/localities/ 諸地方召会の地域分けに準拠

-- 表示順を制御するため sort_order を追加（NULL は最後）
ALTER TABLE areas ADD COLUMN IF NOT EXISTS sort_order INT;
COMMENT ON COLUMN areas.sort_order IS '地方ポップアップのセクション表示順。小さいほど先に表示。';

-- 参照ページの並びで地域を登録（既存は名前でマッチして sort_order のみ更新）
INSERT INTO areas (name, sort_order) VALUES
  ('北海道・東北', 1),
  ('北関東', 2),
  ('南関東', 3),
  ('中部', 4),
  ('関西', 5),
  ('四国・九州・沖縄', 6)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;
