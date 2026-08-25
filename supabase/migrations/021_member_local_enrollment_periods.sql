-- Phase 6: 在籍期間の複数期間対応
-- 1人で複数回の在籍期間を管理するためのテーブル

CREATE TABLE IF NOT EXISTS member_local_enrollment_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  period_no INT NOT NULL,
  join_date DATE,
  leave_date DATE,
  is_uncertain BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(member_id, period_no)
);

CREATE INDEX IF NOT EXISTS idx_mlep_member_id ON member_local_enrollment_periods(member_id);
COMMENT ON TABLE member_local_enrollment_periods IS 'ローカルメンバーの在籍期間（複数期間対応）';
COMMENT ON COLUMN member_local_enrollment_periods.period_no IS '期間番号（1, 2, 3...）';
COMMENT ON COLUMN member_local_enrollment_periods.join_date IS '転入日：この日以降、在籍期間内';
COMMENT ON COLUMN member_local_enrollment_periods.leave_date IS '転出日：この日以降、在籍期間外';
COMMENT ON COLUMN member_local_enrollment_periods.is_uncertain IS '期間不確定フラグ（データ補完用）';

-- 既存の members.local_member_join_date / local_member_leave_date を期間1として移行
INSERT INTO member_local_enrollment_periods (member_id, period_no, join_date, leave_date, is_uncertain)
SELECT id, 1, local_member_join_date, local_member_leave_date, false
FROM members
WHERE is_local = true
  AND (local_member_join_date IS NOT NULL OR local_member_leave_date IS NOT NULL)
ON CONFLICT (member_id, period_no) DO NOTHING;

-- ローカルだが期間登録がないメンバーには期間1（NULL, NULL）を追加
-- ※在籍扱いにするため、join_date が NULL の期間1を持つ
INSERT INTO member_local_enrollment_periods (member_id, period_no, join_date, leave_date, is_uncertain)
SELECT id, 1, NULL, NULL, false
FROM members
WHERE is_local = true
  AND id NOT IN (SELECT member_id FROM member_local_enrollment_periods WHERE period_no = 1)
ON CONFLICT (member_id, period_no) DO NOTHING;

-- RLS: members と同様、SELECT は認証済み、INSERT/UPDATE/DELETE は reporter 以上
ALTER TABLE member_local_enrollment_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mlep_select_authenticated" ON member_local_enrollment_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "mlep_insert_reporter_above" ON member_local_enrollment_periods FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "mlep_update_reporter_above" ON member_local_enrollment_periods FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "mlep_delete_reporter_above" ON member_local_enrollment_periods FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
