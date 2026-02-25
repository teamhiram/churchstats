"use server";

import { createClient } from "@/lib/supabase/server";
import { addDays, format, getDay } from "date-fns";
import { getSundayWeeksInYear, formatDateYmd } from "@/lib/weekUtils";

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getWeekStartForDate(dateStr: string): string {
  const d = parseYmd(dateStr);
  const sunday = addDays(d, -getDay(d));
  return format(sunday, "yyyy-MM-dd");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const CHUNK_SIZE = 200;

export type AttendanceMatrixWeek = {
  weekNumber: number;
  weekStart: string;
};

export type AttendanceMatrixMember = {
  memberId: string;
  name: string;
  furigana: string;
  districtId: string | null;
  districtName: string | null;
  isLocal: boolean;
  /** regular | semi | pool (地区のレギュラー/準レギュラー/プールリストに基づく) */
  tier: "regular" | "semi" | "pool";
  /** weekStart -> true if attended */
  prayer: Record<string, boolean>;
  main: Record<string, boolean>;
  group: Record<string, boolean>;
  dispatch: Record<string, boolean>;
};

export type AttendanceMatrixData = {
  weeks: AttendanceMatrixWeek[];
  members: AttendanceMatrixMember[];
  districts: { id: string; name: string }[];
};

/** 出欠マトリクス用データ取得。表示期間内にいずれか1つでも出席があるメンバーのみ返す */
export async function getAttendanceMatrixData(
  year: number = new Date().getFullYear()
): Promise<AttendanceMatrixData> {
  const supabase = await createClient();
  const weeksData = getSundayWeeksInYear(year);
  const weekStarts = weeksData.map((w) => formatDateYmd(w.weekStart));
  const weekStartRangeMin = weekStarts[0] ?? `${year}-01-01`;
  const weekStartRangeMax = weekStarts[weekStarts.length - 1] ?? `${year}-12-31`;

  const [meetingsRes, groupRecordsRes, prayerRecordsRes, dispatchRes, membersRes, districtsRes] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, event_date, meeting_type, district_id")
        .eq("meeting_type", "main")
        .gte("event_date", weekStartRangeMin)
        .lte("event_date", weekStartRangeMax),
      supabase
        .from("group_meeting_records")
        .select("id, week_start")
        .gte("week_start", weekStartRangeMin)
        .lte("week_start", weekStartRangeMax),
      supabase
        .from("prayer_meeting_records")
        .select("id, week_start")
        .gte("week_start", weekStartRangeMin)
        .lte("week_start", weekStartRangeMax),
      supabase
        .from("organic_dispatch_records")
        .select("member_id, week_start, dispatch_type, dispatch_date, dispatch_memo")
        .gte("week_start", weekStartRangeMin)
        .lte("week_start", weekStartRangeMax),
      supabase.from("members").select("id, name, furigana, district_id, is_local"),
      supabase.from("districts").select("id, name").order("id"),
    ]);

  const meetings = (meetingsRes.data ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
  }[];
  const groupRecords = (groupRecordsRes.data ?? []) as { id: string; week_start: string }[];
  const prayerRecords = (prayerRecordsRes.data ?? []) as { id: string; week_start: string }[];
  const dispatchRows = (dispatchRes.data ?? []) as {
    member_id: string;
    week_start: string;
    dispatch_type: string | null;
    dispatch_date: string | null;
    dispatch_memo: string | null;
  }[];
  const membersList = (membersRes.data ?? []) as {
    id: string;
    name: string;
    furigana: string | null;
    district_id: string | null;
    is_local: boolean | null;
  }[];
  const districts = (districtsRes.data ?? []) as { id: string; name: string }[];
  const districtMap = new Map(districts.map((d) => [d.id, d.name]));

  const districtIdsInUse = new Set(
    membersList.map((m) => m.district_id).filter((id): id is string => id != null)
  );
  const districtIdsArr = [...districtIdsInUse];
  let districtRegularList: { district_id: string; member_id: string }[] = [];
  let districtSemiList: { district_id: string; member_id: string }[] = [];
  let districtPoolList: { district_id: string; member_id: string }[] = [];
  if (districtIdsArr.length > 0) {
    const [regRes, semiRes, poolRes] = await Promise.all([
      supabase.from("district_regular_list").select("district_id, member_id").in("district_id", districtIdsArr),
      supabase.from("district_semi_regular_list").select("district_id, member_id").in("district_id", districtIdsArr),
      supabase.from("district_pool_list").select("district_id, member_id").in("district_id", districtIdsArr),
    ]);
    districtRegularList = (regRes.data ?? []) as { district_id: string; member_id: string }[];
    districtSemiList = (semiRes.data ?? []) as { district_id: string; member_id: string }[];
    districtPoolList = (poolRes.data ?? []) as { district_id: string; member_id: string }[];
  }
  const regularSetByDistrict = new Map<string, Set<string>>();
  districtRegularList.forEach((r) => {
    if (!regularSetByDistrict.has(r.district_id)) regularSetByDistrict.set(r.district_id, new Set());
    regularSetByDistrict.get(r.district_id)!.add(r.member_id);
  });
  const semiSetByDistrict = new Map<string, Set<string>>();
  districtSemiList.forEach((r) => {
    if (!semiSetByDistrict.has(r.district_id)) semiSetByDistrict.set(r.district_id, new Set());
    semiSetByDistrict.get(r.district_id)!.add(r.member_id);
  });
  const poolSetByDistrict = new Map<string, Set<string>>();
  districtPoolList.forEach((r) => {
    if (!poolSetByDistrict.has(r.district_id)) poolSetByDistrict.set(r.district_id, new Set());
    poolSetByDistrict.get(r.district_id)!.add(r.member_id);
  });

  function getTier(districtId: string | null, memberId: string): "regular" | "semi" | "pool" {
    if (!districtId) return "semi";
    if (regularSetByDistrict.get(districtId)?.has(memberId)) return "regular";
    if (semiSetByDistrict.get(districtId)?.has(memberId)) return "semi";
    if (poolSetByDistrict.get(districtId)?.has(memberId)) return "pool";
    return "semi";
  }

  const mainMeetingIds = new Set(meetings.map((m) => m.id));
  const meetingIdToDate = new Map(meetings.map((m) => [m.id, m.event_date]));
  const groupRecordIdToWeekStart = new Map(groupRecords.map((r) => [r.id, r.week_start]));
  const prayerRecordIdToWeekStart = new Map(prayerRecords.map((r) => [r.id, r.week_start]));

  const weekSet = new Set(weekStarts);

  // Fetch attendance data
  let mainAttendance: { meeting_id: string; member_id: string }[] = [];
  let groupAttendance: { group_meeting_record_id: string; member_id: string }[] = [];
  let prayerAttendance: { prayer_meeting_record_id: string; member_id: string }[] = [];

  if (mainMeetingIds.size > 0) {
    const meetingIds = [...mainMeetingIds];
    const chunks = chunk(meetingIds, CHUNK_SIZE);
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("attendance_records")
          .select("meeting_id, member_id, attended")
          .in("meeting_id", ids)
      )
    );
    const raw = results.flatMap((r) => (r.data ?? []) as { meeting_id: string; member_id: string; attended?: boolean }[]);
    mainAttendance = raw.filter((a) => a.attended !== false);
  }

  if (groupRecords.length > 0) {
    const recordIds = groupRecords.map((r) => r.id);
    const chunks = chunk(recordIds, CHUNK_SIZE);
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("group_meeting_attendance")
          .select("group_meeting_record_id, member_id, attended")
          .in("group_meeting_record_id", ids)
      )
    );
    const raw = results.flatMap(
      (r) => (r.data ?? []) as { group_meeting_record_id: string; member_id: string; attended?: boolean }[]
    );
    groupAttendance = raw.filter((a) => a.attended !== false);
  }

  if (prayerRecords.length > 0) {
    const recordIds = prayerRecords.map((r) => r.id);
    const chunks = chunk(recordIds, CHUNK_SIZE);
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("prayer_meeting_attendance")
          .select("prayer_meeting_record_id, member_id, attended")
          .in("prayer_meeting_record_id", ids)
      )
    );
    const raw = results.flatMap(
      (r) => (r.data ?? []) as { prayer_meeting_record_id: string; member_id: string; attended?: boolean }[]
    );
    prayerAttendance = raw.filter((a) => a.attended !== false);
  }

  const completeDispatches = dispatchRows.filter(
    (d) =>
      d.dispatch_type != null &&
      d.dispatch_type !== "" &&
      d.dispatch_date != null &&
      (d.dispatch_date as string) !== "" &&
      d.dispatch_memo != null &&
      (d.dispatch_memo as string).trim() !== ""
  );

  // Build member attendance maps: memberId -> weekStart -> boolean
  const prayerByMember = new Map<string, Record<string, boolean>>();
  const mainByMember = new Map<string, Record<string, boolean>>();
  const groupByMember = new Map<string, Record<string, boolean>>();
  const dispatchByMember = new Map<string, Record<string, boolean>>();

  const addWeek = (map: Map<string, Record<string, boolean>>, memberId: string, weekStart: string) => {
    if (!map.has(memberId)) map.set(memberId, {});
    map.get(memberId)![weekStart] = true;
  };

  mainAttendance.forEach((a) => {
    if (!mainMeetingIds.has(a.meeting_id)) return;
    const eventDate = meetingIdToDate.get(a.meeting_id);
    if (!eventDate) return;
    const weekStart = getWeekStartForDate(eventDate);
    if (!weekSet.has(weekStart)) return;
    addWeek(mainByMember, a.member_id, weekStart);
  });

  prayerAttendance.forEach((a) => {
    const weekStart = prayerRecordIdToWeekStart.get(a.prayer_meeting_record_id);
    if (!weekStart || !weekSet.has(weekStart)) return;
    addWeek(prayerByMember, a.member_id, weekStart);
  });

  groupAttendance.forEach((a) => {
    const weekStart = groupRecordIdToWeekStart.get(a.group_meeting_record_id);
    if (!weekStart || !weekSet.has(weekStart)) return;
    addWeek(groupByMember, a.member_id, weekStart);
  });

  completeDispatches.forEach((d) => {
    if (!weekSet.has(d.week_start)) return;
    addWeek(dispatchByMember, d.member_id, d.week_start);
  });

  // Members who have at least one attendance in any type during the period
  const memberIdsWithAttendance = new Set<string>();
  [prayerByMember, mainByMember, groupByMember, dispatchByMember].forEach((map) => {
    map.forEach((_, memberId) => memberIdsWithAttendance.add(memberId));
  });

  const weeks: AttendanceMatrixWeek[] = weeksData.map((w) => ({
    weekNumber: w.weekNumber,
    weekStart: formatDateYmd(w.weekStart),
  }));

  const furiganaMap = new Map(membersList.map((m) => [m.id, (m.furigana ?? m.name).trim() || m.name]));

  const members: AttendanceMatrixMember[] = membersList
    .filter((m) => memberIdsWithAttendance.has(m.id))
    .map((m) => ({
      memberId: m.id,
      name: m.name,
      furigana: furiganaMap.get(m.id) ?? m.name,
      districtId: m.district_id,
      districtName: m.district_id ? districtMap.get(m.district_id) ?? null : null,
      isLocal: m.is_local === true,
      tier: getTier(m.district_id, m.id),
      prayer: prayerByMember.get(m.id) ?? {},
      main: mainByMember.get(m.id) ?? {},
      group: groupByMember.get(m.id) ?? {},
      dispatch: dispatchByMember.get(m.id) ?? {},
    }));

  return { weeks, members, districts };
}
