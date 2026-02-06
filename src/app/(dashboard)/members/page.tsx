import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";
import { MembersPageClient } from "./MembersPageClient";
import type { MembersApiResponse } from "@/app/api/members/route";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const { data: members } = await supabase
    .from("members")
    .select("id, name, furigana, gender, is_local, district_id, group_id, age_group, is_baptized, updated_at")
    .order("name");
  const { data: districts } = await supabase.from("districts").select("id, name, locality_id").order("name");
  const { data: groups } = await supabase.from("groups").select("id, name, district_id").order("name");

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

  const initialData: MembersApiResponse = {
    members: (members ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      furigana: m.furigana ?? null,
      gender: m.gender,
      is_local: m.is_local,
      district_id: m.district_id,
      group_id: m.group_id,
      age_group: m.age_group as Category | null,
      is_baptized: m.is_baptized,
      updated_at: (m as { updated_at?: string }).updated_at,
    })),
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
