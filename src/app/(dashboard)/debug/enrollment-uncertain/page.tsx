import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DebugEnrollmentUncertainPage() {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("member_local_enrollment_periods")
    .select("member_id, period_no, join_date, leave_date, is_uncertain")
    .order("member_id")
    .order("period_no");
  const memberIds = [...new Set((periods ?? []).map((p) => (p as { member_id: string }).member_id))];
  const { data: members } = await supabase
    .from("members")
    .select("id, name, furigana, district_id")
    .in("id", memberIds.length > 0 ? memberIds : ["__none__"]);
  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  const byMember = new Map<string, { period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean }[]>();
  for (const p of periods ?? []) {
    const row = p as { member_id: string; period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean };
    const list = byMember.get(row.member_id) ?? [];
    list.push({
      period_no: row.period_no,
      join_date: row.join_date ?? null,
      leave_date: row.leave_date ?? null,
      is_uncertain: row.is_uncertain,
    });
    byMember.set(row.member_id, list);
  }

  const groupA: { memberId: string; member: { id: string; name: string; furigana: string | null; district_id: string | null }; periods: { period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean }[] }[] = [];
  const groupB: typeof groupA = [];
  for (const [memberId, memberPeriods] of byMember) {
    const member = memberMap.get(memberId) as { id: string; name: string; furigana: string | null; district_id: string | null } | undefined;
    if (!member) continue;
    const sorted = [...memberPeriods].sort((a, b) => a.period_no - b.period_no);
    const period1 = sorted.find((p) => p.period_no === 1);
    const hasUncertain = memberPeriods.some((p) => p.is_uncertain);
    if (period1?.join_date === null) {
      groupA.push({ memberId, member, periods: sorted });
    }
    if (hasUncertain) {
      groupB.push({ memberId, member, periods: sorted });
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        期間1の転入がNULL、または期間不確定フラグONのメンバーを表示します。編集リンクから期間を編集できます。
      </p>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">グループ A: 期間1の転入日が NULL</h2>
        {groupA.length === 0 ? (
          <p className="text-sm text-slate-500">該当なし</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {groupA.map(({ memberId, member, periods }) => (
              <li key={memberId} className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-slate-800">
                  {member.name}
                  {member.furigana && <span className="text-slate-500 ml-1">({member.furigana})</span>}
                </span>
                <Link
                  href={`/members/${memberId}/edit`}
                  className="text-sm text-primary-600 hover:underline touch-target"
                >
                  編集
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">グループ B: 期間不確定フラグ ON</h2>
        {groupB.length === 0 ? (
          <p className="text-sm text-slate-500">該当なし</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {groupB.map(({ memberId, member, periods }) => (
              <li key={memberId} className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-slate-800">
                  {member.name}
                  {member.furigana && <span className="text-slate-500 ml-1">({member.furigana})</span>}
                  {periods.some((p) => p.is_uncertain) && (
                    <span className="text-amber-600 text-xs ml-2">不確定</span>
                  )}
                </span>
                <Link
                  href={`/members/${memberId}/edit`}
                  className="text-sm text-primary-600 hover:underline touch-target"
                >
                  編集
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500">
        <Link href="/debug/tables" className="text-primary-600 hover:underline">
          ← デバッグ: 全テーブル表示
        </Link>
      </p>
    </div>
  );
}
