-- 048_members_add_memo.sql
-- members にメモ（memo）列を追加し、名簿の補足情報（長文可）を保存できるようにする。

ALTER TABLE members ADD COLUMN IF NOT EXISTS memo TEXT;
COMMENT ON COLUMN members.memo IS '名簿メモ（長文可）';
