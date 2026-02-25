-- ローカル在籍期間にメモ欄を追加（転入日・転出日とセットの情報）
ALTER TABLE member_local_enrollment_periods
  ADD COLUMN IF NOT EXISTS memo TEXT;

COMMENT ON COLUMN member_local_enrollment_periods.memo IS '在籍期間に関するメモ（転入・転出の補足など）';
