"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { revalidatePath } from "next/cache";

export async function deleteMeetingFromDebug(formData: FormData): Promise<void> {
  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return;

  const { user, profile } = await getCurrentUserWithProfile();
  if (!user || profile?.role !== "admin") {
    throw new Error("unauthorized");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/debug/meeting-duplicates");
}

