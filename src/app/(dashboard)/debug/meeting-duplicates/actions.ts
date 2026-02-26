"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { revalidatePath } from "next/cache";

type MeetingRow = {
  id: string;
  event_date: string;
  meeting_type: "main" | "group";
  district_id: string | null;
  locality_id: string | null;
  group_id: string | null;
};

/** 集会重複検知で表示する重複グループ数（サイドバーバッジ用）。admin 以外は 0 を返す。 */
export async function getMeetingDuplicateGroupCount(): Promise<number> {
  const { profile } = await getCurrentUserWithProfile().catch(() => ({ profile: null }));
  if (profile?.role !== "admin") return 0;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("lordsday_meeting_records")
    .select("id, event_date, meeting_type, district_id, locality_id, group_id");
  const list = (rows ?? []) as MeetingRow[];

  const mainGroups = new Map<string, MeetingRow[]>();
  const groupGroups = new Map<string, MeetingRow[]>();
  for (const row of list) {
    if (row.meeting_type === "main") {
      const districtOrLocality = row.district_id ? `D:${row.district_id}` : `L:${row.locality_id ?? "none"}`;
      const key = `${row.event_date}|${districtOrLocality}`;
      const arr = mainGroups.get(key) ?? [];
      arr.push(row);
      mainGroups.set(key, arr);
    } else if (row.meeting_type === "group") {
      const key = `${row.event_date}|${row.group_id ?? "none"}`;
      const arr = groupGroups.get(key) ?? [];
      arr.push(row);
      groupGroups.set(key, arr);
    }
  }
  const mainDupCount = [...mainGroups.values()].filter((arr) => arr.length > 1).length;
  const groupDupCount = [...groupGroups.values()].filter((arr) => arr.length > 1).length;
  return mainDupCount + groupDupCount;
}

export async function deleteMeetingFromDebug(formData: FormData): Promise<void> {
  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return;

  const { user, profile } = await getCurrentUserWithProfile();
  if (!user || profile?.role !== "admin") {
    throw new Error("unauthorized");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lordsday_meeting_records").delete().eq("id", meetingId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/debug/meeting-duplicates");
}

export async function deleteMeetingsFromDebug(meetingIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const ids = meetingIds.filter((id) => id.length > 0);
  if (ids.length === 0) return { ok: true };

  const { user, profile } = await getCurrentUserWithProfile();
  if (!user || profile?.role !== "admin") {
    return { ok: false, error: "unauthorized" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lordsday_meeting_records").delete().in("id", ids);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/debug/meeting-duplicates");
  return { ok: true };
}

