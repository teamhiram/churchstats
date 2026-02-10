import { createClient } from "@/lib/supabase/server";
import { StatisticsChartsDynamic } from "../statistics/StatisticsChartsDynamic";
import { DispatchMonitor } from "./DispatchMonitor";
import { getDispatchMonitorData } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const yearStartIso = oneYearAgo.toISOString().slice(0, 10);

  const [
    localitiesRes,
    membersCountRes,
    meetingsCountRes,
    districtsCountRes,
    groupsCountRes,
    meetingsRes,
    membersRes,
  ] = await Promise.all([
    supabase.from("localities").select("id, name").order("name").limit(500),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("meetings").select("id", { count: "exact", head: true }),
    supabase.from("districts").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase
      .from("meetings")
      .select("id, event_date, meeting_type, district_id, name")
      .gte("event_date", yearStartIso),
    supabase
      .from("members")
      .select("id, name, is_local, district_id, group_id, is_baptized"),
  ]);

  const localities = localitiesRes.data ?? [];

  const meetings = meetingsRes.data ?? [];
  const meetingIds = meetings.map((m) => m.id);
  const attendance =
    meetingIds.length === 0
      ? []
      : (
          await supabase
            .from("attendance_records")
            .select("id, meeting_id, member_id, recorded_category, recorded_is_baptized, district_id, attended")
            .in("meeting_id", meetingIds)
        ).data ?? [];

  // #region agent log — 2/1 信仰別不整合調査（attended は DB に存在する場合のみ select に含める）
  const TARGET_ISO = "2026-02-01";
  const targetMeetings = meetings.filter((m) => m.event_date === TARGET_ISO && m.meeting_type === "main");
  const targetMeetingIds = new Set(targetMeetings.map((m) => m.id));
  const targetRecords = attendance.filter((a: { meeting_id: string }) => targetMeetingIds.has(a.meeting_id));
  function isSaint(v: unknown): boolean {
    if (v === true || v === 1) return true;
    if (typeof v === "string" && (v.toLowerCase() === "true" || v === "1")) return true;
    return false;
  }
  const byFaithAll = { saint: 0, friend: 0 };
  targetRecords.forEach((a: { recorded_is_baptized?: unknown }) => {
    const saint = isSaint(a.recorded_is_baptized);
    byFaithAll[saint ? "saint" : "friend"] += 1;
  });
  fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "dashboard/page.tsx",
      message: "2/1 dashboard attendance stats",
      data: {
        targetDate: TARGET_ISO,
        meetingCount: targetMeetings.length,
        meetingIds: targetMeetings.map((m) => m.id),
        recordsTotal: targetRecords.length,
        byFaithAll,
      },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion

  const membersCount = membersCountRes.count ?? 0;
  const meetingsCount = meetingsCountRes.count ?? 0;
  const districtsCount = districtsCountRes.count ?? 0;
  const groupsCount = groupsCountRes.count ?? 0;

  let dispatchData: Awaited<ReturnType<typeof getDispatchMonitorData>>;
  try {
    dispatchData = await getDispatchMonitorData();
  } catch {
    dispatchData = { weekLabel: "—", mainAbsent: [], groupAbsent: [] };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">ダッシュボード</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">地方</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{localities.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">地区</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{districtsCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">小組</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{groupsCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">メンバー登録数</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{membersCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">集会登録数</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{meetingsCount}</p>
        </div>
      </div>

      <DispatchMonitor {...dispatchData} />

      <StatisticsChartsDynamic
        attendance={attendance}
        meetings={meetings}
        members={membersRes.data ?? []}
      />
    </div>
  );
}
