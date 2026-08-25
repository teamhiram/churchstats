-- フリガナ列追加
ALTER TABLE members ADD COLUMN IF NOT EXISTS furigana TEXT;

-- アプリは age_group を参照するため、current_category をリネーム（存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'current_category') THEN
    ALTER TABLE members RENAME COLUMN current_category TO age_group;
  END IF;
END $$;

-- 性別を男・女のみに（その他を削除）
-- 既存の 'other' は 'male' に変換
ALTER TABLE members ALTER COLUMN gender DROP DEFAULT;
ALTER TYPE gender_enum RENAME TO gender_enum_old;
CREATE TYPE gender_enum AS ENUM ('male', 'female');
ALTER TABLE members
  ALTER COLUMN gender TYPE gender_enum
  USING (CASE WHEN gender::text = 'other' THEN 'male'::gender_enum ELSE gender::text::gender_enum END);
ALTER TABLE members ALTER COLUMN gender SET DEFAULT 'male';
DROP TYPE gender_enum_old;
