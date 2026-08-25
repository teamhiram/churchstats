-- 047_category_junior_high_to_adolescent.sql
-- age_group の junior_high を adolescent に変更し、既存レコードも更新する。

-- 1) ENUM 値のリネーム（members.age_group, lordsday_meeting_attendance.recorded_category に自動反映）
ALTER TYPE category_enum RENAME VALUE 'junior_high' TO 'adolescent';

-- 2) 履歴テーブルの old_value / new_value（TEXT）を adolescent に更新
UPDATE attribute_histories SET old_value = 'adolescent' WHERE attribute_type = 'category' AND old_value = 'junior_high';
UPDATE attribute_histories SET new_value = 'adolescent' WHERE attribute_type = 'category' AND new_value = 'junior_high';
