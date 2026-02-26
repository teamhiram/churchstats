import { createClient } from "@/lib/supabase/server";

export default async function DebugNumbersPage() {
  const supabase = await createClient();

  const [
    meetingsCountRes,
    membersCountRes,
    districtsCountRes,
    groupsCountRes,
    attendanceCountRes,
    lordsdayMainCountRes,
    groupMeetingCountRes,
    dispatchCountRes,
  ] = await Promise.all([
    supabase.from("lordsday_meeting_records").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("districts").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("lordsday_meeting_attendance").select("id", { count: "exact", head: true }),
    supabase.from("lordsday_meeting_records").select("id", { count: "exact", head: true }).eq("meeting_type", "main"),
    supabase.from("group_meeting_records").select("id", { count: "exact", head: true }),
    supabase.from("organic_dispatch_records").select("id", { count: "exact", head: true }),
  ]);

  const items = [
    { label: "集会登録数", value: meetingsCountRes.count ?? 0 },
    { label: "メンバー登録数", value: membersCountRes.count ?? 0 },
    { label: "地区数", value: districtsCountRes.count ?? 0 },
    { label: "小組数", value: groupsCountRes.count ?? 0 },
    { label: "主日集会延べ人数", value: attendanceCountRes.count ?? 0 },
  ];

  const meetingSectionItems = [
    { label: "主日集会", value: lordsdayMainCountRes.count ?? 0 },
    { label: "小組集会", value: groupMeetingCountRes.count ?? 0 },
    { label: "派遣件数", value: dispatchCountRes.count ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {items.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">登録集会数</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {meetingSectionItems.map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-semibold text-slate-800 tabular-nums">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
