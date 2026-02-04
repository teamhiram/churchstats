import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";
import { MembersList } from "./MembersList";

function isUnassigned(m: { is_local: boolean; district_id: string | null; group_id: string | null }) {
  return m.is_local && (!m.district_id || !m.group_id);
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const showUnassignedOnly = params.filter === "unassigned";
  const memberType =
    params.type === "guest" ? "guest" : params.type === "all" ? "all" : "local";

  const { data: members } = await supabase
    .from("members")
    .select("id, name, furigana, gender, is_local, district_id, group_id, age_group, is_baptized")
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
      localityId = district?.locality_id ?? null;
    }
  }

  const districtMap = new Map((districts ?? []).map((d) => [d.id, d.name]));
  const groupMap = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const rows = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    furigana: m.furigana ?? null,
    gender: m.gender,
    is_local: m.is_local,
    district_id: m.district_id,
    group_id: m.group_id,
    age_group: m.age_group as Category | null,
    is_baptized: m.is_baptized,
  }));

  const byType =
    memberType === "guest"
      ? rows.filter((m) => !m.is_local)
      : memberType === "all"
        ? rows
        : rows.filter((m) => m.is_local);
  const unassigned = byType.filter(isUnassigned);
  const membersToShow = showUnassignedOnly ? unassigned : byType;

  const districtsWithLocality = (districts ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    locality_id: (d as { locality_id?: string }).locality_id ?? null,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">名簿管理</h1>
      </div>
      {unassigned.length > 0 && !showUnassignedOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <h2 className="font-semibold text-amber-800 mb-2">無所属リスト（{unassigned.length}名）</h2>
          <p className="text-sm text-amber-700 mb-2">小組に割り当ててください。</p>
          <a
            href={
              memberType === "guest"
                ? "/members?filter=unassigned&type=guest"
                : memberType === "all"
                  ? "/members?filter=unassigned&type=all"
                  : "/members?filter=unassigned"
            }
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            無所属のみ表示 →
          </a>
        </div>
      )}
      {showUnassignedOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium text-amber-800">無所属のみ表示中（{membersToShow.length}名）</span>
          <a
            href={
              memberType === "guest"
                ? "/members?type=guest"
                : memberType === "all"
                  ? "/members?type=all"
                  : "/members"
            }
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            ← フィルターを解除
          </a>
        </div>
      )}
      <MembersList
        members={membersToShow}
        districtMap={districtMap}
        groupMap={groupMap}
        districts={districtsWithLocality}
        groups={groups ?? []}
        localityId={localityId}
        memberType={memberType}
        filterUnassigned={showUnassignedOnly}
      />
    </div>
  );
}
