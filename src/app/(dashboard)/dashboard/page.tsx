import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile, getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import { StatisticsChartsDynamic } from "../statistics/StatisticsChartsDynamic";
import { DispatchMonitor } from "./DispatchMonitor";
import { AttendanceMatrix } from "./AttendanceMatrix";
import { getDispatchMonitorData } from "./actions";
import { getAttendanceMatrixData } from "./attendanceMatrixActions";
import { getCachedLocalities } from "@/lib/cachedData";

export default async function DashboardPage() {
  const { localityName } = await getCurrentUserWithProfile();
  const supabase = await createClient();
  const currentLocalityId = await getEffectiveCurrentLocalityId();
  const localities = await getCachedLocalities();
  const currentLocalityName = currentLocalityId != null ? localities.find((l) => l.id === currentLocalityId)?.name ?? localityName : localityName;

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const yearStartIso = oneYearAgo.toISOString().slice(0, 10);

  const membersCountQuery = supabase.from("members").select("id", { count: "exact", head: true });
  const districtsCountQuery = supabase.from("districts").select("id", { count: "exact", head: true });
  if (currentLocalityId != null) {
    membersCountQuery.or(`locality_id.eq.${currentLocalityId},locality_id.is.null`);
    districtsCountQuery.eq("locality_id", currentLocalityId);
  }

  const districtsQuery = supabase.from("districts").select("id, name, locality_id").order("name");
  if (currentLocalityId != null) {
    districtsQuery.eq("locality_id", currentLocalityId);
  }

  const [membersCountRes, districtsCountRes, districtsRes] = await Promise.all([
    membersCountQuery,
    districtsCountQuery,
    districtsQuery,
  ]);

  const districtsList = (districtsRes.data ?? []) as { id: string; name: string; locality_id?: string }[];
  const districtIds = districtsList.map((d) => d.id);
  let groupsCountRes: { count: number | null };
  let meetingsRes: { data: { id: string; event_date: string; meeting_type: string; district_id: string | null; name: string }[] | null };
  let membersRes: { data: { id: string; name: string; is_local: boolean; district_id: string | null; group_id: string | null; is_baptized: boolean }[] | null };
  if (currentLocalityId != null && districtIds.length > 0) {
    [groupsCountRes, meetingsRes, membersRes] = await Promise.all([
      supabase.from("groups").select("id", { count: "exact", head: true }).in("district_id", districtIds),
      supabase
        .from("lordsday_meeting_records")
        .select("id, event_date, meeting_type, district_id, name")
        .gte("event_date", yearStartIso)
        .or(`district_id.in.(${districtIds.join(",")}),locality_id.eq.${currentLocalityId}`),
      supabase
        .from("members")
        .select("id, name, is_local, district_id, group_id, is_baptized")
        .or(`locality_id.eq.${currentLocalityId},locality_id.is.null`),
    ]);
  } else if (currentLocalityId != null) {
    groupsCountRes = { count: 0 };
    meetingsRes = { data: [] };
    membersRes = { data: [] };
  } else {
    [groupsCountRes, meetingsRes, membersRes] = await Promise.all([
      supabase.from("groups").select("id", { count: "exact", head: true }),
      supabase
        .from("lordsday_meeting_records")
        .select("id, event_date, meeting_type, district_id, name")
        .gte("event_date", yearStartIso),
      supabase.from("members").select("id, name, is_local, district_id, group_id, is_baptized"),
    ]);
  }

  const meetings = meetingsRes.data ?? [];
  const meetingIds = meetings.map((m) => m.id);
  const attendance =
    meetingIds.length === 0
      ? []
      : (
          await supabase
            .from("lordsday_meeting_attendance")
            .select("id, meeting_id, member_id, recorded_category, recorded_is_baptized, district_id, attended")
            .in("meeting_id", meetingIds)
        ).data ?? [];

  const membersCount = membersCountRes.count ?? 0;
  const districtsCount = districtsCountRes.count ?? 0;
  const groupsCount = groupsCountRes.count ?? 0;

  let dispatchData: Awaited<ReturnType<typeof getDispatchMonitorData>>;
  try {
    dispatchData = await getDispatchMonitorData(currentLocalityId);
  } catch {
    dispatchData = { weekLabel: "—", mainAbsent: [], groupAbsent: [] };
  }

  let attendanceMatrixData: Awaited<ReturnType<typeof getAttendanceMatrixData>>;
  try {
    attendanceMatrixData = await getAttendanceMatrixData(new Date().getFullYear(), currentLocalityId);
  } catch {
    attendanceMatrixData = { weeks: [], members: [], districts: [] };
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-white rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] leading-tight text-slate-400">地方</p>
          <p className="text-sm font-semibold text-slate-800 truncate" title={currentLocalityName ?? undefined}>
            {currentLocalityName && currentLocalityName !== "" ? currentLocalityName : "—"}
          </p>
        </div>
        <div className="bg-white rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] leading-tight text-slate-400">地区</p>
          <p className="text-sm font-semibold text-slate-800 tabular-nums">{districtsCount}</p>
        </div>
        <div className="bg-white rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] leading-tight text-slate-400">小組</p>
          <p className="text-sm font-semibold text-slate-800 tabular-nums">{groupsCount}</p>
        </div>
        <div className="bg-white rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] leading-tight text-slate-400">メンバー</p>
          <p className="text-sm font-semibold text-slate-800 tabular-nums">{membersCount}</p>
        </div>
      </div>

      <DispatchMonitor {...dispatchData} />

      <StatisticsChartsDynamic
        attendance={attendance}
        meetings={meetings}
        members={membersRes.data ?? []}
        districts={districtsList}
        localityName={currentLocalityName}
      />

      <AttendanceMatrix
        key={currentLocalityId ?? "all"}
        {...attendanceMatrixData}
        initialYear={new Date().getFullYear()}
        localityId={currentLocalityId}
      />
    </div>
  );
}
