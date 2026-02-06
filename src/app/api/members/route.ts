import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { Category } from "@/types/database";

export type MembersApiRow = {
  id: string;
  name: string;
  furigana: string | null;
  gender: string;
  is_local: boolean;
  district_id: string | null;
  group_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
  updated_at?: string;
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

  let localityId: string | null = null;
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

  const membersQuery = supabase
    .from("members")
    .select("id, name, furigana, gender, is_local, district_id, group_id, age_group, is_baptized, updated_at")
    .order("name");
  if (since) {
    membersQuery.gt("updated_at", since);
  }
  const [membersRes, districtsRes, groupsRes] = await Promise.all([
    membersQuery,
    supabase.from("districts").select("id, name, locality_id").order("name"),
    supabase.from("groups").select("id, name, district_id").order("name"),
  ]);

  const members = (membersRes.data ?? []) as MembersApiRow[];
  const districts = (districtsRes.data ?? []) as { id: string; name: string; locality_id: string | null }[];
  const groups = (groupsRes.data ?? []) as { id: string; name: string; district_id: string }[];

  return NextResponse.json({
    members,
    districts,
    groups,
    localityId,
  } satisfies MembersApiResponse);
}
