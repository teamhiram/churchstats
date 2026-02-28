import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLocalityId } from "@/lib/locality";
import { ROLE_LABELS, GLOBAL_ROLE_LABELS } from "@/types/database";
import type { GlobalRole, Role } from "@/types/database";

/** キャッシュ無効化で使うタグ。システム設定の「キャッシュをリフレッシュ」で revalidateTag(CACHE_TAG) する */
export const CACHE_TAG = "churchstats";

export type CurrentUserWithProfile = {
  user: { id: string } | null;
  profile: { role: Role; main_district_id: string | null; locality_id: string | null; global_role?: GlobalRole | null } | null;
  displayName: string | null;
  /** ログイン中のメールアドレス（表示用） */
  email: string | null;
  /** ローカル（従来の profiles.role）の表示名 */
  roleLabel: string;
  /** グローバル権限がある場合のみセット */
  globalRoleLabel: string | null;
  localityName: string | null;
};

type ProfileWithDistrictLocality = {
  full_name: string | null;
  role: string;
  main_district_id: string | null;
  locality_id: string | null;
  global_role?: string | null;
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
    return { user: null, profile: null, displayName: null, email: null, roleLabel: "閲覧者", globalRoleLabel: null, localityName: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, main_district_id, global_role, locality_id, districts!main_district_id(locality_id, localities(name))")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as ProfileWithDistrictLocality;
  const displayName = row?.full_name ?? null;
  const roleLabel = ROLE_LABELS[(row?.role as Role) ?? "viewer"];
  const globalRoleLabel =
    row?.global_role != null && row.global_role !== ""
      ? GLOBAL_ROLE_LABELS[row.global_role as GlobalRole] ?? null
      : null;
  const localities = await getCachedLocalities();
  const localityName = row?.locality_id
    ? (localities.find((l) => l.id === row.locality_id)?.name ?? null)
    : (row?.districts?.localities?.name ?? null);

  return {
    user: { id: user.id },
    profile: row
      ? {
          role: (row.role as Role) ?? "viewer",
          main_district_id: row.main_district_id,
          locality_id: row.locality_id ?? null,
          global_role: (row.global_role as GlobalRole | null) ?? null,
        }
      : null,
    displayName,
    email: user.email ?? null,
    roleLabel,
    globalRoleLabel,
    localityName,
  };
});

/** localities 一覧。RLS でアクセス可能な地方のみ。area_id は prefecture 経由で導出。同一リクエスト内で重複呼び出しを抑止。 */
export const getCachedLocalities = cache(async (): Promise<{
  id: string;
  name: string;
  area_id: string | null;
  prefecture_id: string | null;
  prefecture_name: string | null;
}[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("localities")
    .select("id, name, prefecture_id, prefectures(name, area_id)")
    .order("name")
    .limit(500);
  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    prefecture_id: string | null;
    prefectures: { name: string; area_id: string } | { name: string; area_id: string }[] | null;
  }[];
  return rows.map((r) => {
    const pref = Array.isArray(r.prefectures) ? r.prefectures[0] : r.prefectures;
    return {
      id: r.id,
      name: r.name,
      area_id: pref?.area_id ?? null,
      prefecture_id: r.prefecture_id ?? null,
      prefecture_name: pref?.name ?? null,
    };
  });
});

/** 都道府県一覧。地域(area)順・都道府県 sort_order 順。地方ポップアップの都道府県セクションに利用。同一リクエスト内で重複呼び出しを抑止。 */
export const getCachedPrefectures = cache(async (): Promise<{ id: string; name: string; area_id: string; sort_order?: number }[]> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("prefectures").select("id, name, area_id, sort_order").limit(100);
    const list = (data ?? []) as { id: string; name: string; area_id: string; sort_order?: number }[];
    const areas = await getCachedAreas();
    const areaOrder = new Map(areas.map((a, i) => [a.id, i]));
    list.sort((a, b) => {
      const ai = areaOrder.get(a.area_id) ?? 999;
      const bi = areaOrder.get(b.area_id) ?? 999;
      if (ai !== bi) return ai - bi;
      const ao = a.sort_order ?? 999;
      const bo = b.sort_order ?? 999;
    return ao - bo || a.name.localeCompare(b.name);
  });
  return list;
  } catch {
    return [];
  }
});

