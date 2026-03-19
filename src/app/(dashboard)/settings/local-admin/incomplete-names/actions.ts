"use server";

import { createClient } from "@/lib/supabase/server";
import { hiraganaToKatakana } from "@/lib/furigana";
import { formatMemberName, formatMemberFurigana } from "@/lib/memberName";

export type UpdateMemberNameFieldsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function getIncompleteNamesCount(localityId: string | null): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("locality_id", localityId ?? "__none__")
    .or("last_name.is.null,first_name.is.null,last_furigana.is.null,first_furigana.is.null,last_name.eq.,first_name.eq.,last_furigana.eq.,first_furigana.eq.");
  if (error) return 0;
  return count ?? 0;
}

export async function getMembersCountByStatus(localityId: string | null, status: "inactive" | "tobedeleted"): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("locality_id", localityId ?? "__none__")
    .eq("status", status);
  if (error) return 0;
  return count ?? 0;
}

export async function updateMemberNameFieldsAction(
  memberId: string,
  data: {
    last_name: string | null;
    first_name: string | null;
    last_furigana: string | null;
    first_furigana: string | null;
  }
): Promise<UpdateMemberNameFieldsResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const last = data.last_name?.trim() || null;
  const first = data.first_name?.trim() || null;
  const lFurRaw = data.last_furigana?.trim() || null;
  const fFurRaw = data.first_furigana?.trim() || null;
  const lastFur = lFurRaw ? hiraganaToKatakana(lFurRaw) : null;
  const firstFur = fFurRaw ? hiraganaToKatakana(fFurRaw) : null;

  const name = formatMemberName({ last_name: last, first_name: first });
  const furigana = formatMemberFurigana({ last_furigana: lastFur, first_furigana: firstFur }) || null;

  const { error } = await supabase
    .from("members")
    .update({
      last_name: last,
      first_name: first,
      last_furigana: lastFur,
      first_furigana: firstFur,
      name,
      furigana,
      updated_at: now,
    })
    .eq("id", memberId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

