-- 主日まわり 3 テーブルを案 B の名前にリネーム（docs/table-naming-proposal.md §5）
-- meetings → lordsday_meeting_records
-- attendance_records → lordsday_meeting_attendance
-- regular_member_list_items → lordsday_regular_list

ALTER TABLE meetings RENAME TO lordsday_meeting_records;

ALTER TABLE attendance_records RENAME TO lordsday_meeting_attendance;

ALTER TABLE regular_member_list_items RENAME TO lordsday_regular_list;
