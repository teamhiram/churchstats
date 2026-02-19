"use client";

import Link from "next/link";
import type { Category } from "@/types/database";
import { MembersList } from "./MembersList";
import { useMembersData } from "./useMembersData";
import type { MembersApiResponse } from "@/app/api/members/route";

function isUnassigned(m: { is_local: boolean; district_id: string | null; group_id: string | null }) {
  return m.is_local && (!m.district_id || !m.group_id);
}

type Props = {
  initialData?: MembersApiResponse;
  searchParams: { filter?: string; type?: string };
};

export function MembersPageClient({ initialData, searchParams }: Props) {
  const { data, isPending, error } = useMembersData(initialData);
  const showUnassignedOnly = searchParams.filter === "unassigned";
  const memberType =
    searchParams.type === "guest" ? "guest" : searchParams.type === "all" ? "all" : "local";

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        データの取得に失敗しました。画面を更新してください。
      </div>
    );
  }

  if (isPending && !data) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    );
  }

  const raw = data!;
  const rows = raw.members.map((m) => ({
    id: m.id,
    name: m.name,
    furigana: m.furigana ?? null,
    gender: m.gender,
    is_local: m.is_local,
    district_id: m.district_id,
    group_id: m.group_id,
    age_group: m.age_group as Category | null,
    is_baptized: m.is_baptized,
    local_member_join_date: m.local_member_join_date ?? null,
    local_member_leave_date: m.local_member_leave_date ?? null,
    enrollment_periods: m.enrollment_periods ?? undefined,
  }));
  const byType =
    memberType === "guest"
      ? rows.filter((m) => !m.is_local)
      : memberType === "all"
        ? rows
        : rows.filter((m) => m.is_local);
  const unassigned = byType.filter(isUnassigned);
  const membersToShow = showUnassignedOnly ? unassigned : byType;

  const districtMap = new Map(raw.districts.map((d) => [d.id, d.name]));
  const groupMap = new Map(raw.groups.map((g) => [g.id, g.name]));
  const districtsWithLocality = raw.districts.map((d) => ({
    id: d.id,
    name: d.name,
    locality_id: d.locality_id ?? null,
  }));

  return (
    <div className="space-y-3">
      {unassigned.length > 0 && !showUnassignedOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <h2 className="font-semibold text-amber-800 mb-2">無所属リスト（{unassigned.length}名）</h2>
          <p className="text-sm text-amber-700 mb-2">小組に割り当ててください。</p>
          <Link
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
          </Link>
        </div>
      )}
      {showUnassignedOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium text-amber-800">無所属のみ表示中（{membersToShow.length}名）</span>
          <Link
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
          </Link>
        </div>
      )}
      <MembersList
        members={membersToShow}
        districtMap={districtMap}
        groupMap={groupMap}
        districts={districtsWithLocality}
        groups={raw.groups}
        localityId={raw.localityId}
        memberType={memberType}
        filterUnassigned={showUnassignedOnly}
      />
    </div>
  );
}
