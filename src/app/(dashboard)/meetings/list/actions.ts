"use server";

import { createClient } from "@/lib/supabase/server";
import { addDays, format } from "date-fns";
import { getSundaysInYear, formatDateYmd } from "@/lib/weekUtils";

export type WeekRow = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  mainCount: number;
  groupCount: number;
  dispatchCount: number;
};

export type WeekDetail = {
  mainAbsent: { memberId: string; name: string; inDispatch: boolean }[];
  groupAbsent: { memberId: string; name: string; inDispatch: boolean }[];
  dispatchNames: { memberId: string; name: string }[];
};

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
  const sundays = getSundaysInYear(year);
  const weeks = sundays.map((s) => {
    const weekStart = addDays(s.date, -6);
    const weekEnd = s.date;
    return {
      weekNumber: s.weekNumber,
      weekStart,
      weekEnd,
      label: `${s.weekNumber}週目（${format(weekStart, "yyyy/MM/dd")} - ${format(weekEnd, "yyyy/MM/dd")}）`,
    };
  });
  const weekStarts = weeks.map((w) => formatDateYmd(w.weekStart));

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

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const groupRecordsQuery =
    filterGroupIds.length > 0
      ? supabase
          .from("group_meeting_records")
          .select("id, week_start, group_id")
          .gte("week_start", yearStart)
          .lte("week_start", yearEnd)
          .in("group_id", filterGroupIds)
      : Promise.resolve({ data: [] as { id: string; week_start: string; group_id: string }[] });

  const [meetingsRes, groupRecordsRes, dispatchRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, event_date, meeting_type, district_id, group_id")
      .gte("event_date", yearStart)
      .lte("event_date", yearEnd),
    groupRecordsQuery,
    supabase
      .from("organic_dispatch_records")
      .select("member_id, week_start, group_id, dispatch_type, dispatch_date, dispatch_memo")
      .gte("week_start", yearStart)
      .lte("week_start", yearEnd),
  ]);

  const meetings = (meetingsRes.data ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
    group_id: string | null;
  }[];
  const groupRecords = (groupRecordsRes.data ?? []) as { id: string; week_start: string; group_id: string }[];
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

  const meetingIdToDate = new Map(meetings.map((m) => [m.id, m.event_date]));
  const meetingIdToType = new Map(meetings.map((m) => [m.id, m.meeting_type]));

  let mainAttendance: { meeting_id: string; member_id: string }[] = [];
  let groupAttendance: { group_meeting_record_id: string; member_id: string }[] = [];
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
        supabase.from("attendance_records").select("meeting_id, member_id").in("meeting_id", ids)
      )
    );
    mainAttendance = attResults.flatMap((r) => (r.data ?? []) as { meeting_id: string; member_id: string }[]);
  }
  if (groupRecordIds.size > 0) {
    const recordIds = [...groupRecordIds];
    const recordChunks = chunk(recordIds, CHUNK_SIZE);
    const groupAttResults = await Promise.all(
      recordChunks.map((ids) =>
        supabase
          .from("group_meeting_attendance")
          .select("group_meeting_record_id, member_id")
          .in("group_meeting_record_id", ids)
      )
    );
    groupAttendance = groupAttResults.flatMap(
      (r) => (r.data ?? []) as { group_meeting_record_id: string; member_id: string }[]
    );
  }

  const weekMainCount = new Map<string, number>();
  const weekGroupCount = new Map<string, number>();
  const weekDispatchCount = new Map<string, number>();
  weekStarts.forEach((ws) => {
    weekMainCount.set(ws, 0);
    weekGroupCount.set(ws, 0);
    weekDispatchCount.set(ws, 0);
  });

  function getWeekStartForDate(dateStr: string): string {
    const d = parseYmd(dateStr);
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addDays(d, mondayOffset);
    return format(monday, "yyyy-MM-dd");
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
      weekMainCount.set(weekStart, (weekMainCount.get(weekStart) ?? 0) + 1);
    }
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
      mainCount: weekMainCount.get(ws) ?? 0,
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
  const [meetingsRes, groupRecordsRes, dispatchRes, membersRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, event_date, meeting_type, district_id, group_id")
      .eq("meeting_type", "main")
      .eq("event_date", weekEnd),
    filterGroupIds.length > 0
      ? supabase
          .from("group_meeting_records")
          .select("id, group_id")
          .eq("week_start", weekStart)
          .in("group_id", filterGroupIds)
      : Promise.resolve({ data: [] as { id: string; group_id: string }[] }),
    dispatchPromise,
    supabase.from("members").select("id, name, is_local"),
  ]);

  const membersList = (membersRes.data ?? []) as { id: string; name: string; is_local: boolean }[];
  const localMemberIds = localOnly
    ? new Set(membersList.filter((m) => m.is_local).map((m) => m.id))
    : null;
  const memberMap = new Map(membersList.map((m) => [m.id, m.name]));

  const mainMeetings = (meetingsRes.data ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
    group_id: string | null;
  }[];
  const groupRecordsThisWeek = (groupRecordsRes.data ?? []) as { id: string; group_id: string }[];
  const groupRecordIdsThisWeek = new Set(groupRecordsThisWeek.map((r) => r.id));
  const groupIdsThisWeek = new Set(groupRecordsThisWeek.map((r) => r.group_id));
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
  let groupAttendedThisWeek = new Set<string>();
  if (mainMeetingIds.size > 0) {
    const { data: mainAttData } = await supabase
      .from("attendance_records")
      .select("meeting_id, member_id")
      .in("meeting_id", [...mainMeetingIds]);
    (mainAttData ?? []).forEach((a: { meeting_id: string; member_id: string }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      if (mainMeetingIds.has(a.meeting_id)) mainAttendedThisWeek.add(a.member_id);
    });
  }
  if (groupRecordIdsThisWeek.size > 0) {
    const { data: groupAttData } = await supabase
      .from("group_meeting_attendance")
      .select("member_id")
      .in("group_meeting_record_id", [...groupRecordIdsThisWeek]);
    (groupAttData ?? []).forEach((a: { member_id: string }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      groupAttendedThisWeek.add(a.member_id);
    });
  }

  const dispatchNames: { memberId: string; name: string }[] = Array.from(dispatchMemberIds).map((id) => ({
    memberId: id,
    name: memberMap.get(id) ?? "",
  }));

  const pastStartDate = addDays(weekStartDate, -7 * absenceAlertWeeks);
  const pastStart = format(pastStartDate, "yyyy-MM-dd");

  let mainAttendedPastX = new Set<string>();
  let groupAttendedPastX = new Set<string>();
  const { data: pastMeetings } = await supabase
    .from("meetings")
    .select("id, event_date, meeting_type, district_id, group_id")
    .eq("meeting_type", "main")
    .gte("event_date", pastStart)
    .lt("event_date", weekStart);
  const pastM = (pastMeetings ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
    group_id: string | null;
  }[];
  const pastMainIds = new Set(
    pastM
      .filter((m) => m.district_id && filterDistrictIds.includes(m.district_id))
      .map((m) => m.id)
  );
  let pastGroupRecordIds = new Set<string>();
  if (filterGroupIds.length > 0) {
    const { data: pastGroupRecords } = await supabase
      .from("group_meeting_records")
      .select("id")
      .gte("week_start", pastStart)
      .lt("week_start", weekStart)
      .in("group_id", filterGroupIds);
    pastGroupRecordIds = new Set(((pastGroupRecords ?? []) as { id: string }[]).map((r) => r.id));
  }
  if (pastMainIds.size > 0) {
    const { data: pastMainAtt } = await supabase
      .from("attendance_records")
      .select("meeting_id, member_id")
      .in("meeting_id", [...pastMainIds]);
    (pastMainAtt ?? []).forEach((a: { meeting_id: string; member_id: string }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      if (pastMainIds.has(a.meeting_id)) mainAttendedPastX.add(a.member_id);
    });
  }
  if (pastGroupRecordIds.size > 0) {
    const { data: pastGroupAtt } = await supabase
      .from("group_meeting_attendance")
      .select("member_id")
      .in("group_meeting_record_id", [...pastGroupRecordIds]);
    (pastGroupAtt ?? []).forEach((a: { member_id: string }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      groupAttendedPastX.add(a.member_id);
    });
  }

  const mainMeetingDistrictIds = [...new Set(mainMeetings.map((m) => m.district_id).filter(Boolean))] as string[];
  let mainRegularMemberIds = new Set<string>();
  if (mainMeetingDistrictIds.length > 0) {
    const { data: districtRegularRows } = await supabase
      .from("district_regular_list")
      .select("member_id")
      .in("district_id", mainMeetingDistrictIds);
    (districtRegularRows ?? []).forEach((r: { member_id: string }) => mainRegularMemberIds.add(r.member_id));
  }
  const useMainRegular = mainRegularMemberIds.size > 0;
  const mainSourceIds = useMainRegular ? mainRegularMemberIds : mainAttendedPastX;

  let groupRegularMemberIds = new Set<string>();
  if (groupIdsThisWeek.size > 0) {
    const { data: groupRegularRows } = await supabase
      .from("group_regular_list")
      .select("member_id")
      .in("group_id", [...groupIdsThisWeek]);
    (groupRegularRows ?? []).forEach((r: { member_id: string }) => groupRegularMemberIds.add(r.member_id));
  }
  const useGroupRegular = groupRegularMemberIds.size > 0;
  const groupSourceIds = useGroupRegular ? groupRegularMemberIds : groupAttendedPastX;

  const mainAbsent: { memberId: string; name: string; inDispatch: boolean }[] = [];
  const groupAbsent: { memberId: string; name: string; inDispatch: boolean }[] = [];
  mainSourceIds.forEach((memberId) => {
    if (localOnly && localMemberIds && !localMemberIds.has(memberId)) return;
    if (!mainAttendedThisWeek.has(memberId)) {
      mainAbsent.push({
        memberId,
        name: memberMap.get(memberId) ?? "",
        inDispatch: dispatchMemberIds.has(memberId),
      });
    }
  });
  groupSourceIds.forEach((memberId) => {
    if (localOnly && localMemberIds && !localMemberIds.has(memberId)) return;
    if (!groupAttendedThisWeek.has(memberId)) {
      groupAbsent.push({
        memberId,
        name: memberMap.get(memberId) ?? "",
        inDispatch: dispatchMemberIds.has(memberId),
      });
    }
  });

  return { mainAbsent, groupAbsent, dispatchNames };
}

