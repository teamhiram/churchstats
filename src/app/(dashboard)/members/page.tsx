import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";
import { MembersPageClient } from "./MembersPageClient";
import type { MembersApiResponse, MembersApiRow } from "@/app/api/members/route";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const { data: members } = await supabase
    .from("members")
    .select("id, name, furigana, gender, is_local, district_id, group_id, locality_id, age_group, is_baptized, baptism_year, baptism_month, baptism_day, baptism_date_precision, language_main, language_sub, follower_id, updated_at, local_member_join_date, local_member_leave_date")
    .order("name");
  const { data: districts } = await supabase.from("districts").select("id, name, locality_id").order("name");
  const { data: groups } = await supabase.from("groups").select("id, name, district_id").order("name");
  const { data: periods } = await supabase
    .from("member_local_enrollment_periods")
    .select("member_id, period_no, join_date, leave_date, is_uncertain, memo")
    .order("period_no");

  const periodsByMember = new Map<string, { period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean; memo: string | null }[]>();
  for (const p of periods ?? []) {
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

  let localityId: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("main_district_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.main_district_id) {
      const { data: district } = await supabase
        .from("districts")
        .select("locality_id")
        .eq("id", profile.main_district_id)
        .maybeSingle();
      localityId = (district as { locality_id?: string } | null)?.locality_id ?? null;
    }
  }

  const membersList: MembersApiRow[] = (members ?? []).map((m) => {
    const row = m as Record<string, unknown>;
    const enrollmentPeriods = periodsByMember.get(m.id);
    const apiRow: MembersApiRow = {
      id: m.id,
      name: m.name,
      furigana: m.furigana ?? null,
      gender: m.gender,
      is_local: m.is_local,
      district_id: m.district_id,
      group_id: m.group_id,
      locality_id: (row.locality_id as string) ?? null,
      age_group: m.age_group as Category | null,
      is_baptized: m.is_baptized,
      baptism_year: (row.baptism_year as number) ?? null,
      baptism_month: (row.baptism_month as number) ?? null,
      baptism_day: (row.baptism_day as number) ?? null,
      baptism_date_precision: (row.baptism_date_precision as string) ?? null,
      language_main: (row.language_main as string) ?? null,
      language_sub: (row.language_sub as string) ?? null,
      follower_id: (row.follower_id as string) ?? null,
      updated_at: row.updated_at as string | undefined,
      local_member_join_date: (row.local_member_join_date as string) ?? null,
      local_member_leave_date: (row.local_member_leave_date as string) ?? null,
    };
    if (enrollmentPeriods?.length) {
      apiRow.enrollment_periods = enrollmentPeriods;
    }
    return apiRow;
  });

  const initialData: MembersApiResponse = {
    members: membersList,
    districts: (districts ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      locality_id: (d as { locality_id?: string }).locality_id ?? null,
    })),
    groups: groups ?? [],
    localityId,
  };

  return (
    <MembersPageClient
      initialData={initialData}
      searchParams={{ filter: params.filter, type: params.type }}
    />
  );
}
