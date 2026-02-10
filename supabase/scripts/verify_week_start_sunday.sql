-- week_start が日曜日(dow=0)になっているか確認
-- dow: 0=日曜, 1=月曜, ... 6=土曜
SELECT 'group_meeting_records' AS tbl, week_start, EXTRACT(DOW FROM week_start)::int AS dow
FROM group_meeting_records
ORDER BY week_start DESC
LIMIT 5;

SELECT 'prayer_meeting_records' AS tbl, week_start, EXTRACT(DOW FROM week_start)::int AS dow
FROM prayer_meeting_records
ORDER BY week_start DESC
LIMIT 5;

SELECT 'organic_dispatch_records' AS tbl, week_start, EXTRACT(DOW FROM week_start)::int AS dow
FROM organic_dispatch_records
ORDER BY week_start DESC
LIMIT 5;
