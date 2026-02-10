"use server";

import { createClient } from "@/lib/supabase/server";
import { addDays, format } from "date-fns";
import { getThisWeekByLastSunday, formatDateYmd } from "@/lib/weekUtils";

export type DispatchMonitorAbsent = { memberId: string; name: string; dispatched: boolean };

export type DispatchMonitorData = {
  weekLabel: string;
  mainAbsent: DispatchMonitorAbsent[];
  groupAbsent: DispatchMonitorAbsent[];
};

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 今週（アメリカ式・日曜〜土曜）の主日・小組欠席者と、派遣済/未派遣を返す */
export async function getDispatchMonitorData(): Promise<DispatchMonitorData> {
  const supabase = await createClient();
  const { weekStart, weekEnd } = getThisWeekByLastSunday();
  const weekStartIso = formatDateYmd(weekStart);
  const weekEndIso = formatDateYmd(weekEnd);
  const weekLabel = `${format(weekStart, "yyyy/MM/dd")} - ${format(weekEnd, "yyyy/MM/dd")}`;

  const [mainMeetingsRes, groupRecordsRes, districtRegularRes, groupRegularRes, membersRes, dispatchRes] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, district_id")
        .eq("meeting_type", "main")
        .eq("event_date", weekStartIso),
      supabase
        .from("group_meeting_records")
        .select("id, group_id")
        .eq("week_start", weekStartIso),
      supabase.from("district_regular_list").select("district_id, member_id"),
      supabase.from("group_regular_list").select("group_id, member_id"),
      supabase.from("members").select("id, name, is_local"),
      supabase
        .from("organic_dispatch_records")
        .select("member_id, dispatch_type, dispatch_date, dispatch_memo")
        .gte("dispatch_date", weekStartIso)
        .lte("dispatch_date", weekEndIso),
    ]);

  const mainMeetings = (mainMeetingsRes.data ?? []) as { id: string; district_id: string | null }[];
  const groupRecords = (groupRecordsRes.data ?? []) as { id: string; group_id: string }[];
  const mainMeetingIds = new Set(mainMeetings.map((m) => m.id));
  const mainMeetingDistrictIds = [...new Set(mainMeetings.map((m) => m.district_id).filter(Boolean))] as string[];
  const groupRecordIds = new Set(groupRecords.map((r) => r.id));
  const groupIdsThisWeek = new Set(groupRecords.map((r) => r.group_id));

  let mainAttData: { meeting_id: string; member_id: string; attended?: boolean }[] = [];
  if (mainMeetingIds.size > 0) {
    const { data } = await supabase
      .from("attendance_records")
      .select("meeting_id, member_id, attended")
      .in("meeting_id", [...mainMeetingIds]);
    mainAttData = (data ?? []) as { meeting_id: string; member_id: string; attended?: boolean }[];
  }
  let groupAttData: { group_meeting_record_id: string; member_id: string; attended?: boolean }[] = [];
  if (groupRecordIds.size > 0) {
    const { data } = await supabase
      .from("group_meeting_attendance")
      .select("group_meeting_record_id, member_id, attended")
      .in("group_meeting_record_id", [...groupRecordIds]);
    groupAttData = (data ?? []) as { group_meeting_record_id: string; member_id: string; attended?: boolean }[];
  }

  const mainAttendedThisWeek = new Set(
    mainAttData.filter((a) => a.attended !== false).map((a) => a.member_id)
  );
  const groupAttendedThisWeek = new Set(
    groupAttData.filter((a) => a.attended !== false).map((a) => a.member_id)
  );

  const districtRegularRows = (districtRegularRes.data ?? []) as { district_id: string; member_id: string }[];
  const groupRegularRows = (groupRegularRes.data ?? []) as { group_id: string; member_id: string }[];
  const mainRegularMemberIds = new Set(
    districtRegularRows.filter((r) => mainMeetingDistrictIds.includes(r.district_id)).map((r) => r.member_id)
  );
  const groupRegularMemberIds = new Set(
    groupRegularRows.filter((r) => groupIdsThisWeek.has(r.group_id)).map((r) => r.member_id)
  );

  const membersList = (membersRes.data ?? []) as { id: string; name: string; is_local: boolean }[];
  const memberMap = new Map(membersList.map((m) => [m.id, m.name]));
  const localMemberIds = new Set(membersList.filter((m) => m.is_local).map((m) => m.id));

  let mainSourceIds = new Set(mainRegularMemberIds);
  let groupSourceIds = new Set(groupRegularMemberIds);
  if (mainRegularMemberIds.size === 0 && mainMeetingDistrictIds.length > 0) {
    const pastStart = format(addDays(parseYmd(weekStartIso), -7 * 4), "yyyy-MM-dd");
    const { data: pastMeetings } = await supabase
      .from("meetings")
      .select("id, district_id")
      .eq("meeting_type", "main")
      .gte("event_date", pastStart)
      .lt("event_date", weekStartIso);
    const pastMainIds = new Set(
      ((pastMeetings ?? []) as { id: string; district_id: string | null }[])
        .filter((m) => m.district_id && mainMeetingDistrictIds.includes(m.district_id))
        .map((m) => m.id)
    );
    if (pastMainIds.size > 0) {
      const { data: pastAtt } = await supabase
        .from("attendance_records")
        .select("member_id, attended")
        .in("meeting_id", [...pastMainIds]);
      (pastAtt ?? [])
        .filter((a: { attended?: boolean }) => a.attended !== false)
        .forEach((a: { member_id: string }) => mainSourceIds.add(a.member_id));
    }
  }
  if (groupRegularMemberIds.size === 0 && groupIdsThisWeek.size > 0) {
    const pastStart = format(addDays(parseYmd(weekStartIso), -7 * 4), "yyyy-MM-dd");
    const { data: pastGroupRecords } = await supabase
      .from("group_meeting_records")
      .select("id")
      .gte("week_start", pastStart)
      .lt("week_start", weekStartIso)
      .in("group_id", [...groupIdsThisWeek]);
    const pastGroupRecordIds = new Set(((pastGroupRecords ?? []) as { id: string }[]).map((r) => r.id));
    if (pastGroupRecordIds.size > 0) {
      const { data: pastGroupAtt } = await supabase
        .from("group_meeting_attendance")
        .select("member_id, attended")
        .in("group_meeting_record_id", [...pastGroupRecordIds]);
      (pastGroupAtt ?? [])
        .filter((a: { attended?: boolean }) => a.attended !== false)
        .forEach((a: { member_id: string }) => groupSourceIds.add(a.member_id));
    }
  }

  const mainAbsentMemberIds = [...mainSourceIds].filter(
    (id) => localMemberIds.has(id) && !mainAttendedThisWeek.has(id)
  );
  const groupAbsentMemberIds = [...groupSourceIds].filter(
    (id) => localMemberIds.has(id) && !groupAttendedThisWeek.has(id)
  );

  const dispatchRows = (dispatchRes.data ?? []) as {
    member_id: string;
    dispatch_type: string | null;
    dispatch_date: string | null;
    dispatch_memo: string | null;
  }[];
  const dispatchedMemberIds = new Set(
    dispatchRows.filter(
      (d) =>
        d.dispatch_type != null &&
        d.dispatch_type !== "" &&
        d.dispatch_date != null &&
        (d.dispatch_date as string) !== "" &&
        d.dispatch_memo != null &&
        (d.dispatch_memo as string).trim() !== ""
    ).map((d) => d.member_id)
  );

  const mainAbsent: DispatchMonitorAbsent[] = [...new Set(mainAbsentMemberIds)].map((memberId) => ({
    memberId,
    name: memberMap.get(memberId) ?? "",
    dispatched: dispatchedMemberIds.has(memberId),
  }));
  const groupAbsent: DispatchMonitorAbsent[] = [...new Set(groupAbsentMemberIds)].map((memberId) => ({
    memberId,
    name: memberMap.get(memberId) ?? "",
    dispatched: dispatchedMemberIds.has(memberId),
  }));

  return { weekLabel, mainAbsent, groupAbsent };
}
