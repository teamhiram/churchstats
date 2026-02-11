"use server";

import { createClient } from "@/lib/supabase/server";
import { hiraganaToKatakana } from "@/lib/furigana";
import type { Category } from "@/types/database";
import {
  addDistrictRegularMember,
  removeDistrictRegularMember,
  addGroupRegularMember,
  removeGroupRegularMember,
} from "@/app/(dashboard)/settings/organization/actions";

export type EnrollmentPeriodInput = {
  period_no: number;
  join_date: string | null;
  leave_date: string | null;
  is_uncertain: boolean;
};

export type UpdateMemberResult = {
  ok: boolean;
  error?: string;
  /** 他ユーザーによる更新で上書きできなかった場合 true。理由は error に記載。 */
  conflict?: boolean;
};

export async function updateMemberAction(
  memberId: string,
  data: {
    name: string;
    furigana: string | null;
    gender: "male" | "female";
    is_local: boolean;
    district_id: string | null;
    group_id: string | null;
    locality_id: string | null;
    age_group: Category | null;
    is_baptized: boolean;
    local_member_join_date: string | null;
    local_member_leave_date: string | null;
    enrollment_periods?: EnrollmentPeriodInput[];
  },
  /** 編集中に取得した updated_at。これと一致する場合のみ更新（楽観ロック）。 */
  expectedUpdatedAt: string | null
): Promise<UpdateMemberResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const period1 = data.enrollment_periods?.find((p) => p.period_no === 1);
  const updatePayload = {
    name: data.name.trim(),
    furigana: data.furigana ? hiraganaToKatakana(data.furigana) : null,
    gender: data.gender,
    is_local: data.is_local,
    district_id: data.is_local ? data.district_id : null,
    group_id: data.is_local ? data.group_id : null,
    locality_id: !data.is_local ? data.locality_id : null,
    age_group: data.age_group,
    is_baptized: data.is_baptized,
    local_member_join_date: (period1?.join_date ?? data.local_member_join_date) || null,
    local_member_leave_date: (period1?.leave_date ?? data.local_member_leave_date) || null,
    updated_at: now,
  };

  let query = supabase
    .from("members")
    .update(updatePayload)
    .eq("id", memberId);

  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data: updated, error } = await query.select("id").maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (expectedUpdatedAt && !updated) {
    return {
      ok: false,
      conflict: true,
      error:
        "他のユーザーが先にこのメンバーを更新したため、保存できません。画面を更新して最新の内容を確認してから、再度保存してください。",
    };
  }

  if (data.is_local && data.enrollment_periods && data.enrollment_periods.length > 0) {
    await supabase.from("member_local_enrollment_periods").delete().eq("member_id", memberId);
    const rows = data.enrollment_periods.map((p) => ({
      member_id: memberId,
      period_no: p.period_no,
      join_date: p.join_date?.trim() || null,
      leave_date: p.leave_date?.trim() || null,
      is_uncertain: p.is_uncertain,
    }));
    if (rows.length > 0) {
      const { error: periodsError } = await supabase.from("member_local_enrollment_periods").insert(rows);
      if (periodsError) {
        return { ok: false, error: periodsError.message };
      }
    }
  }

  return { ok: true };
}
