-- members テーブルに furigana カラムを追加（既存の場合はスキップ）
ALTER TABLE members ADD COLUMN IF NOT EXISTS furigana TEXT;
