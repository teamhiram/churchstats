import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/types/database";
import type { Role } from "@/types/database";

/** キャッシュ無効化で使うタグ。システム設定の「キャッシュをリフレッシュ」で revalidateTag(CACHE_TAG) する */
export const CACHE_TAG = "churchstats";

export type CurrentUserWithProfile = {
  user: { id: string } | null;
  profile: { role: Role; main_district_id: string | null } | null;
  displayName: string | null;
  roleLabel: string;
  localityName: string | null;
};

type ProfileWithDistrictLocality = {
  full_name: string | null;
  role: string;
  main_district_id: string | null;
  districts: {
    locality_id: string | null;
    localities: { name: string } | null;
  } | null;
} | null;

/** 同一リクエスト内で 1 回だけ取得。レイアウト・ページ間で共有。profile + district + locality を 1 クエリで取得。 */
export const getCurrentUserWithProfile = cache(async (): Promise<CurrentUserWithProfile> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, profile: null, displayName: null, roleLabel: "閲覧者", localityName: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, main_district_id, districts!main_district_id(locality_id, localities(name))")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as ProfileWithDistrictLocality;
  const displayName = row?.full_name ?? null;
  const roleLabel = ROLE_LABELS[(row?.role as Role) ?? "viewer"];
  const localityName = row?.districts?.localities?.name ?? null;

  return {
    user: { id: user.id },
    profile: row ? { role: (row.role as Role) ?? "viewer", main_district_id: row.main_district_id } : null,
    displayName,
    roleLabel,
    localityName,
  };
});

/** localities 一覧（unstable_cache は createClient/cookies と併用不可のためキャッシュなし） */
export async function getCachedLocalities(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("localities").select("id, name").order("name").limit(500);
  return data ?? [];
}

/** absence_alert_weeks（unstable_cache は createClient/cookies と併用不可のためキャッシュなし） */
export async function getCachedAbsenceAlertWeeks(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("system_settings")
    .select("key, value")
    .eq("key", "absence_alert_weeks")
    .maybeSingle();
  return data?.value != null ? Number(data.value) : 4;
}

export type MeetingsLayoutData = {
  user: { id: string } | null;
  profile: { role: Role; main_district_id: string | null } | null;
  districts: { id: string; name: string }[];
};

/** 集会レイアウト・集会ページ用。同一リクエストで 1 回だけ取得 */
export const getMeetingsLayoutData = cache(async (): Promise<MeetingsLayoutData> => {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) {
    return { user: null, profile: null, districts: [] };
  }

  const role = profile?.role ?? "viewer";
  const canSeeAllDistricts = role === "admin" || role === "co_admin" || role === "reporter";

  const supabase = await createClient();
  let districtIds: string[] = [];
  if (!canSeeAllDistricts) {
    const { data: reporterDistricts } = await supabase
      .from("reporter_districts")
      .select("district_id")
      .eq("user_id", user.id);
    districtIds = [
      ...(profile?.main_district_id ? [profile.main_district_id] : []),
      ...(reporterDistricts ?? []).map((r: { district_id: string }) => r.district_id),
    ].filter((id, i, arr) => arr.indexOf(id) === i);
  }

  const { data: districts } = canSeeAllDistricts
    ? await supabase.from("districts").select("id, name").order("name")
    : await supabase
        .from("districts")
        .select("id, name")
        .in("id", districtIds.length > 0 ? districtIds : ["__none__"])
        .order("name");

  return {
    user: { id: user.id },
    profile: profile ? { role: profile.role, main_district_id: profile.main_district_id } : null,
    districts: districts ?? [],
  };
});
