import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { StatisticsChartsDynamic } from "../statistics/StatisticsChartsDynamic";
import { DispatchMonitor } from "./DispatchMonitor";
import { AttendanceMatrix } from "./AttendanceMatrix";
import { getDispatchMonitorData } from "./actions";
import { getAttendanceMatrixData } from "./attendanceMatrixActions";

export default async function DashboardPage() {
  const { localityName } = await getCurrentUserWithProfile();
  const supabase = await createClient();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const yearStartIso = oneYearAgo.toISOString().slice(0, 10);

  const [
    membersCountRes,
    districtsCountRes,
    groupsCountRes,
    meetingsRes,
    membersRes,
    districtsRes,
  ] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("districts").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase
      .from("lordsday_meeting_records")
      .select("id, event_date, meeting_type, district_id, name")
      .gte("event_date", yearStartIso),
    supabase
      .from("members")
      .select("id, name, is_local, district_id, group_id, is_baptized"),
    supabase.from("districts").select("id, name").order("name"),
  ]);

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
    dispatchData = await getDispatchMonitorData();
  } catch {
    dispatchData = { weekLabel: "—", mainAbsent: [], groupAbsent: [] };
  }

  let attendanceMatrixData: Awaited<ReturnType<typeof getAttendanceMatrixData>>;
  try {
    attendanceMatrixData = await getAttendanceMatrixData(new Date().getFullYear());
  } catch {
    attendanceMatrixData = { weeks: [], members: [], districts: [] };
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-white rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] leading-tight text-slate-400">地方</p>
          <p className="text-sm font-semibold text-slate-800 truncate" title={localityName ?? undefined}>
            {localityName && localityName !== "" ? localityName : "—"}
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
        districts={districtsRes.data ?? []}
        localityName={localityName}
      />

      <AttendanceMatrix {...attendanceMatrixData} />
    </div>
  );
}
