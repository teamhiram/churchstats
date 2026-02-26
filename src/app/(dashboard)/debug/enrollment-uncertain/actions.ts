"use server";

import { createClient } from "@/lib/supabase/server";

/** 在籍期間不確定リストの該当メンバー数（グループA∪Bのユニーク人数）。サイドバーバッジ用。 */
export async function getEnrollmentUncertainCount(): Promise<number> {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("member_local_enrollment_periods")
    .select("member_id, period_no, join_date, is_uncertain")
    .order("member_id")
    .order("period_no");

  const byMember = new Map<
    string,
    { period_no: number; join_date: string | null; is_uncertain: boolean }[]
  >();
  for (const p of periods ?? []) {
    const row = p as {
      member_id: string;
      period_no: number;
      join_date: string | null;
      is_uncertain: boolean;
    };
    const list = byMember.get(row.member_id) ?? [];
    list.push({
      period_no: row.period_no,
      join_date: row.join_date ?? null,
      is_uncertain: row.is_uncertain,
    });
    byMember.set(row.member_id, list);
  }

  const memberIds = new Set<string>();
  for (const [memberId, memberPeriods] of byMember) {
    const sorted = [...memberPeriods].sort((a, b) => a.period_no - b.period_no);
    const period1 = sorted.find((p) => p.period_no === 1);
    const hasUncertain = memberPeriods.some((p) => p.is_uncertain);
    if (period1?.join_date === null) memberIds.add(memberId);
    if (hasUncertain) memberIds.add(memberId);
  }
  return memberIds.size;
}
