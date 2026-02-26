"use server";

import { createClient } from "@/lib/supabase/server";
import { addDays, format, getDay } from "date-fns";
import { getSundayWeeksInYear, formatDateYmd } from "@/lib/weekUtils";
import type { WeekRow, WeekDetail } from "./types";

export type { WeekRow, WeekDetail };

const CHUNK_SIZE = 200;

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getListDataUncached(
  year: number,
  localityId: string | null,
  localOnly: boolean
): Promise<{ weeks: WeekRow[]; absenceAlertWeeks: number }> {
  const supabase = await createClient();
  const weeksData = getSundayWeeksInYear(year);
  const weeks = weeksData.map((w) => ({
    weekNumber: w.weekNumber,
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    label: w.label,
  }));
  const weekStarts = weeks.map((w) => formatDateYmd(w.weekStart));
  const weekStartRangeMin = weekStarts[0] ?? `${year}-01-01`;
  const weekStartRangeMax = weekStarts[weekStarts.length - 1] ?? `${year}-12-31`;

  const [settingsRes, localitiesRes, districtsRes, groupsRes] = await Promise.all([
    supabase.from("system_settings").select("key, value").eq("key", "absence_alert_weeks").maybeSingle(),
    supabase.from("localities").select("id"),
    supabase.from("districts").select("id, locality_id"),
    supabase.from("groups").select("id, district_id"),
  ]);

  const absenceAlertWeeks = Number((settingsRes.data as { value?: number } | null)?.value ?? 4);
  const allDistricts = (districtsRes.data ?? []) as { id: string; locality_id: string }[];
  const allGroups = (groupsRes.data ?? []) as { id: string; district_id: string }[];
  const districtIdsByLocality = new Map<string, string[]>();
  const groupIdsByLocality = new Map<string, string[]>();
  (localitiesRes.data ?? []).forEach((l: { id: string }) => {
    const dIds = allDistricts.filter((d) => d.locality_id === l.id).map((d) => d.id);
    districtIdsByLocality.set(l.id, dIds);
    const gIds = allGroups.filter((g) => dIds.includes(g.district_id)).map((g) => g.id);
    groupIdsByLocality.set(l.id, gIds);
  });
  const allDistrictIds = allDistricts.map((d) => d.id);
  const allGroupIds = allGroups.map((g) => g.id);
  const filterDistrictIds = localityId ? districtIdsByLocality.get(localityId) ?? [] : allDistrictIds;
  const filterGroupIds = localityId ? groupIdsByLocality.get(localityId) ?? [] : allGroupIds;

  // 週は年をまたぐことがある（例: 2026年W1 = 2025/12/28〜）。集計は週範囲で取得する
  const groupRecordsQuery =
    filterGroupIds.length > 0
      ? supabase
          .from("group_meeting_records")
          .select("id, week_start, group_id")
          .gte("week_start", weekStartRangeMin)
          .lte("week_start", weekStartRangeMax)
          .in("group_id", filterGroupIds)
      : Promise.resolve({ data: [] as { id: string; week_start: string; group_id: string }[] });

  const prayerRecordsQuery =
    filterDistrictIds.length > 0
      ? supabase
          .from("prayer_meeting_records")
          .select("id, week_start")
          .gte("week_start", weekStartRangeMin)
          .lte("week_start", weekStartRangeMax)
          .in("district_id", filterDistrictIds)
      : Promise.resolve({ data: [] as { id: string; week_start: string }[] });

  const [meetingsRes, groupRecordsRes, prayerRecordsRes, dispatchRes] = await Promise.all([
    supabase
      .from("lordsday_meeting_records")
      .select("id, event_date, meeting_type, district_id, group_id")
      .gte("event_date", weekStartRangeMin)
      .lte("event_date", weekStartRangeMax),
    groupRecordsQuery,
    prayerRecordsQuery,
    supabase
      .from("organic_dispatch_records")
      .select("member_id, week_start, group_id, dispatch_type, dispatch_date, dispatch_memo")
      .gte("week_start", weekStartRangeMin)
      .lte("week_start", weekStartRangeMax),
  ]);

  const meetings = (meetingsRes.data ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
    group_id: string | null;
  }[];
  const groupRecords = (groupRecordsRes.data ?? []) as { id: string; week_start: string; group_id: string }[];
  const prayerRecords = (prayerRecordsRes.data ?? []) as { id: string; week_start: string }[];
  const dispatchRows = (dispatchRes.data ?? []) as {
    member_id: string;
    week_start: string;
    group_id: string;
    dispatch_type: string | null;
    dispatch_date: string | null;
    dispatch_memo: string | null;
  }[];
  const dispatches = dispatchRows.filter(
    (d) =>
      d.dispatch_type != null &&
      d.dispatch_type !== "" &&
      d.dispatch_date != null &&
      (d.dispatch_date as string) !== "" &&
      d.dispatch_memo != null &&
      (d.dispatch_memo as string).trim() !== ""
  );

  const mainMeetingIds = new Set(
    meetings
      .filter((m) => m.meeting_type === "main" && m.district_id && filterDistrictIds.includes(m.district_id))
      .map((m) => m.id)
  );
  const groupRecordIds = new Set(groupRecords.map((r) => r.id));
  const groupRecordIdToWeekStart = new Map(groupRecords.map((r) => [r.id, r.week_start]));
  const prayerRecordIds = new Set(prayerRecords.map((r) => r.id));
  const prayerRecordIdToWeekStart = new Map(prayerRecords.map((r) => [r.id, r.week_start]));

  const meetingIdToDate = new Map(meetings.map((m) => [m.id, m.event_date]));
  const meetingIdToType = new Map(meetings.map((m) => [m.id, m.meeting_type]));

  let mainAttendance: { meeting_id: string; member_id: string }[] = [];
  let groupAttendance: { group_meeting_record_id: string; member_id: string }[] = [];
  let prayerAttendance: { prayer_meeting_record_id: string; member_id: string }[] = [];
  let localMemberIds = new Set<string>();
  if (localOnly) {
    const { data: localMembers } = await supabase
      .from("members")
      .select("id")
      .eq("is_local", true);
    localMemberIds = new Set(((localMembers ?? []) as { id: string }[]).map((m) => m.id));
  }
  if (meetings.length > 0) {
    const meetingIds = meetings.map((m) => m.id);
    const meetingChunks = chunk(meetingIds, CHUNK_SIZE);
    const attResults = await Promise.all(
      meetingChunks.map((ids) =>
        supabase.from("lordsday_meeting_attendance").select("meeting_id, member_id, attended").in("meeting_id", ids)
      )
    );
    const mainRaw = attResults.flatMap((r) => (r.data ?? []) as { meeting_id: string; member_id: string; attended?: boolean }[]);
    mainAttendance = mainRaw.filter((a) => a.attended !== false) as { meeting_id: string; member_id: string }[];
  }
  if (groupRecordIds.size > 0) {
    const recordIds = [...groupRecordIds];
    const recordChunks = chunk(recordIds, CHUNK_SIZE);
    const groupAttResults = await Promise.all(
      recordChunks.map((ids) =>
        supabase
          .from("group_meeting_attendance")
          .select("group_meeting_record_id, member_id, attended")
          .in("group_meeting_record_id", ids)
      )
    );
    const groupRaw = groupAttResults.flatMap(
      (r) => (r.data ?? []) as { group_meeting_record_id: string; member_id: string; attended?: boolean }[]
    );
    groupAttendance = groupRaw.filter((a) => a.attended !== false) as { group_meeting_record_id: string; member_id: string }[];
  }
  if (prayerRecordIds.size > 0) {
    const recordIds = [...prayerRecordIds];
    const recordChunks = chunk(recordIds, CHUNK_SIZE);
    const prayerAttResults = await Promise.all(
      recordChunks.map((ids) =>
        supabase
          .from("prayer_meeting_attendance")
          .select("prayer_meeting_record_id, member_id, attended")
          .in("prayer_meeting_record_id", ids)
      )
    );
    const prayerRaw = prayerAttResults.flatMap(
      (r) => (r.data ?? []) as { prayer_meeting_record_id: string; member_id: string; attended?: boolean }[]
    );
    prayerAttendance = prayerRaw.filter((a) => a.attended !== false) as {
      prayer_meeting_record_id: string;
      member_id: string;
    }[];
  }

  const weekMainMemberIds = new Map<string, Set<string>>();
  const weekPrayerCount = new Map<string, number>();
  const weekGroupCount = new Map<string, number>();
  const weekDispatchCount = new Map<string, number>();
  weekStarts.forEach((ws) => {
    weekMainMemberIds.set(ws, new Set());
    weekPrayerCount.set(ws, 0);
    weekGroupCount.set(ws, 0);
    weekDispatchCount.set(ws, 0);
  });

  /** アメリカ式: その日を含む週の日曜日を yyyy-MM-dd で返す */
  function getWeekStartForDate(dateStr: string): string {
    const d = parseYmd(dateStr);
    const sunday = addDays(d, -getDay(d));
    return format(sunday, "yyyy-MM-dd");
  }

  mainAttendance.forEach((a) => {
    if (localOnly && !localMemberIds.has(a.member_id)) return;
    const meetingId = a.meeting_id;
    const eventDate = meetingIdToDate.get(meetingId);
    const type = meetingIdToType.get(meetingId);
    if (!eventDate) return;
    const weekStart = getWeekStartForDate(eventDate);
    if (!weekStarts.includes(weekStart)) return;
    if (type === "main" && mainMeetingIds.has(meetingId)) {
      weekMainMemberIds.get(weekStart)?.add(a.member_id);
    }
  });
  prayerAttendance.forEach((a) => {
    if (localOnly && !localMemberIds.has(a.member_id)) return;
    const weekStart = prayerRecordIdToWeekStart.get(a.prayer_meeting_record_id);
    if (!weekStart || !weekStarts.includes(weekStart)) return;
    weekPrayerCount.set(weekStart, (weekPrayerCount.get(weekStart) ?? 0) + 1);
  });
  groupAttendance.forEach((a) => {
    if (localOnly && !localMemberIds.has(a.member_id)) return;
    const weekStart = groupRecordIdToWeekStart.get(a.group_meeting_record_id);
    if (!weekStart || !weekStarts.includes(weekStart)) return;
    weekGroupCount.set(weekStart, (weekGroupCount.get(weekStart) ?? 0) + 1);
  });

  dispatches.forEach((d) => {
    if (!filterGroupIds.includes(d.group_id)) return;
    const ws = d.week_start;
    if (weekDispatchCount.has(ws)) {
      weekDispatchCount.set(ws, (weekDispatchCount.get(ws) ?? 0) + 1);
    }
  });

  const weekRows: WeekRow[] = weeks.map((w) => {
    const ws = formatDateYmd(w.weekStart);
    return {
      weekNumber: w.weekNumber,
      weekStart: ws,
      weekEnd: formatDateYmd(w.weekEnd),
      label: w.label,
      mainCount: weekMainMemberIds.get(ws)?.size ?? 0,
      prayerCount: weekPrayerCount.get(ws) ?? 0,
      groupCount: weekGroupCount.get(ws) ?? 0,
      dispatchCount: weekDispatchCount.get(ws) ?? 0,
    };
  });

  return { weeks: weekRows, absenceAlertWeeks };
}

