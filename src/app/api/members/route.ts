import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import type { Category } from "@/types/database";

export type EnrollmentPeriodApi = {
  period_no: number;
  join_date: string | null;
  leave_date: string | null;
  is_uncertain: boolean;
  memo: string | null;
};

export type MembersApiRow = {
  id: string;
  name: string;
  furigana: string | null;
  gender: string;
  is_local: boolean;
  district_id: string | null;
  group_id: string | null;
  locality_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
  baptism_year: number | null;
  baptism_month: number | null;
  baptism_day: number | null;
  baptism_date_precision: string | null;
  language_main: string | null;
  language_sub: string | null;
  follower_id: string | null;
  updated_at?: string;
  local_member_join_date?: string | null;
  local_member_leave_date?: string | null;
  enrollment_periods?: EnrollmentPeriodApi[];
};

export type MembersApiResponse = {
  members: MembersApiRow[];
  districts: { id: string; name: string; locality_id: string | null }[];
  groups: { id: string; name: string; district_id: string }[];
  localityId: string | null;
};

/** メンバー一覧＋組織（名簿ページ用）。?since=ISO_DATE のときは updated_at > since のメンバーのみ返す（差分取得）。 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const localityParam = searchParams.get("locality");

  const localityId =
    localityParam != null && localityParam !== ""
      ? localityParam
      : await getEffectiveCurrentLocalityId();

  const membersQuery = supabase
    .from("members")
    .select("id, name, furigana, gender, is_local, district_id, group_id, locality_id, age_group, is_baptized, baptism_year, baptism_month, baptism_day, baptism_date_precision, language_main, language_sub, follower_id, updated_at, local_member_join_date, local_member_leave_date")
    .order("name");
  if (localityId != null) {
    membersQuery.or(`locality_id.eq.${localityId},locality_id.is.null`);
  }
  if (since) {
    membersQuery.gt("updated_at", since);
  }

  const districtsQuery = supabase.from("districts").select("id, name, locality_id").order("name");
  if (localityId != null) {
    districtsQuery.eq("locality_id", localityId);
  }

  const districtsRes = await districtsQuery;
  const districts = (districtsRes.data ?? []) as { id: string; name: string; locality_id: string | null }[];
  const districtIds = districts.map((d) => d.id);

  const groupsQuery = supabase.from("groups").select("id, name, district_id").order("name");
  if (districtIds.length > 0) {
    groupsQuery.in("district_id", districtIds);
  } else if (localityId != null) {
    groupsQuery.eq("district_id", "__none__");
  }

  const [membersRes, groupsRes, periodsRes] = await Promise.all([
    membersQuery,
    groupsQuery,
    supabase.from("member_local_enrollment_periods").select("member_id, period_no, join_date, leave_date, is_uncertain, memo").order("period_no"),
  ]);

  const members = (membersRes.data ?? []) as MembersApiRow[];
  const periodsByMember = new Map<string, { period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean; memo: string | null }[]>();
  for (const p of periodsRes.data ?? []) {
    const row = p as { member_id: string; period_no: number; join_date: string | null; leave_date: string | null; is_uncertain?: boolean; memo?: string | null };
    const list = periodsByMember.get(row.member_id) ?? [];
    list.push({
      period_no: row.period_no,
      join_date: row.join_date ?? null,
      leave_date: row.leave_date ?? null,
      is_uncertain: Boolean(row.is_uncertain),
      memo: row.memo ?? null,
    });
    periodsByMember.set(row.member_id, list);
  }
  for (const m of members) {
    const periods = periodsByMember.get(m.id);
    if (periods && periods.length > 0) {
      (m as MembersApiRow).enrollment_periods = periods;
    } else if (m.is_local) {
      (m as MembersApiRow).local_member_join_date = (m as { local_member_join_date?: string | null }).local_member_join_date ?? null;
      (m as MembersApiRow).local_member_leave_date = (m as { local_member_leave_date?: string | null }).local_member_leave_date ?? null;
    }
  }
  const groups = (groupsRes.data ?? []) as { id: string; name: string; district_id: string }[];

  return NextResponse.json({
    members,
    districts,
    groups,
    localityId,
  } satisfies MembersApiResponse);
}
