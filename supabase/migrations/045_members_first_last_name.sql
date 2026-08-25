-- 045_members_first_last_name.sql
-- 管理人名簿インポートに先立ち、members に first_name / last_name と first_furigana / last_furigana を追加する。
-- 既存の name / furigana は残し、バッチで分割した値を first/last に投入したあとも表示用に利用可能。

ALTER TABLE members ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_furigana TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS first_furigana TEXT;

COMMENT ON COLUMN members.last_name IS '姓（インポート・表示用）';
COMMENT ON COLUMN members.first_name IS '名（インポート・表示用）';
COMMENT ON COLUMN members.last_furigana IS '姓ふりがな';
COMMENT ON COLUMN members.first_furigana IS '名ふりがな';