export async function getListData(
  year: number,
  localityId: string | null,
  localOnly: boolean = true
): Promise<{ weeks: WeekRow[]; absenceAlertWeeks: number }> {
  return getListDataUncached(year, localityId, localOnly);
}

export async function getWeekDetail(
  weekStart: string,
  localityId: string | null,
  absenceAlertWeeks: number,
  localOnly: boolean = true
): Promise<WeekDetail> {
  const supabase = await createClient();
  const weekStartDate = parseYmd(weekStart);
  const weekEndDate = addDays(weekStartDate, 6);
  const weekEnd = format(weekEndDate, "yyyy-MM-dd");

  const [districtsRes, groupsRes] = await Promise.all([
    supabase.from("districts").select("id, locality_id"),
    supabase.from("groups").select("id, district_id"),
  ]);
  const allDistricts = (districtsRes.data ?? []) as { id: string; locality_id: string }[];
  const allGroups = (groupsRes.data ?? []) as { id: string; district_id: string }[];
  const filterDistrictIds = localityId
    ? allDistricts.filter((d) => d.locality_id === localityId).map((d) => d.id)
    : allDistricts.map((d) => d.id);
  const filterGroupIds = localityId
    ? allGroups.filter((g) => filterDistrictIds.includes(g.district_id)).map((g) => g.id)
    : allGroups.map((g) => g.id);

  let dispatchPromise: Promise<{ data: unknown }>;
  if (localityId && filterGroupIds.length === 0) {
    dispatchPromise = Promise.resolve({ data: [] });
  } else {
    const dq = supabase
      .from("organic_dispatch_records")
      .select("member_id, group_id, dispatch_type, dispatch_date, dispatch_memo")
      .eq("week_start", weekStart);
    if (filterGroupIds.length > 0) dq.in("group_id", filterGroupIds);
    dispatchPromise = (async () => {
      const res = await dq;
      return { data: res.data };
    })();
  }
  const prayerRecordsQuery =
    filterDistrictIds.length > 0
      ? supabase
          .from("prayer_meeting_records")
          .select("id")
          .eq("week_start", weekStart)
          .in("district_id", filterDistrictIds)
      : Promise.resolve({ data: [] as { id: string }[] });

  const [meetingsRes, groupRecordsRes, prayerRecordsRes, dispatchRes, membersRes] = await Promise.all([
    supabase
      .from("lordsday_meeting_records")
      .select("id, event_date, meeting_type, district_id, group_id")
      .eq("meeting_type", "main")
      .eq("event_date", weekStart),
    filterGroupIds.length > 0
      ? supabase
          .from("group_meeting_records")
          .select("id, group_id")
          .eq("week_start", weekStart)
          .in("group_id", filterGroupIds)
      : Promise.resolve({ data: [] as { id: string; group_id: string }[] }),
    prayerRecordsQuery,
    dispatchPromise,
    supabase.from("members").select("id, name, furigana, is_local"),
  ]);

  const membersList = (membersRes.data ?? []) as {
    id: string;
    name: string;
    furigana: string | null;
    is_local: boolean;
  }[];
  const localMemberIds = localOnly
    ? new Set(membersList.filter((m) => m.is_local).map((m) => m.id))
    : null;
  const memberMap = new Map(membersList.map((m) => [m.id, m.name]));
  const furiganaMap = new Map(
    membersList.map((m) => [m.id, (m.furigana ?? m.name).trim() || m.name])
  );
  const sortByFurigana = (
    a: { memberId: string; name: string },
    b: { memberId: string; name: string }
  ) => {
    const fa = furiganaMap.get(a.memberId) ?? a.name;
    const fb = furiganaMap.get(b.memberId) ?? b.name;
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  };

  const mainMeetings = (meetingsRes.data ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
    group_id: string | null;
  }[];
  const groupRecordsThisWeek = (groupRecordsRes.data ?? []) as { id: string; group_id: string }[];
  const groupRecordIdsThisWeek = new Set(groupRecordsThisWeek.map((r) => r.id));
  const prayerRecordsThisWeek = (prayerRecordsRes.data ?? []) as { id: string }[];
  const prayerRecordIdsThisWeek = new Set(prayerRecordsThisWeek.map((r) => r.id));
  const dispatchRowsDetail = (dispatchRes.data ?? []) as {
    member_id: string;
    group_id: string;
    dispatch_type: string | null;
    dispatch_date: string | null;
    dispatch_memo: string | null;
  }[];
  const completeDispatches = dispatchRowsDetail.filter(
    (d) =>
      d.dispatch_type != null &&
      d.dispatch_type !== "" &&
      d.dispatch_date != null &&
      (d.dispatch_date as string) !== "" &&
      d.dispatch_memo != null &&
      (d.dispatch_memo as string).trim() !== ""
  );
  const dispatchMemberIds = new Set(completeDispatches.map((d) => d.member_id));

  const mainMeetingIds = new Set(
    mainMeetings
      .filter((m) => m.district_id && filterDistrictIds.includes(m.district_id))
      .map((m) => m.id)
  );

  let mainAttendedThisWeek = new Set<string>();
  let mainAbsentThisWeek = new Map<string, string | null>();
  let prayerAttendedThisWeek = new Set<string>();
  let groupAttendedThisWeek = new Set<string>();
  if (mainMeetingIds.size > 0) {
    const { data: mainAttData } = await supabase
      .from("lordsday_meeting_attendance")
      .select("meeting_id, member_id, attended, memo")
      .in("meeting_id", [...mainMeetingIds]);
    (mainAttData ?? []).forEach((a: { meeting_id: string; member_id: string; attended?: boolean; memo?: string | null }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      if (!mainMeetingIds.has(a.meeting_id)) return;
      if (a.attended === false) {
        mainAbsentThisWeek.set(a.member_id, a.memo ?? null);
      } else {
        mainAttendedThisWeek.add(a.member_id);
      }
    });
  }
  if (prayerRecordIdsThisWeek.size > 0) {
    const { data: prayerAttData } = await supabase
      .from("prayer_meeting_attendance")
      .select("member_id, attended")
      .in("prayer_meeting_record_id", [...prayerRecordIdsThisWeek]);
    (prayerAttData ?? [])
      .filter((a: { attended?: boolean }) => a.attended !== false)
      .forEach((a: { member_id: string }) => {
        if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
        prayerAttendedThisWeek.add(a.member_id);
      });
  }
  if (groupRecordIdsThisWeek.size > 0) {
    const { data: groupAttData } = await supabase
      .from("group_meeting_attendance")
      .select("member_id, attended")
      .in("group_meeting_record_id", [...groupRecordIdsThisWeek]);
    (groupAttData ?? [])
      .filter((a: { attended?: boolean }) => a.attended !== false)
      .forEach((a: { member_id: string }) => {
        if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
        groupAttendedThisWeek.add(a.member_id);
      });
  }

  const mainAttendees: { memberId: string; name: string }[] = Array.from(mainAttendedThisWeek)
    .map((id) => ({ memberId: id, name: memberMap.get(id) ?? "" }))
    .filter((m) => m.name)
    .sort(sortByFurigana);
  const mainAbsent: { memberId: string; name: string; memo: string | null }[] = Array.from(mainAbsentThisWeek.entries())
    .map(([id, memo]) => ({ memberId: id, name: memberMap.get(id) ?? "", memo }))
    .filter((m) => m.name)
    .sort(sortByFurigana);
  const prayerAttendees: { memberId: string; name: string }[] = Array.from(prayerAttendedThisWeek)
    .map((id) => ({ memberId: id, name: memberMap.get(id) ?? "" }))
    .filter((m) => m.name)
    .sort(sortByFurigana);
  const groupAttendees: { memberId: string; name: string }[] = Array.from(groupAttendedThisWeek)
    .map((id) => ({ memberId: id, name: memberMap.get(id) ?? "" }))
    .filter((m) => m.name)
    .sort(sortByFurigana);
  const dispatchNames: { memberId: string; name: string }[] = Array.from(dispatchMemberIds)
    .map((id) => ({ memberId: id, name: memberMap.get(id) ?? "" }))
    .filter((m) => m.name)
    .sort(sortByFurigana);

  return { mainAttendees, mainAbsent, prayerAttendees, groupAttendees, dispatchNames };
}

