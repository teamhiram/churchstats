-- 046_members_backfill_first_last_name.sql
-- 045 で追加した last_name / first_name / last_furigana / first_furigana に、
-- 手動分割済み CSV（members_rows_split_202603019）の内容を投入する。
-- 045 適用後に実行すること。

BEGIN;

UPDATE members SET last_name = '田村', first_name = '晶子', last_furigana = 'タムラ', first_furigana = 'アキコ' WHERE id = '25af4153-c535-4b4c-aa21-b62cb52d1cda';
UPDATE members SET last_name = '佐藤', first_name = '匠', last_furigana = 'サトウ', first_furigana = 'タク' WHERE id = 'a6c0f600-347d-452b-9fcb-3011fe9806a4';
UPDATE members SET last_name = '勝又', first_name = '康平', last_furigana = 'カツマタ', first_furigana = 'コウヘイ' WHERE id = 'f27f7734-766f-430a-8fd2-5fddf3a33aa6';
UPDATE members SET last_name = '瀬島', first_name = '美沙稀', last_furigana = 'セジマ', first_furigana = 'ミサキ' WHERE id = '76e12204-7da3-40e6-b352-f95782d69953';
UPDATE members SET last_name = '木戸', first_name = '由美', last_furigana = 'キド', first_furigana = 'ユミ' WHERE id = '18ee52e8-098b-4f41-af29-6fd0c3d2c9e9';
UPDATE members SET last_name = 'ワン', first_name = 'レイナ', last_furigana = 'ワン', first_furigana = 'レイナ' WHERE id = 'c3661950-791b-4cd5-95db-e6cf19452337';
UPDATE members SET last_name = 'ワン', first_name = 'マリ', last_furigana = 'ワン', first_furigana = 'マリ' WHERE id = 'e22594df-c8f7-4338-b660-912d54987be5';
UPDATE members SET last_name = 'ワン', first_name = 'メグミ', last_furigana = 'ワン', first_furigana = 'メグミ' WHERE id = '379097d9-fdeb-4a9e-bdf6-54217d527f30';
UPDATE members SET last_name = 'ワン', first_name = 'アレン', last_furigana = 'ワン', first_furigana = 'アレン' WHERE id = 'd18215ef-18af-44e4-9f35-6097daecac34';
UPDATE members SET last_name = '于', first_name = '傳堂', last_furigana = 'ユ', first_furigana = 'デンドウ' WHERE id = 'e8b301f3-5a59-424c-85f6-00941d03a765';
UPDATE members SET last_name = '武山', first_name = '潤', last_furigana = 'タケヤマ', first_furigana = 'ジュン' WHERE id = '222219b3-3da5-4a3c-a385-5737bc41a2cf';
UPDATE members SET last_name = '武山', first_name = '立', last_furigana = 'タケヤマ', first_furigana = 'タツ' WHERE id = '139b404e-3e54-48dc-b32a-ee569f8ad73b';
UPDATE members SET last_name = '武山', first_name = '照', last_furigana = 'タケヤマ', first_furigana = 'テル' WHERE id = 'c72e5abd-b1b5-499f-a549-7fc6037f6087';
UPDATE members SET last_name = '武山', first_name = '千恵', last_furigana = 'タケヤマ', first_furigana = 'チエ' WHERE id = '6246d936-5e1b-4f7d-ad75-85901b141579';
UPDATE members SET last_name = '武山', first_name = '文奈', last_furigana = 'タケヤマ', first_furigana = 'アヤナ' WHERE id = 'bc236c79-5c76-45a0-a3b4-29b329a03036';
UPDATE members SET last_name = '周', first_name = '小童', last_furigana = 'シュウ', first_furigana = 'ショウドウ' WHERE id = '2e3cdfd6-805d-489d-88f7-b5429e878fe9';
UPDATE members SET last_name = '小山', first_name = '芳子', last_furigana = 'コヤマ', first_furigana = 'ヨシコ' WHERE id = '1ffe8ff5-1fcb-4767-82b3-335022b9046e';
UPDATE members SET last_name = '鈴木', first_name = '輝子', last_furigana = 'スズキ', first_furigana = 'テルコ' WHERE id = '84d0012a-e72e-43f7-afdf-01aa4becac35';
UPDATE members SET last_name = '田中', first_name = '章雄', last_furigana = 'タナカ', first_furigana = 'アキオ' WHERE id = '4edb108e-6698-4dc1-b5a1-aa560a2cfb39';
UPDATE members SET last_name = '田中', first_name = '二コラ', last_furigana = 'タナカ', first_furigana = 'ニコラ' WHERE id = '4c2908c9-e7c7-470a-8b0f-989d120f0cc2';
UPDATE members SET last_name = '安田', first_name = '拓真', last_furigana = 'ヤスダ', first_furigana = 'タクマ' WHERE id = '208f8f71-0606-463b-974e-047ea23a4bcd';
UPDATE members SET last_name = '吉田', first_name = '弘子', last_furigana = 'ヨシダ', first_furigana = 'ヒロコ' WHERE id = '08791261-2d60-4dd3-9163-5235611fb3a7';
UPDATE members SET last_name = '亀﨑', first_name = '樺凛', last_furigana = 'カメザキ', first_furigana = 'カレン' WHERE id = '92e5f9ae-332a-468f-8fad-a85f95577fac';
UPDATE members SET last_name = '劉', first_name = '蔓', last_furigana = 'リュウ', first_furigana = 'マン' WHERE id = '98cba2fe-d70d-4eab-8618-56fbe1cf074e';
UPDATE members SET last_name = '牛', first_name = '婧卜', last_furigana = 'ニュウ', first_furigana = 'セイボ' WHERE id = 'bdddc81d-6d41-4632-afa0-cce1a88d7fb7';
UPDATE members SET last_name = '武山', first_name = '理絵', last_furigana = 'タケヤマ', first_furigana = 'リエ' WHERE id = '4c2abcd9-3603-4655-bb7d-fed9a72d792c';
UPDATE members SET last_name = '郭', first_name = '召会', last_furigana = 'カク', first_furigana = 'ショウカイ' WHERE id = '3fd36d51-1cc4-4ea1-b8b1-c24c813c3004';
UPDATE members SET last_name = '岩本', first_name = '良介', last_furigana = 'イワモト', first_furigana = 'リョウスケ' WHERE id = '0dcf8ba6-bd3f-4ff9-bb72-d1d255b16df8';
UPDATE members SET last_name = '小寺', first_name = '政子', last_furigana = 'コテラ', first_furigana = 'マサコ' WHERE id = '66814bde-3317-4d8f-9c8f-ea51317a9f02';
UPDATE members SET last_name = '権藤', first_name = '紗和子', last_furigana = 'ゴンドウ', first_furigana = 'サワコ' WHERE id = 'eeaffef4-c2a3-4046-ac1a-f3ba8925ac39';
UPDATE members SET last_name = '岡崎', first_name = 'あすか', last_furigana = 'オカザキ', first_furigana = 'アスカ' WHERE id = '541b14d1-1ab5-4bd9-af54-0daa5df66af4';
UPDATE members SET last_name = '孟', first_name = '康', last_furigana = 'モウ', first_furigana = 'コウ' WHERE id = '722df8bb-3e11-4f3e-bb82-d256546b6f61';
UPDATE members SET last_name = '田中', first_name = '颯太', last_furigana = 'タナカ', first_furigana = 'ソウタ' WHERE id = '1c4764b4-2d2f-4b26-ad62-0da21ec0a564';
UPDATE members SET last_name = '加藤', first_name = '良子', last_furigana = 'カトウ', first_furigana = 'リョウコ' WHERE id = 'bfd4cb11-9df1-47a5-8bb5-090eed8f1604';
UPDATE members SET last_name = '木下', first_name = '喜子', last_furigana = 'キノシタ', first_furigana = 'ヨシコ' WHERE id = '7c07e8d6-817c-4ac4-9b67-2513c638b4d0';
UPDATE members SET last_name = '西村', first_name = '新輝', last_furigana = 'ニシムラ', first_furigana = 'アキ' WHERE id = 'b65b9cae-6d94-4203-aead-2bfc6c6768fa';
UPDATE members SET last_name = '高岡', first_name = '瑠美子', last_furigana = 'タカオカ', first_furigana = 'ルミコ' WHERE id = '5071ff87-08fb-47a5-accb-bba5ea690baa';
UPDATE members SET last_name = '高岡', first_name = '捷子', last_furigana = 'タカオカ', first_furigana = 'トシコ' WHERE id = 'babc1b84-6de2-4558-8c6b-175092536c0f';
UPDATE members SET last_name = '佐野', first_name = '淑子', last_furigana = 'サノ', first_furigana = 'トシコ' WHERE id = '19c7150b-e5ea-463a-a115-cff042d91d96';
UPDATE members SET last_name = '三宅', first_name = '成主歩', last_furigana = 'ミヤケ', first_furigana = 'ジョシュア' WHERE id = '30d80de8-a65d-4a69-a483-c4163560c6ef';
UPDATE members SET last_name = '三宅', first_name = '望歩', last_furigana = 'ミヤケ', first_furigana = 'ノア' WHERE id = '19ddf542-6a89-4e7b-85a0-2c9502226d99';
UPDATE members SET last_name = '前田', first_name = '朱見', last_furigana = 'マエダ', first_furigana = 'アケミ' WHERE id = 'a3255e76-2cb9-46f9-bc40-03de9af2963b';
UPDATE members SET last_name = '平澤', first_name = '美子', last_furigana = 'ヒラサワ', first_furigana = 'ヨシコ' WHERE id = '0a19d90b-e8fc-4814-803b-a0ce106544d5';
UPDATE members SET last_name = '平井', first_name = '眞知子', last_furigana = 'ヒライ', first_furigana = 'マチコ' WHERE id = '819421ec-4279-404d-92a8-3a11a59d2184';
UPDATE members SET last_name = '菊川', first_name = 'デイビッド', last_furigana = 'キクガワ', first_furigana = 'デイビッド' WHERE id = '62cb6eef-6164-4b78-9327-0dd4633c6d7e';
UPDATE members SET last_name = '中川', first_name = '周', last_furigana = 'ナカガワ', first_furigana = 'シュウ' WHERE id = 'a0dd4c31-7e71-49fd-86fe-d560e41e772b';
UPDATE members SET last_name = '佐々木', first_name = '勇', last_furigana = 'ササキ', first_furigana = 'イサム' WHERE id = 'c1b51830-45ee-4eac-b5c6-d2d6ec270b6d';
UPDATE members SET last_name = '阿部', first_name = 'のぞみ', last_furigana = 'アベ', first_furigana = 'ノゾミ' WHERE id = '25d34a36-5b5d-460f-afda-ccf89eed592f';
UPDATE members SET last_name = '宮下', first_name = 'まから', last_furigana = 'ミヤシタ', first_furigana = 'マカラ' WHERE id = 'deb99356-ffaa-475e-aeef-1fe6d736e2fe';
UPDATE members SET last_name = '小寺', first_name = '淳人', last_furigana = 'コテラ', first_furigana = 'マコト' WHERE id = 'a1ec1680-1274-4266-a089-8d38183958af';
UPDATE members SET last_name = '西村', first_name = '城志', last_furigana = 'ニシムラ', first_furigana = 'ジョウジ' WHERE id = '8733b9f3-4787-416e-9233-cddd61aa99a7';
UPDATE members SET last_name = '西村', first_name = '一成', last_furigana = 'ニシムラ', first_furigana = 'イッセイ' WHERE id = 'c2f600b8-fbb5-474c-9273-f18191b30574';
UPDATE members SET last_name = '西村', first_name = '愛子', last_furigana = 'ニシムラ', first_furigana = 'アイコ' WHERE id = 'dc9430c3-09e8-494e-98a7-1456d1db1eab';
UPDATE members SET last_name = '西村', first_name = '達也', last_furigana = 'ニシムラ', first_furigana = 'タツヤ' WHERE id = 'f8091334-e64a-46b8-a2e9-4e8709155912';
UPDATE members SET last_name = '三宅', first_name = '結実', last_furigana = 'ミヤケ', first_furigana = 'ユミ' WHERE id = '03a699e8-8a0c-4a3a-9f3e-07a4c5f7d564';
UPDATE members SET last_name = '三宅', first_name = '建', last_furigana = 'ミヤケ', first_furigana = 'ケン' WHERE id = 'bdfa2397-2fe5-4c96-82b4-22208272cffc';
UPDATE members SET last_name = '岩本', first_name = '和子', last_furigana = 'イワモト', first_furigana = 'カズコ' WHERE id = 'af30f6ec-147f-470c-8ea5-4b3f0fd14680';
UPDATE members SET last_name = '上谷', first_name = '伸子', last_furigana = 'カミタニ', first_furigana = 'ノブコ' WHERE id = '313c2fec-4a59-4a35-a071-9b665edfefea';
UPDATE members SET last_name = '土屋', first_name = '和子', last_furigana = 'ツチヤ', first_furigana = 'カズコ' WHERE id = '6bb52f56-911f-4e61-8d77-135b9192e62f';
UPDATE members SET last_name = '石合', first_name = '玲子', last_furigana = 'イシアイ', first_furigana = 'レイコ' WHERE id = 'ea94e491-4655-4147-8ae7-d7404284ab30';
UPDATE members SET last_name = '石合', first_name = '信正', last_furigana = 'イシアイ', first_furigana = 'ノブマサ' WHERE id = 'bef05bb5-3478-4624-b543-707c52b3e63f';
UPDATE members SET last_name = '中村', first_name = '英太郎', last_furigana = 'ナカムラ', first_furigana = 'エイタロウ' WHERE id = '3d7ecc94-af11-43fb-bfab-4cbde6332bca';

COMMIT;
