-- 052_backfill_lordsday_attendance_recorded_category.sql

-- DB maintenance backfill:
-- Replace historical Lordsday attendance records saved as adult
-- (社会人(年代不詳)) with each member's current age_group.
--
-- Scope check:
-- - lordsday_meeting_attendance has recorded_category and is updated below.
-- - prayer_meeting_attendance has no recorded_category/category snapshot column, so it is not updated.
-- - group_meeting_attendance has no recorded_category/category snapshot column, so it is not updated.
--
-- Optional column check before running:
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'lordsday_meeting_attendance',
--     'prayer_meeting_attendance',
--     'group_meeting_attendance'
--   )
--   AND column_name IN ('recorded_category', 'category', 'age_group')
-- ORDER BY table_name, column_name;
--
-- Preview before running:
-- SELECT
--   m.age_group AS replacement_age_group,
--   count(*) AS rows_to_update
-- FROM public.lordsday_meeting_attendance a
-- JOIN public.members m ON m.id = a.member_id
-- WHERE a.recorded_category = 'adult'
--   AND m.age_group IS NOT NULL
--   AND m.age_group <> 'adult'
-- GROUP BY m.age_group
-- ORDER BY m.age_group;
--
-- Expected after running: zero rows.
-- SELECT
--   a.recorded_category AS recorded_category,
--   m.age_group AS current_member_age_group,
--   count(*) AS remaining_rows_to_update
-- FROM public.lordsday_meeting_attendance a
-- JOIN public.members m ON m.id = a.member_id
-- WHERE a.recorded_category = 'adult'
--   AND m.age_group IS NOT NULL
--   AND m.age_group <> 'adult'
-- GROUP BY a.recorded_category, m.age_group
-- ORDER BY m.age_group;

UPDATE public.lordsday_meeting_attendance AS a
SET recorded_category = m.age_group
FROM public.members AS m
WHERE a.member_id = m.id
  AND a.recorded_category = 'adult'
  AND m.age_group IS NOT NULL
  AND m.age_group <> 'adult';