/** デバッグ: 主日の出席者をローカル／非ローカル別・フリガナ順で取得 */
export type DebugJan4Attendee = { memberId: string; name: string; furigana: string; isLocal: boolean };

/** 指定した日曜日の主日出席者（ローカル／非ローカル別）。dateStr は yyyy-MM-dd（その週の日曜日）。 */
export async function getDebugSundayAttendees(dateStr: string): Promise<{
  date: string;
  local: DebugJan4Attendee[];
  nonLocal: DebugJan4Attendee[];
}> {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("lordsday_meeting_records")
    .select("id")
    .eq("meeting_type", "main")
    .eq("event_date", dateStr);

  const meetingIds = (meetings ?? []).map((m: { id: string }) => m.id);
  if (meetingIds.length === 0) {
    return { date: dateStr, local: [], nonLocal: [] };
  }

  const { data: attData } = await supabase
    .from("lordsday_meeting_attendance")
    .select("member_id, attended")
    .in("meeting_id", meetingIds);

  const memberIds = [
    ...new Set(
      (attData ?? [])
        .filter((a: { attended?: boolean }) => a.attended !== false)
        .map((a: { member_id: string }) => a.member_id)
    ),
  ];
  if (memberIds.length === 0) {
    return { date: dateStr, local: [], nonLocal: [] };
  }

  const { data: members } = await supabase
    .from("members")
    .select("id, name, furigana, is_local")
    .in("id", memberIds);

  const list = (members ?? []).map(
    (m: { id: string; name: string; furigana: string | null; is_local: boolean }) => ({
      memberId: m.id,
      name: m.name,
      furigana: (m.furigana ?? m.name).trim() || m.name,
      isLocal: m.is_local,
    })
  );

  const sortByFurigana = (a: DebugJan4Attendee, b: DebugJan4Attendee) =>
    a.furigana < b.furigana ? -1 : a.furigana > b.furigana ? 1 : 0;

  const local = list.filter((m) => m.isLocal).sort(sortByFurigana);
  const nonLocal = list.filter((m) => !m.isLocal).sort(sortByFurigana);

  return { date: dateStr, local, nonLocal };
}

