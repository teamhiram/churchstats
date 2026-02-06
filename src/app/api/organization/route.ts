import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type OrganizationApiResponse = {
  localities: { id: string; name: string }[];
  districts: { id: string; name: string; locality_id: string }[];
  groups: { id: string; name: string; district_id: string }[];
};

/** 組織データ（地方・地区・小組）。設定・メンバー編集などで利用。 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [localitiesRes, districtsRes, groupsRes] = await Promise.all([
    supabase.from("localities").select("id, name").order("name"),
    supabase.from("districts").select("id, name, locality_id").order("name"),
    supabase.from("groups").select("id, name, district_id").order("name"),
  ]);

  const localities = (localitiesRes.data ?? []) as { id: string; name: string }[];
  const districts = (districtsRes.data ?? []) as { id: string; name: string; locality_id: string }[];
  const groups = (groupsRes.data ?? []) as { id: string; name: string; district_id: string }[];

  return NextResponse.json({
    localities,
    districts,
    groups,
  } satisfies OrganizationApiResponse);
}