/** 地域（area）一覧。地方ポップアップのセクション見出しに利用。同一リクエスト内で重複呼び出しを抑止。 */
export const getCachedAreas = cache(async (): Promise<{ id: string; name: string; sort_order?: number }[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("areas").select("id, name, sort_order").order("name").limit(100);
  const list = (data ?? []) as { id: string; name: string; sort_order?: number }[];
  list.sort((a, b) => {
    const ao = a.sort_order;
    const bo = b.sort_order;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;
    if (bo != null) return 1;
    return a.name.localeCompare(b.name);
  });
  return list;
});

/**
 * 表示・クエリに使う「実効的な現在の地方 ID」を返す。
 * Cookie が設定されていてアクセス可能一覧に含まれるならそれを使用。
 * そうでなければ profile.locality_id がアクセス可能ならそれ、それ以外はアクセス可能な地方の先頭を返す。
 */
export async function getEffectiveCurrentLocalityId(): Promise<string | null> {
  const [cookieId, localities, data] = await Promise.all([
    getCurrentLocalityId(),
    getCachedLocalities(),
    getCurrentUserWithProfile(),
  ]);
  if (cookieId && localities.some((l) => l.id === cookieId)) return cookieId;
  const profile = data.profile;
  if (profile?.locality_id && localities.some((l) => l.id === profile.locality_id)) {
    return profile.locality_id;
  }
  return localities.length > 0 ? localities[0].id : null;
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
  districts: { id: string; name: string; locality_id?: string }[];
  defaultDistrictId: string;
  currentLocalityId: string | null;
};

/** 集会レイアウト・集会ページ用。同一リクエストで 1 回だけ取得。現在の地方（Cookie）で districts をスコープする。 */
export const getMeetingsLayoutData = cache(async (): Promise<MeetingsLayoutData> => {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) {
    return { user: null, profile: null, districts: [], defaultDistrictId: "", currentLocalityId: null };
  }

  const currentLocalityId = await getEffectiveCurrentLocalityId();
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
    ? await supabase.from("districts").select("id, name, locality_id").order("name")
    : await supabase
        .from("districts")
        .select("id, name, locality_id")
        .in("id", districtIds.length > 0 ? districtIds : ["__none__"])
        .order("name");

  const districtsList = districts ?? [];
  const filtered =
    currentLocalityId != null
      ? districtsList.filter((d) => (d as { locality_id?: string }).locality_id === currentLocalityId)
      : districtsList;

  const filteredDistrictIds = filtered.map((d) => d.id);
  const mainDistrictInCurrentLocality =
    profile?.main_district_id && filteredDistrictIds.includes(profile.main_district_id)
      ? profile.main_district_id
      : null;
  const defaultDistrictId = mainDistrictInCurrentLocality ?? filtered[0]?.id ?? "";

  return {
    user: { id: user.id },
    profile: profile ? { role: profile.role, main_district_id: profile.main_district_id } : null,
    districts: filtered,
    defaultDistrictId,
    currentLocalityId,
  };
});

/**
 * URL の district_id が現在の地方に属する場合のみ採用し、それ以外は layout の default にフォールバックする。
 * 地方切り替え後に他地方の district_id が URL に残っていても、正しく現在地方の地区で表示するため。
 */
export function effectiveDistrictIdForCurrentLocality(
  paramsDistrictId: string | undefined,
  layoutData: { districts: { id: string }[]; defaultDistrictId: string },
  options?: { allowAllDistricts?: boolean }
): string {
  const ids = new Set(layoutData.districts.map((d) => d.id));
  if (paramsDistrictId != null && paramsDistrictId !== "") {
    if (paramsDistrictId === "__all__" && options?.allowAllDistricts) return "__all__";
    if (ids.has(paramsDistrictId)) return paramsDistrictId;
  }
  return layoutData.defaultDistrictId;
}
