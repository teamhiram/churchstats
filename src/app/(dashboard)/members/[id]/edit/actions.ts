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
  },
  /** 編集中に取得した updated_at。これと一致する場合のみ更新（楽観ロック）。 */
  expectedUpdatedAt: string | null
): Promise<UpdateMemberResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();

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

  return { ok: true };
}
