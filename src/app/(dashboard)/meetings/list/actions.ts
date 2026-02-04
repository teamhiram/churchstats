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

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getListData(
  year: number,
  localityId: string | null,
  localOnly: boolean = true
): Promise<{ weeks: WeekRow[]; absenceAlertWeeks: number }> {
  const supabase = await createClient();
  // 主日集会と同じ「日曜基準」: n週目 = その年の第n日曜の週（月曜〜日曜）
  const sundays = getSundaysInYear(year);
  const weeks = sundays.map((s) => {
    const weekStart = addDays(s.date, -6); // その週の月曜
    const weekEnd = s.date; // 日曜
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

  const [meetingsRes, dispatchRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, event_date, meeting_type, district_id, group_id")
      .gte("event_date", yearStart)
      .lte("event_date", yearEnd),
    supabase
      .from("organic_dispatch_records")
      .select("member_id, week_start, group_id")
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
  const dispatches = (dispatchRes.data ?? []) as { member_id: string; week_start: string; group_id: string }[];

  const mainMeetingIds = new Set(
    meetings
      .filter((m) => m.meeting_type === "main" && m.district_id && filterDistrictIds.includes(m.district_id))
      .map((m) => m.id)
  );
  const groupMeetingIds = new Set(
    meetings
      .filter((m) => m.meeting_type === "group" && m.group_id && filterGroupIds.includes(m.group_id))
      .map((m) => m.id)
  );

  const meetingIdToDate = new Map(meetings.map((m) => [m.id, m.event_date]));
  const meetingIdToType = new Map(meetings.map((m) => [m.id, m.meeting_type]));

  let attendance: { meeting_id: string; member_id: string }[] = [];
  let localMemberIds = new Set<string>();
  if (localOnly) {
    const { data: localMembers } = await supabase
      .from("members")
      .select("id")
      .eq("is_local", true);
    localMemberIds = new Set(((localMembers ?? []) as { id: string }[]).map((m) => m.id));
  }
  if (meetings.length > 0) {
    const { data: attData } = await supabase
      .from("attendance_records")
      .select("meeting_id, member_id")
      .in("meeting_id", meetings.map((m) => m.id));
    attendance = (attData ?? []) as { meeting_id: string; member_id: string }[];
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

  attendance.forEach((a) => {
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
    if (type === "group" && groupMeetingIds.has(meetingId)) {
      weekGroupCount.set(weekStart, (weekGroupCount.get(weekStart) ?? 0) + 1);
    }
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
      .select("member_id, group_id")
      .eq("week_start", weekStart);
    if (filterGroupIds.length > 0) dq.in("group_id", filterGroupIds);
    dispatchPromise = (async () => {
      const res = await dq;
      return { data: res.data };
    })();
  }
  const [meetingsRes, dispatchRes, membersRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, event_date, meeting_type, district_id, group_id")
      .or(`and(meeting_type.eq.main,event_date.eq.${weekEnd}),and(meeting_type.eq.group,event_date.gte.${weekStart},event_date.lte.${weekEnd})`),
    dispatchPromise,
    supabase.from("members").select("id, name, is_local"),
  ]);

  const membersList = (membersRes.data ?? []) as { id: string; name: string; is_local: boolean }[];
  const localMemberIds = localOnly
    ? new Set(membersList.filter((m) => m.is_local).map((m) => m.id))
    : null;
  const memberMap = new Map(membersList.map((m) => [m.id, m.name]));

  const meetings = (meetingsRes.data ?? []) as {
    id: string;
    event_date: string;
    meeting_type: string;
    district_id: string | null;
    group_id: string | null;
  }[];
  const dispatchMemberIds = new Set(
    ((dispatchRes.data ?? []) as { member_id: string }[]).map((d) => d.member_id)
  );

  const mainMeetings = meetings.filter(
    (m) => m.meeting_type === "main" && m.district_id && filterDistrictIds.includes(m.district_id)
  );
  const groupMeetings = meetings.filter(
    (m) => m.meeting_type === "group" && m.group_id && filterGroupIds.includes(m.group_id)
  );

  const mainMeetingIds = new Set(mainMeetings.map((m) => m.id));
  const groupMeetingIds = new Set(groupMeetings.map((m) => m.id));

  let mainAttendedThisWeek = new Set<string>();
  let groupAttendedThisWeek = new Set<string>();
  if (meetings.length > 0) {
    const { data: attData } = await supabase
      .from("attendance_records")
      .select("meeting_id, member_id")
      .in("meeting_id", meetings.map((m) => m.id));
    (attData ?? []).forEach((a: { meeting_id: string; member_id: string }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      if (mainMeetingIds.has(a.meeting_id)) mainAttendedThisWeek.add(a.member_id);
      if (groupMeetingIds.has(a.meeting_id)) groupAttendedThisWeek.add(a.member_id);
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
      .filter((m) => m.meeting_type === "main" && m.district_id && filterDistrictIds.includes(m.district_id))
      .map((m) => m.id)
  );
  const pastGroupIds = new Set(
    pastM
      .filter((m) => m.meeting_type === "group" && m.group_id && filterGroupIds.includes(m.group_id))
      .map((m) => m.id)
  );
  const allPastIds = [...pastMainIds, ...pastGroupIds];
  if (allPastIds.length > 0) {
    const { data: pastAtt } = await supabase
      .from("attendance_records")
      .select("meeting_id, member_id")
      .in("meeting_id", allPastIds);
    (pastAtt ?? []).forEach((a: { meeting_id: string; member_id: string }) => {
      if (localOnly && localMemberIds && !localMemberIds.has(a.member_id)) return;
      if (pastMainIds.has(a.meeting_id)) mainAttendedPastX.add(a.member_id);
      if (pastGroupIds.has(a.meeting_id)) groupAttendedPastX.add(a.member_id);
    });
  }

  const mainAbsent: { memberId: string; name: string; inDispatch: boolean }[] = [];
  const groupAbsent: { memberId: string; name: string; inDispatch: boolean }[] = [];
  mainAttendedPastX.forEach((memberId) => {
    if (!mainAttendedThisWeek.has(memberId)) {
      mainAbsent.push({
        memberId,
        name: memberMap.get(memberId) ?? "",
        inDispatch: dispatchMemberIds.has(memberId),
      });
    }
  });
  groupAttendedPastX.forEach((memberId) => {
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

