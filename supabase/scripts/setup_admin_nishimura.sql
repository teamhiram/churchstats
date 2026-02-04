-- 管理者アカウント（西村達也）セットアップ用
-- 【手順】先に Supabase Dashboard → Authentication → Users → "Add user" で
--   メール: tatsuya.n@gmail.com
--   パスワード: CCST24mura
-- でユーザーを作成してから、この SQL を SQL Editor で実行する。

-- 1. 稲城地区を追加（調布地方の下）
INSERT INTO districts (id, locality_id, name)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '稲城地区'
)
ON CONFLICT (id) DO NOTHING;

-- 2. プロファイルを管理者に更新（氏名・メイン地区）
UPDATE profiles
SET
  role = 'admin',
  full_name = '西村達也',
  main_district_id = '33333333-3333-3333-3333-333333333333'
WHERE id = (SELECT id FROM auth.users WHERE email = 'tatsuya.n@gmail.com' LIMIT 1);

-- 3. 担当地区：調布地区・稲城地区
INSERT INTO reporter_districts (user_id, district_id)
SELECT u.id, d.id
FROM auth.users u
CROSS JOIN districts d
WHERE u.email = 'tatsuya.n@gmail.com'
  AND d.name IN ('調布地区', '稲城地区')
ON CONFLICT (user_id, district_id) DO NOTHING;
