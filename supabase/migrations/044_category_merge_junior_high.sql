-- 044_category_merge_junior_high.sql
-- 中学生・高校生を ENUM 上で一つにし、high_school を廃止して junior_high（中高生）に統一する。

-- 1) データを junior_high に統一（high_school を残さない）
UPDATE members SET age_group = 'junior_high' WHERE age_group = 'high_school';
UPDATE lordsday_meeting_attendance SET recorded_category = 'junior_high' WHERE recorded_category = 'high_school';
UPDATE attribute_histories SET old_value = 'junior_high' WHERE attribute_type = 'category' AND old_value = 'high_school';
UPDATE attribute_histories SET new_value = 'junior_high' WHERE attribute_type = 'category' AND new_value = 'high_school';

-- 2) high_school を含まない新 ENUM を作成
CREATE TYPE category_enum_new AS ENUM (
  'adult', 'university', 'junior_high', 'elementary', 'preschool',
  'young', 'middle', 'late_middle', 'senior'
);

-- 3) 各カラムを新型に切り替え
ALTER TABLE members
  ALTER COLUMN age_group TYPE category_enum_new USING (age_group::text::category_enum_new);
ALTER TABLE lordsday_meeting_attendance
  ALTER COLUMN recorded_category TYPE category_enum_new USING (recorded_category::text::category_enum_new);

-- 4) 旧型を削除し、新型を category_enum にリネーム
DROP TYPE category_enum;
ALTER TYPE category_enum_new RENAME TO category_enum;
