"use server";

import { createClient } from "@/lib/supabase/server";
import { getWeekStartForDate } from "@/lib/weekUtils";
import type { DispatchType } from "@/types/database";

export type UpdateDispatchRecordResult = {
  ok: boolean;
  error?: string;
};

export async function updateDispatchRecordAction(
  recordId: string,
  payload: {
    dispatch_date: string;
    dispatch_type: DispatchType;
    dispatch_memo: string;
    visitor_ids: string[];
  }
): Promise<UpdateDispatchRecordResult> {
  const { dispatch_date, dispatch_type, dispatch_memo, visitor_ids } = payload;
  const dateStr = dispatch_date.trim().slice(0, 10);
  if (!dateStr || !dispatch_memo.trim()) {
    return { ok: false, error: "派遣日・メモを入力してください。" };
  }
  const week_start = getWeekStartForDate(dateStr);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organic_dispatch_records")
    .update({
      week_start,
      dispatch_type,
      dispatch_date: dateStr,
      dispatch_memo: dispatch_memo.trim(),
      visitor_ids,
    })
    .eq("id", recordId);

  if (error) {
    const msg = error.message ?? "";
    const isRls = /row-level security|RLS/i.test(msg);
    const isUnique = /unique|duplicate key/i.test(msg);
    if (isUnique) {
      return { ok: false, error: "その週には既に別の派遣記録があります。別の日付を選ぶか、既存の記録を編集してください。" };
    }
    if (isRls) {
      return { ok: false, error: "更新する権限がありません。報告者以上のロールが必要です。" };
    }
    return { ok: false, error: `更新に失敗しました: ${msg}` };
  }
  return { ok: true };
}