/** デバッグ: 1/4を含む週の主日の出席者（getDebugSundayAttendees のラッパー） */
export async function getDebugJan4SundayAttendees(
  year: number = new Date().getFullYear()
): Promise<{
  date: string;
  local: DebugJan4Attendee[];
  nonLocal: DebugJan4Attendee[];
}> {
  const jan4 = new Date(year, 0, 4);
  const sunday = addDays(jan4, -getDay(jan4));
  const dateStr = format(sunday, "yyyy-MM-dd");
  return getDebugSundayAttendees(dateStr);
}

/** 同一週に同一人物が複数回登録されている主日出席レコードを検出（削除候補の特定用） */
export type DuplicateMainAttendanceItem = {
  attendanceId: string;
  meetingId: string;
  eventDate: string;
};
export type DuplicateMainAttendanceGroup = {
  weekStart: string;
  memberId: string;
  memberName: string;
  records: DuplicateMainAttendanceItem[];
};

export async function getDuplicateMainAttendance(
  year: number = new Date().getFullYear(),
  weekStartFilter?: string
): Promise<DuplicateMainAttendanceGroup[]> {
  const supabase = await createClient();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: meetings } = await supabase
    .from("lordsday_meeting_records")
    .select("id, event_date")
    .eq("meeting_type", "main")
    .gte("event_date", yearStart)
    .lte("event_date", yearEnd);

  const mainMeetings = (meetings ?? []) as { id: string; event_date: string }[];
  if (mainMeetings.length === 0) return [];

  const meetingIdToDate = new Map(mainMeetings.map((m) => [m.id, m.event_date]));
  const mainMeetingIds = new Set(mainMeetings.map((m) => m.id));

  const { data: attData } = await supabase
    .from("lordsday_meeting_attendance")
    .select("id, meeting_id, member_id, attended")
    .in("meeting_id", mainMeetings.map((m) => m.id));

  const rows = (attData ?? []).filter(
    (a: { attended?: boolean }) => a.attended !== false
  ) as { id: string; meeting_id: string; member_id: string }[];

  function getWeekStart(dateStr: string): string {
    const d = parseYmd(dateStr);
    const sunday = addDays(d, -getDay(d));
    return format(sunday, "yyyy-MM-dd");
  }

  const byWeekAndMember = new Map<string, { id: string; meeting_id: string; event_date: string }[]>();
  for (const r of rows) {
    const eventDate = meetingIdToDate.get(r.meeting_id);
    if (!eventDate || !mainMeetingIds.has(r.meeting_id)) continue;
    const weekStart = getWeekStart(eventDate);
    if (weekStartFilter && weekStart !== weekStartFilter) continue;
    const key = `${weekStart}:${r.member_id}`;
    if (!byWeekAndMember.has(key)) byWeekAndMember.set(key, []);
    byWeekAndMember.get(key)!.push({
      id: r.id,
      meeting_id: r.meeting_id,
      event_date: eventDate,
    });
  }

  const memberIds = [
    ...new Set(
      [...byWeekAndMember.entries()]
        .filter(([, recs]) => recs.length > 1)
        .flatMap(([k]) => [k.split(":")[1]])
    ),
  ];
  if (memberIds.length === 0) return [];

  const { data: members } = await supabase
    .from("members")
    .select("id, name")
    .in("id", memberIds);
  const memberMap = new Map(
    (members ?? []).map((m: { id: string; name: string }) => [m.id, m.name])
  );

  const result: DuplicateMainAttendanceGroup[] = [];
  for (const [key, recs] of byWeekAndMember.entries()) {
    if (recs.length <= 1) continue;
    const [weekStart, memberId] = key.split(":");
    result.push({
      weekStart,
      memberId,
      memberName: memberMap.get(memberId) ?? "",
      records: recs.map((r) => ({
        attendanceId: r.id,
        meetingId: r.meeting_id,
        eventDate: r.event_date,
      })),
    });
  }
  result.sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : a.memberName.localeCompare(b.memberName)));
  return result;
}

export async function deleteAttendanceRecord(attendanceId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("lordsday_meeting_attendance").delete().eq("id", attendanceId);
  if (error) return { error: error.message };
  return {};
}

