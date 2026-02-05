"use server";

import { createClient } from "@/lib/supabase/server";

/** 指定日の主日集会を全地区分まとめて取得または作成し、districtId -> meetingId のマップを返す */
export async function ensureSundayMeetingsBatch(
  sundayIso: string,
  districts: { id: string; name: string }[]
): Promise<Record<string, string>> {
  const districtIds = districts.map((d) => d.id).filter((id) => id !== "__all__");
  if (districtIds.length === 0) return {};

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("meetings")
    .select("id, district_id")
    .eq("event_date", sundayIso)
    .eq("meeting_type", "main")
    .in("district_id", districtIds);

  const existingByDistrict = new Map<string, string>();
  (existing ?? []).forEach((r: { id: string; district_id: string | null }) => {
    if (r.district_id) existingByDistrict.set(r.district_id, r.id);
  });

  const missing = districtIds.filter((id) => !existingByDistrict.has(id));
  const result: Record<string, string> = Object.fromEntries(existingByDistrict);

  if (missing.length === 0) return result;

  const districtMap = new Map(districts.map((d) => [d.id, d.name]));
  const toInsert = missing.map((did) => ({
    event_date: sundayIso,
    meeting_type: "main" as const,
    district_id: did,
    name: districtMap.get(did) ? `${districtMap.get(did)}地区集会` : "主日集会",
  }));

  const { data: inserted, error } = await supabase
    .from("meetings")
    .insert(toInsert)
    .select("id, district_id");

  if (error) return result;
  (inserted ?? []).forEach((r: { id: string; district_id: string | null }) => {
    if (r.district_id) result[r.district_id] = r.id;
  });
  return result;
}
