-- 都道府県 47 件を docs/prefectures_list.md に基づき補完
-- id は 00000000-0000-0000-0000-000000000001 ～ 00000000-0000-0000-0000-000000000047（末尾2桁を01-47で利用）

-- localities の prefecture_id をいったん NULL にしてから都道府県を差し替える（FK 制約のため）
UPDATE localities SET prefecture_id = NULL WHERE prefecture_id IS NOT NULL;

-- 既存の都道府県を削除し、固定 UUID で 47 件を一括投入
DELETE FROM prefectures;

INSERT INTO prefectures (id, name, area_id, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', '北海道', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 1),
  ('00000000-0000-0000-0000-000000000002', '青森県', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 2),
  ('00000000-0000-0000-0000-000000000003', '岩手県', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 3),
  ('00000000-0000-0000-0000-000000000004', '宮城県', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 4),
  ('00000000-0000-0000-0000-000000000005', '秋田県', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 5),
  ('00000000-0000-0000-0000-000000000006', '山形県', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 6),
  ('00000000-0000-0000-0000-000000000007', '福島県', (SELECT id FROM areas WHERE name = '北海道・東北' LIMIT 1), 7),
  ('00000000-0000-0000-0000-000000000008', '茨城県', (SELECT id FROM areas WHERE name = '北関東' LIMIT 1), 8),
  ('00000000-0000-0000-0000-000000000009', '栃木県', (SELECT id FROM areas WHERE name = '北関東' LIMIT 1), 9),
  ('00000000-0000-0000-0000-000000000010', '群馬県', (SELECT id FROM areas WHERE name = '北関東' LIMIT 1), 10),
  ('00000000-0000-0000-0000-000000000011', '埼玉県', (SELECT id FROM areas WHERE name = '北関東' LIMIT 1), 11),
  ('00000000-0000-0000-0000-000000000012', '千葉県', (SELECT id FROM areas WHERE name = '南関東' LIMIT 1), 12),
  ('00000000-0000-0000-0000-000000000013', '東京都', (SELECT id FROM areas WHERE name = '南関東' LIMIT 1), 13),
  ('00000000-0000-0000-0000-000000000014', '神奈川県', (SELECT id FROM areas WHERE name = '南関東' LIMIT 1), 14),
  ('00000000-0000-0000-0000-000000000015', '新潟県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 15),
  ('00000000-0000-0000-0000-000000000016', '富山県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 16),
  ('00000000-0000-0000-0000-000000000017', '石川県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 17),
  ('00000000-0000-0000-0000-000000000018', '福井県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 18),
  ('00000000-0000-0000-0000-000000000019', '山梨県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 19),
  ('00000000-0000-0000-0000-000000000020', '長野県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 20),
  ('00000000-0000-0000-0000-000000000021', '岐阜県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 21),
  ('00000000-0000-0000-0000-000000000022', '静岡県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 22),
  ('00000000-0000-0000-0000-000000000023', '愛知県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 23),
  ('00000000-0000-0000-0000-000000000024', '三重県', (SELECT id FROM areas WHERE name = '中部' LIMIT 1), 24),
  ('00000000-0000-0000-0000-000000000025', '滋賀県', (SELECT id FROM areas WHERE name = '関西' LIMIT 1), 25),
  ('00000000-0000-0000-0000-000000000026', '京都府', (SELECT id FROM areas WHERE name = '関西' LIMIT 1), 26),
  ('00000000-0000-0000-0000-000000000027', '大阪府', (SELECT id FROM areas WHERE name = '関西' LIMIT 1), 27),
  ('00000000-0000-0000-0000-000000000028', '兵庫県', (SELECT id FROM areas WHERE name = '関西' LIMIT 1), 28),
  ('00000000-0000-0000-0000-000000000029', '奈良県', (SELECT id FROM areas WHERE name = '関西' LIMIT 1), 29),
  ('00000000-0000-0000-0000-000000000030', '和歌山県', (SELECT id FROM areas WHERE name = '関西' LIMIT 1), 30),
  ('00000000-0000-0000-0000-000000000031', '鳥取県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 31),
  ('00000000-0000-0000-0000-000000000032', '島根県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 32),
  ('00000000-0000-0000-0000-000000000033', '岡山県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 33),
  ('00000000-0000-0000-0000-000000000034', '広島県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 34),
  ('00000000-0000-0000-0000-000000000035', '山口県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 35),
  ('00000000-0000-0000-0000-000000000036', '徳島県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 36),
  ('00000000-0000-0000-0000-000000000037', '香川県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 37),
  ('00000000-0000-0000-0000-000000000038', '愛媛県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 38),
  ('00000000-0000-0000-0000-000000000039', '高知県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 39),
  ('00000000-0000-0000-0000-000000000040', '福岡県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 40),
  ('00000000-0000-0000-0000-000000000041', '佐賀県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 41),
  ('00000000-0000-0000-0000-000000000042', '長崎県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 42),
  ('00000000-0000-0000-0000-000000000043', '熊本県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 43),
  ('00000000-0000-0000-0000-000000000044', '大分県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 44),
  ('00000000-0000-0000-0000-000000000045', '宮崎県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 45),
  ('00000000-0000-0000-0000-000000000046', '鹿児島県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 46),
  ('00000000-0000-0000-0000-000000000047', '沖縄県', (SELECT id FROM areas WHERE name = '四国・九州・沖縄' LIMIT 1), 47);
