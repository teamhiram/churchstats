-- Phase 2: 在籍期間の管理
-- 名簿に「ローカルメンバー転入日」と「ローカルメンバー転出日」を追加

ALTER TABLE members ADD COLUMN IF NOT EXISTS local_member_join_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS local_member_leave_date DATE;

COMMENT ON COLUMN members.local_member_join_date IS 'ローカルメンバー転入日：この日以降、在籍期間内として扱う';
COMMENT ON COLUMN members.local_member_leave_date IS 'ローカルメンバー転出日：この日以降、在籍期間外として扱う';

CREATE INDEX IF NOT EXISTS idx_members_local_member_join_date ON members(local_member_join_date);
CREATE INDEX IF NOT EXISTS idx_members_local_member_leave_date ON members(local_member_leave_date);
