import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export const dynamic = "force-dynamic";

type MeetingRow = {
  id: string;
  event_date: string;
  meeting_type: string;
  name: string | null;
  district_id: string | null;
  locality_id: string | null;
  group_id: string | null;
};

export default async function DebugMeetingsListPage() {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("lordsday_meeting_records")
    .select("id, event_date, meeting_type, name, district_id, locality_id, group_id")
    .order("event_date", { ascending: false })
    .limit(300);

  const rows = (meetings ?? []) as MeetingRow[];
  const districtIds = [...new Set(rows.map((r) => r.district_id).filter(Boolean))] as string[];
  const localityIds = [...new Set(rows.map((r) => r.locality_id).filter(Boolean))] as string[];
  const groupIds = [...new Set(rows.map((r) => r.group_id).filter(Boolean))] as string[];

  const [districtsRes, localitiesRes, groupsRes] = await Promise.all([
    districtIds.length > 0
      ? supabase.from("districts").select("id, name").in("id", districtIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    localityIds.length > 0
      ? supabase.from("localities").select("id, name").in("id", localityIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    groupIds.length > 0
      ? supabase.from("groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const districtNames = new Map((districtsRes.data ?? []).map((d) => [d.id, d.name]));
  const localityNames = new Map((localitiesRes.data ?? []).map((l) => [l.id, l.name]));
  const groupNames = new Map((groupsRes.data ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">集会一覧（主日）</h1>
      <p className="text-sm text-slate-500">
        直近の主日集会記録（最大300件）。詳細はリンクから。
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-700">日付</th>
              <th className="px-3 py-2 font-medium text-slate-700">種別</th>
              <th className="px-3 py-2 font-medium text-slate-700">名前</th>
              <th className="px-3 py-2 font-medium text-slate-700">地区</th>
              <th className="px-3 py-2 font-medium text-slate-700">地方</th>
              <th className="px-3 py-2 font-medium text-slate-700">小組</th>
              <th className="px-3 py-2 font-medium text-slate-700"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                  {format(new Date(row.event_date), "yyyy-MM-dd(E)", { locale: ja })}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {row.meeting_type === "main" ? "主日" : "小組"}
                </td>
                <td className="px-3 py-2 text-slate-800">{row.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">
                  {row.district_id ? districtNames.get(row.district_id) ?? row.district_id.slice(0, 8) : "—"}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {row.locality_id ? localityNames.get(row.locality_id) ?? row.locality_id.slice(0, 8) : "—"}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {row.group_id ? groupNames.get(row.group_id) ?? row.group_id.slice(0, 8) : "—"}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/attendance/${row.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
