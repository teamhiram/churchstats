-- 年齢層「子供」(child) を「未就学児」(preschool) に変更
-- PostgreSQL 10+ の RENAME VALUE で enum 値を変更（members.age_group, attendance_records.recorded_category に自動反映）

ALTER TYPE category_enum RENAME VALUE 'child' TO 'preschool';

-- 履歴テーブルの old_value / new_value に 'child' が文字列で入っている場合は 'preschool' に更新
UPDATE attribute_histories SET old_value = 'preschool' WHERE attribute_type = 'category' AND old_value = 'child';
UPDATE attribute_histories SET new_value = 'preschool' WHERE attribute_type = 'category' AND new_value = 'child';
