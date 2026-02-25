import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type ListNames = { regularNames: string[]; nonRegularNames: string[]; poolNames: string[] };

export type OrganizationListsResponse = {
  districts: Record<string, ListNames>;
  groups: Record<string, ListNames>;
};

/** 枠組設定用。所属地方の全地区・小組の「レギュラー/非レギュラー名一覧」を1リクエストで返す。 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, main_district_id")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role ?? "viewer";
  const canSeeAll = role === "admin" || role === "co_admin";

  let userLocalityIds: string[] = [];
  if (!canSeeAll) {
    const { data: reporterRows } = await supabase
      .from("reporter_districts")
      .select("district_id")
      .eq("user_id", user.id);
    const mainId = (profile as { main_district_id?: string } | null)?.main_district_id;
    const userDistrictIds = [
      ...(mainId ? [mainId] : []),
      ...((reporterRows ?? []) as { district_id: string }[]).map((r) => r.district_id),
    ].filter((id, i, arr) => arr.indexOf(id) === i);
    if (userDistrictIds.length > 0) {
      const { data: distRows } = await supabase
        .from("districts")
        .select("locality_id")
        .in("id", userDistrictIds);
      userLocalityIds = [...new Set(((distRows ?? []) as { locality_id: string }[]).map((d) => d.locality_id))];
    }
  }

  const [{ data: districtsData }, { data: groupsData }] = await Promise.all([
    canSeeAll
      ? supabase.from("districts").select("id, locality_id").order("name")
      : userLocalityIds.length > 0
        ? supabase.from("districts").select("id, locality_id").in("locality_id", userLocalityIds).order("name")
        : Promise.resolve({ data: [] }),
    canSeeAll
      ? supabase.from("groups").select("id, district_id").order("name")
      : (async () => {
          if (userLocalityIds.length === 0) return { data: [] };
          const { data: dists } = await supabase.from("districts").select("id").in("locality_id", userLocalityIds);
          const ids = (dists ?? []).map((d) => (d as { id: string }).id);
          return ids.length > 0
            ? supabase.from("groups").select("id, district_id").in("district_id", ids).order("name")
            : { data: [] };
        })(),
  ]);

  const districts = (districtsData ?? []) as { id: string; locality_id: string }[];
  const groups = (groupsData ?? []) as { id: string; district_id: string }[];
  const districtIdsSet = new Set(districts.map((d) => d.id));
  const groupIdsSet = new Set(groups.map((g) => g.id));

  if (districtIdsSet.size === 0 && groupIdsSet.size === 0) {
    return NextResponse.json({ districts: {}, groups: {} } satisfies OrganizationListsResponse);
  }

  const [districtListRows, groupListRows, districtSemiRows, groupSemiRows, districtPoolRows, groupPoolRows, membersByDistrict, membersByGroup] = await Promise.all([
    districtIdsSet.size > 0
      ? supabase
          .from("district_regular_list")
          .select("district_id, member_id, sort_order")
          .in("district_id", [...districtIdsSet])
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    groupIdsSet.size > 0
      ? supabase
          .from("group_regular_list")
          .select("group_id, member_id, sort_order")
          .in("group_id", [...groupIdsSet])
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    districtIdsSet.size > 0
      ? supabase
          .from("district_semi_regular_list")
          .select("district_id, member_id, sort_order")
          .in("district_id", [...districtIdsSet])
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    groupIdsSet.size > 0
      ? supabase
          .from("group_semi_regular_list")
          .select("group_id, member_id, sort_order")
          .in("group_id", [...groupIdsSet])
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    districtIdsSet.size > 0
      ? supabase
          .from("district_pool_list")
          .select("district_id, member_id, sort_order")
          .in("district_id", [...districtIdsSet])
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    groupIdsSet.size > 0
      ? supabase
          .from("group_pool_list")
          .select("group_id, member_id, sort_order")
          .in("group_id", [...groupIdsSet])
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    districtIdsSet.size > 0
      ? supabase.from("members").select("id, name, district_id").in("district_id", [...districtIdsSet])
      : Promise.resolve({ data: [] }),
    groupIdsSet.size > 0
      ? supabase.from("members").select("id, name, group_id").in("group_id", [...groupIdsSet])
      : Promise.resolve({ data: [] }),
  ]);

  const dList = (districtListRows.data ?? []) as { district_id: string; member_id: string; sort_order: number }[];
  const gList = (groupListRows.data ?? []) as { group_id: string; member_id: string; sort_order: number }[];
  const dSemiList = (districtSemiRows.data ?? []) as { district_id: string; member_id: string; sort_order: number }[];
  const gSemiList = (groupSemiRows.data ?? []) as { group_id: string; member_id: string; sort_order: number }[];
  const dPoolList = (districtPoolRows.data ?? []) as { district_id: string; member_id: string; sort_order: number }[];
  const gPoolList = (groupPoolRows.data ?? []) as { group_id: string; member_id: string; sort_order: number }[];
  const membersD = (membersByDistrict.data ?? []) as { id: string; name: string; district_id: string }[];
  const membersG = (membersByGroup.data ?? []) as { id: string; name: string; group_id: string }[];

  const districtRegularByDistrict = new Map<string, Set<string>>();
  const districtSemiByDistrict = new Map<string, Set<string>>();
  const districtPoolByDistrict = new Map<string, Set<string>>();
  const groupRegularByGroup = new Map<string, Set<string>>();
  const groupSemiByGroup = new Map<string, Set<string>>();
  const groupPoolByGroup = new Map<string, Set<string>>();
  dList.forEach((r) => {
    if (!districtRegularByDistrict.has(r.district_id)) districtRegularByDistrict.set(r.district_id, new Set());
    districtRegularByDistrict.get(r.district_id)!.add(r.member_id);
  });
  dSemiList.forEach((r) => {
    if (!districtSemiByDistrict.has(r.district_id)) districtSemiByDistrict.set(r.district_id, new Set());
    districtSemiByDistrict.get(r.district_id)!.add(r.member_id);
  });
  dPoolList.forEach((r) => {
    if (!districtPoolByDistrict.has(r.district_id)) districtPoolByDistrict.set(r.district_id, new Set());
    districtPoolByDistrict.get(r.district_id)!.add(r.member_id);
  });
  gList.forEach((r) => {
    if (!groupRegularByGroup.has(r.group_id)) groupRegularByGroup.set(r.group_id, new Set());
    groupRegularByGroup.get(r.group_id)!.add(r.member_id);
  });
  gSemiList.forEach((r) => {
    if (!groupSemiByGroup.has(r.group_id)) groupSemiByGroup.set(r.group_id, new Set());
    groupSemiByGroup.get(r.group_id)!.add(r.member_id);
  });
  gPoolList.forEach((r) => {
    if (!groupPoolByGroup.has(r.group_id)) groupPoolByGroup.set(r.group_id, new Set());
    groupPoolByGroup.get(r.group_id)!.add(r.member_id);
  });

  const membersByName = new Map<string, string>();
  [...membersD, ...membersG].forEach((m) => membersByName.set(m.id, m.name ?? ""));

  const districtsResult: Record<string, ListNames> = {};
  districts.forEach((d) => {
    const regularIds = districtRegularByDistrict.get(d.id) ?? new Set();
    const semiIds = districtSemiByDistrict.get(d.id) ?? new Set();
    const poolIds = districtPoolByDistrict.get(d.id) ?? new Set();
    const regularNames: string[] = [];
    const nonRegularNames: string[] = [];
    const poolNames: string[] = [];
    membersD.filter((m) => m.district_id === d.id).forEach((m) => {
      const name = membersByName.get(m.id) ?? m.name ?? "";
      if (regularIds.has(m.id)) regularNames.push(name);
      else if (semiIds.has(m.id)) nonRegularNames.push(name);
      else if (poolIds.has(m.id)) poolNames.push(name);
      else nonRegularNames.push(name);
    });
    districtsResult[d.id] = { regularNames, nonRegularNames, poolNames };
  });

  const groupsResult: Record<string, ListNames> = {};
  groups.forEach((g) => {
    const regularIds = groupRegularByGroup.get(g.id) ?? new Set();
    const semiIds = groupSemiByGroup.get(g.id) ?? new Set();
    const poolIds = groupPoolByGroup.get(g.id) ?? new Set();
    const regularNames: string[] = [];
    const nonRegularNames: string[] = [];
    const poolNames: string[] = [];
    membersG.filter((m) => m.group_id === g.id).forEach((m) => {
      const name = membersByName.get(m.id) ?? m.name ?? "";
      if (regularIds.has(m.id)) regularNames.push(name);
      else if (semiIds.has(m.id)) nonRegularNames.push(name);
      else if (poolIds.has(m.id)) poolNames.push(name);
      else nonRegularNames.push(name);
    });
    groupsResult[g.id] = { regularNames, nonRegularNames, poolNames };
  });

  return NextResponse.json({
    districts: districtsResult,
    groups: groupsResult,
  } satisfies OrganizationListsResponse);
}
