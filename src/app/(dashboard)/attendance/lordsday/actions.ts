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
 * 戻り値: districtId -> meetingId（常に地区集会の meeting を返す）。
 * 合同集会トグルON時は meetings に地方集会レコード（district_id=null, locality_id=X）を作成するが、
 * 出欠記録は地区集会に紐づけるため、戻り値は常に地区集会の meetingId。
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
    .from("lordsday_meeting_records")
    .select("id, district_id, locality_id")
    .eq("event_date", sundayIso)
    .eq("meeting_type", "main");

  // #region agent log
  try {
    const existingList = (existing ?? []) as { id: string; district_id: string | null; locality_id: string | null }[];
    const byDistrict: Record<string, string> = {};
    const byLocality: Record<string, string> = {};
    const allMeetings = existingList.map((r) => ({ id: r.id, district_id: r.district_id, locality_id: r.locality_id }));
    existingList.forEach((r) => {
      if (r.district_id) byDistrict[r.district_id] = r.id;
      if (r.locality_id) byLocality[r.locality_id] = r.id;
    });
    await fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "actions.ts:ensureSundayMeetingsBatch",
        message: "existing meetings for date",
        data: { sundayIso, districtIds, existingCount: existingList.length, byDistrict, byLocality, allMeetings },
        timestamp: Date.now(),
        hypothesisId: "H4",
      }),
    });
  } catch (_) {}
  // #endregion

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
      if (!existingByLocality.get(localityId)) {
        const locName = localityNameMap.get(localityId) ?? "";
        const { data: ins, error } = await supabase
          .from("lordsday_meeting_records")
          .insert({
            event_date: sundayIso,
            meeting_type: "main",
            district_id: null,
            locality_id: localityId,
            name: `${locName}合同集会`,
          })
          .select("id")
          .single();
        if (error?.code === "23505") {
          const { data: existingRow } = await supabase
            .from("lordsday_meeting_records")
            .select("id")
            .eq("event_date", sundayIso)
            .eq("meeting_type", "main")
            .is("district_id", null)
            .eq("locality_id", localityId)
            .maybeSingle();
          if (existingRow?.id) existingByLocality.set(localityId, existingRow.id);
        } else if (!error && ins?.id) {
          existingByLocality.set(localityId, ins.id);
        }
      }
    }

    let mid = existingByDistrict.get(did);
    if (!mid) {
      const { data: ins, error } = await supabase
        .from("lordsday_meeting_records")
        .insert({
          event_date: sundayIso,
          meeting_type: "main",
          district_id: did,
          name: district ? `${district.name}地区集会` : "主日集会",
        })
        .select("id")
        .single();
      if (error?.code === "23505") {
        const { data: existingRow } = await supabase
          .from("lordsday_meeting_records")
          .select("id")
          .eq("event_date", sundayIso)
          .eq("meeting_type", "main")
          .eq("district_id", did)
          .maybeSingle();
        if (existingRow?.id) {
          mid = existingRow.id;
          existingByDistrict.set(did, existingRow.id);
        }
      } else if (!error && ins?.id) {
        mid = ins.id;
        existingByDistrict.set(did, ins.id);
      }
    }
    if (mid) result[did] = mid;
  }
  return result;
}

