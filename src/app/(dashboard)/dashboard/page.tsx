import { createClient } from "@/lib/supabase/server";
import { StatisticsChartsDynamic } from "../statistics/StatisticsChartsDynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: localities } = await supabase.from("localities").select("id, name").limit(10);
  const { count: membersCount } = await supabase.from("members").select("id", { count: "exact", head: true });
  const { count: meetingsCount } = await supabase.from("meetings").select("id", { count: "exact", head: true });
  const { count: districtsCount } = await supabase.from("districts").select("id", { count: "exact", head: true });
  const { count: groupsCount } = await supabase.from("groups").select("id", { count: "exact", head: true });

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .eq("key", "absence_alert_weeks")
    .single();
  const absenceWeeks = settings?.value != null ? Number(settings.value) : 4;

  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("id, meeting_id, member_id, recorded_category, recorded_is_baptized, district_id");
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, event_date, meeting_type, district_id, name");
  const { data: members } = await supabase
    .from("members")
    .select("id, name, is_local, district_id, group_id, is_baptized");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">ダッシュボード</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">地方</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{localities?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">地区</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{districtsCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">小組</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{groupsCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">メンバー登録数</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{membersCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-xs text-slate-500">集会登録数</p>
          <p className="text-lg font-semibold text-slate-800 tabular-nums">{meetingsCount ?? 0}</p>
        </div>
      </div>

      <StatisticsChartsDynamic
        attendance={attendance ?? []}
        meetings={meetings ?? []}
        members={members ?? []}
        absenceAlertWeeks={absenceWeeks}
      />
    </div>
  );
}
