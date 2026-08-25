-- 049_members_name_nullable.sql
-- 氏名は first_name / last_name に移行したため、members.name の NOT NULL 制約を外す。

ALTER TABLE members ALTER COLUMN name DROP NOT NULL;
