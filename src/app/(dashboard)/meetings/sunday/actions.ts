"use server";

import { createClient } from "@/lib/supabase/server";

/** 主日の合同集会モードを取得。localityId -> isCombined */
export async function getSundayMeetingModes(
  sundayIso: string,
  localityIds: string[]
): Promise<Record<string, boolean>> {
  if (localityIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("sunday_meeting_modes")
    .select("locality_id, is_combined")
    .eq("event_date", sundayIso)
    .in("locality_id", localityIds);
  const result: Record<string, boolean> = {};
  localityIds.forEach((lid) => { result[lid] = false; });
  (data ?? []).forEach((r: { locality_id: string; is_combined: boolean }) => {
    result[r.locality_id] = r.is_combined;
  });
  return result;
}

/** 主日の合同集会モードを設定 */
export async function setSundayMeetingMode(
  localityId: string,
  sundayIso: string,
  isCombined: boolean
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("sunday_meeting_modes")
    .upsert(
      { event_date: sundayIso, locality_id: localityId, is_combined: isCombined },
      { onConflict: "event_date,locality_id" }
    );
}

type DistrictWithLocality = { id: string; name: string; locality_id?: string };

/**
 * 指定日の主日集会を取得または作成。
 * isCombinedPerLocality が true の地方は1集会、false の地方は地区ごとに1集会。
 * 戻り値: districtId -> meetingId（地区単位で参加する meeting を返す）
 */
export async function ensureSundayMeetingsBatch(
  sundayIso: string,
  districts: DistrictWithLocality[],
  isCombinedPerLocality: Record<string, boolean> = {}
): Promise<Record<string, string>> {
  const districtIds = districts.map((d) => d.id).filter((id) => id !== "__all__");
  if (districtIds.length === 0) return {};

  const supabase = await createClient();
  const districtMap = new Map(districts.map((d) => [d.id, d]));
  const localityIds = [...new Set(districts.map((d) => d.locality_id).filter(Boolean))] as string[];

  const localitiesRes = await supabase.from("localities").select("id, name").in("id", localityIds);
  const localityNameMap = new Map((localitiesRes.data ?? []).map((l: { id: string; name: string }) => [l.id, l.name]));

  const { data: existing } = await supabase
    .from("meetings")
    .select("id, district_id, locality_id")
    .eq("event_date", sundayIso)
    .eq("meeting_type", "main");

  const result: Record<string, string> = {};
  const existingByDistrict = new Map<string, string>();
  const existingByLocality = new Map<string, string>();
  (existing ?? []).forEach((r: { id: string; district_id: string | null; locality_id: string | null }) => {
    if (r.district_id) existingByDistrict.set(r.district_id, r.id);
    if (r.locality_id) existingByLocality.set(r.locality_id, r.id);
  });

  for (const did of districtIds) {
    const district = districtMap.get(did);
    const lid = district?.locality_id;
    const isCombined = lid ? (isCombinedPerLocality[lid] ?? false) : false;

    if (isCombined && lid) {
      const localityId = lid;
      let mid = existingByLocality.get(localityId);
      if (!mid) {
        const locName = localityNameMap.get(localityId) ?? "";
        const { data: ins, error } = await supabase
          .from("meetings")
          .insert({
            event_date: sundayIso,
            meeting_type: "main",
            district_id: null,
            locality_id: localityId,
            name: `${locName}合同集会`,
          })
          .select("id")
          .single();
        if (!error && ins?.id) {
          const newMid = ins.id;
          mid = newMid;
          existingByLocality.set(localityId, newMid);
        }
      }
      if (mid) result[did] = mid;
    } else {
      let mid = existingByDistrict.get(did);
      if (!mid) {
        const { data: ins, error } = await supabase
          .from("meetings")
          .insert({
            event_date: sundayIso,
            meeting_type: "main",
            district_id: did,
            name: district ? `${district.name}地区集会` : "主日集会",
          })
          .select("id")
          .single();
        if (!error && ins?.id) {
          const newMid = ins.id;
          mid = newMid;
          existingByDistrict.set(did, newMid);
        }
      }
      if (mid) result[did] = mid;
    }
  }
  return result;
}

/** 合同モード時、地区集会の出欠を地方集会へ統合する（ plan 26 ） */
export async function mergeDistrictAttendanceToLocality(
  sundayIso: string,
  localityId: string,
  districtIdsInLocality: string[],
  localityMeetingId: string
): Promise<void> {
  if (districtIdsInLocality.length === 0) return;
  const supabase = await createClient();
  const { data: districtMeetings } = await supabase
    .from("meetings")
    .select("id")
    .eq("event_date", sundayIso)
    .eq("meeting_type", "main")
    .in("district_id", districtIdsInLocality);
  const districtMeetingIds = (districtMeetings ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  if (districtMeetingIds.length === 0) return;
  await supabase
    .from("attendance_records")
    .update({ meeting_id: localityMeetingId })
    .in("meeting_id", districtMeetingIds);
}
