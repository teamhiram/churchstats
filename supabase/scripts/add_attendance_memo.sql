-- attendance_records に memo カラムを追加（主日・小組の出欠メモ用）
-- Supabase Dashboard → SQL Editor で実行

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS memo TEXT;

-- メモ更新を報告者以上に許可（既に存在する場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance_records' AND policyname = 'attendance_records_update_reporter_above'
  ) THEN
    CREATE POLICY "attendance_records_update_reporter_above" ON attendance_records
      FOR UPDATE TO authenticated
      USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
  END IF;
END $$;
