-- 名簿（members.is_baptized）を遡って出席記録（attendance_records.recorded_is_baptized）に反映する。
-- 名簿の聖徒/友人が正しくなかった場合の一括修正用。
UPDATE attendance_records ar
SET recorded_is_baptized = m.is_baptized
FROM members m
WHERE ar.member_id = m.id;
