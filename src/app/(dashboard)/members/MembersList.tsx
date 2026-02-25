"use client";

import Link from "next/link";
import { Fragment, useState, useMemo } from "react";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import { getLanguageLabel } from "@/lib/languages";
import { EnrollmentMemoHtml } from "@/components/EnrollmentMemoHtml";

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={onClose} />
      <div
        className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-xl border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white rounded-t-lg">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 touch-target"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}

type SortOption = "furigana" | "district" | "group" | "age_group";
type GroupOption = "district" | "group" | "age_group" | "believer";

const SORT_LABELS: Record<SortOption, string> = {
  furigana: "フリガナ順",
  district: "地区順",
  group: "小組順",
  age_group: "年齢層順",
};

const GROUP_LABELS: Record<GroupOption, string> = {
  district: "地区",
  group: "小組",
  age_group: "年齢層",
  believer: "信者",
};

const BAPTISM_PRECISION_LABELS: Record<string, string> = {
  exact: "日付確定",
  unknown: "不明",
  approximate: "おおよそ",
};

function formatBaptismDate(m: MemberRow): string {
  if (m.baptism_year != null && m.baptism_month != null && m.baptism_day != null) {
    return `${m.baptism_year}-${String(m.baptism_month).padStart(2, "0")}-${String(m.baptism_day).padStart(2, "0")}`;
  }
  if (m.baptism_year != null && m.baptism_month != null) return `${m.baptism_year}-${String(m.baptism_month).padStart(2, "0")}`;
  if (m.baptism_year != null) return String(m.baptism_year);
  return "—";
}

type MemberRow = {
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
  local_member_join_date?: string | null;
  local_member_leave_date?: string | null;
  enrollment_periods?: { period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean; memo: string | null }[];
};

type DistrictRow = { id: string; name: string; locality_id: string | null };
type GroupRow = { id: string; name: string; district_id: string };

type Props = {
  members: MemberRow[];
  districtMap: Map<string, string>;
  groupMap: Map<string, string>;
  districts: DistrictRow[];
  groups: GroupRow[];
  localityId: string | null;
  memberType: "local" | "guest" | "all";
  filterUnassigned: boolean;
};

export function MembersList({
  members,
  districtMap,
  groupMap,
  districts,
  groups,
  localityId,
  memberType,
  filterUnassigned,
}: Props) {
  const [sortOrder, setSortOrder] = useState<SortOption>("furigana");
  const [group1, setGroup1] = useState<GroupOption | "">("");
  const [group2, setGroup2] = useState<GroupOption | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterDistrict, setFilterDistrict] = useState<string>("");
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>("");
  const [filterBeliever, setFilterBeliever] = useState<string>("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const groupOptionsForFilter = useMemo(() => {
    if (filterDistrict) {
      return groups.filter((g) => g.district_id === filterDistrict);
    }
    if (localityId) {
      const districtIdsInLocality = new Set(
        districts.filter((d) => d.locality_id === localityId).map((d) => d.id)
      );
      return groups.filter((g) => districtIdsInLocality.has(g.district_id));
    }
    return groups;
  }, [filterDistrict, localityId, districts, groups]);

  const group2Options = useMemo(() => {
    if (!group1) return (["district", "group", "age_group", "believer"] as GroupOption[]);
    return (["district", "group", "age_group", "believer"] as GroupOption[]).filter((g) => g !== group1);
  }, [group1]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (filterDistrict && m.district_id !== filterDistrict) return false;
      if (filterGroup && m.group_id !== filterGroup) return false;
      if (filterAgeGroup && m.age_group !== filterAgeGroup) return false;
      if (filterBeliever === "believer" && !m.is_baptized) return false;
      if (filterBeliever === "friend" && m.is_baptized) return false;
      return true;
    });
  }, [members, filterDistrict, filterGroup, filterAgeGroup, filterBeliever]);

  const sortedMembers = useMemo(() => {
    const list = [...filteredMembers];
    const collator = new Intl.Collator("ja");
    const byFurigana = (a: MemberRow, b: MemberRow) =>
      collator.compare((a.furigana ?? a.name), (b.furigana ?? b.name));
    const byName = (a: MemberRow, b: MemberRow) => collator.compare(a.name, b.name);
    const byDistrict = (a: MemberRow, b: MemberRow) => {
      const da = districtMap.get(a.district_id ?? "") ?? "";
      const db = districtMap.get(b.district_id ?? "") ?? "";
      return collator.compare(da, db) || byName(a, b);
    };
    const byGroup = (a: MemberRow, b: MemberRow) => {
      const ga = groupMap.get(a.group_id ?? "") ?? "";
      const gb = groupMap.get(b.group_id ?? "") ?? "";
      return collator.compare(ga, gb) || byName(a, b);
    };
    const ageOrder: Category[] = ["adult", "university", "high_school", "junior_high", "elementary", "preschool"];
    const byAgeGroup = (a: MemberRow, b: MemberRow) => {
      const ai = a.age_group ? ageOrder.indexOf(a.age_group) : -1;
      const bi = b.age_group ? ageOrder.indexOf(b.age_group) : -1;
      return ai - bi || byName(a, b);
    };
    if (sortOrder === "furigana") list.sort(byFurigana);
    else if (sortOrder === "district") list.sort(byDistrict);
    else if (sortOrder === "group") list.sort(byGroup);
    else list.sort(byAgeGroup);
    return list;
  }, [filteredMembers, sortOrder, districtMap, groupMap]);

  type Section = { group1Key: string; group1Label: string; group2Key: string; group2Label: string; members: MemberRow[] };

  const getKey = (opt: GroupOption, m: MemberRow): string => {
    if (opt === "district") return m.district_id ?? "__none__";
    if (opt === "group") return m.group_id ?? "__none__";
    if (opt === "age_group") return m.age_group ?? "__none__";
    return m.is_baptized ? "believer" : "friend";
  };
  const getLabel = (opt: GroupOption, key: string): string => {
    if (opt === "district") return key === "__none__" ? "—" : (districtMap.get(key) ?? "");
    if (opt === "group") return key === "__none__" ? "無所属" : (groupMap.get(key) ?? "");
    if (opt === "age_group") return key === "__none__" ? "不明" : (key in CATEGORY_LABELS ? CATEGORY_LABELS[key as Category] : "");
    return key === "believer" ? "聖徒" : "友人";
  };
  const sortKeys = (opt: GroupOption, keys: string[]): string[] => {
    return [...keys].sort((a, b) => {
      if (opt === "district") return new Intl.Collator("ja").compare(districtMap.get(a) ?? "", districtMap.get(b) ?? "");
      if (opt === "group") return new Intl.Collator("ja").compare(groupMap.get(a) ?? "", groupMap.get(b) ?? "");
      if (opt === "age_group") {
        const order: Category[] = ["adult", "university", "high_school", "junior_high", "elementary", "preschool"];
        return (order.indexOf(a as Category) >= 0 ? order.indexOf(a as Category) : 999) - (order.indexOf(b as Category) >= 0 ? order.indexOf(b as Category) : 999);
      }
      return a === "believer" ? -1 : 1;
    });
  };

  const memberNameMap = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const sections = useMemo((): Section[] => {
    if (!group1) return [{ group1Key: "", group1Label: "", group2Key: "", group2Label: "", members: sortedMembers }];
    const map = new Map<string, MemberRow[]>();
    for (const m of sortedMembers) {
      const key = getKey(group1, m);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const group1Keys = sortKeys(group1, Array.from(map.keys()));
    const result: Section[] = [];
    for (const g1Key of group1Keys) {
      const group1Label = getLabel(group1, g1Key);
      const bucket = map.get(g1Key) ?? [];
      if (!group2) {
        result.push({ group1Key: g1Key, group1Label, group2Key: "", group2Label: "", members: bucket });
        continue;
      }
      const subMap = new Map<string, MemberRow[]>();
      for (const m of bucket) {
        const key = getKey(group2, m);
        if (!subMap.has(key)) subMap.set(key, []);
        subMap.get(key)!.push(m);
      }
      const group2Keys = sortKeys(group2, Array.from(subMap.keys()));
      for (const g2Key of group2Keys) {
        const group2Label = getLabel(group2, g2Key);
        result.push({
          group1Key: g1Key,
          group1Label,
          group2Key: g2Key,
          group2Label,
          members: subMap.get(g2Key) ?? [],
        });
      }
    }
    return result;
  }, [sortedMembers, group1, group2, districtMap, groupMap]);

  const buildMembersUrl = (type: "local" | "guest" | "all") => {
    const params = new URLSearchParams();
    if (filterUnassigned) params.set("filter", "unassigned");
    if (type === "guest") params.set("type", "guest");
    if (type === "all") params.set("type", "all");
    const q = params.toString() ? `?${params.toString()}` : "";
    return `/members${q}`;
  };

  const hasActiveFilter = !!(filterDistrict || filterGroup || filterAgeGroup || filterBeliever);

  const filterContent = (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">ローカル/ゲスト</label>
        <select
          aria-label="ローカル/ゲスト"
          value={memberType}
          onChange={(e) => {
            const t = e.target.value as "local" | "guest" | "all";
            window.location.href = buildMembersUrl(t);
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="local">ローカル</option>
          <option value="guest">ゲスト</option>
          <option value="all">ローカル+ゲスト</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">地区</label>
        <select
          aria-label="地区"
          value={filterDistrict}
          onChange={(e) => {
            setFilterDistrict(e.target.value);
            setFilterGroup("");
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">地区を選択</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">小組</label>
        <select
          aria-label="小組"
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">小組を選択</option>
          {groupOptionsForFilter.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">年齢層</label>
        <select
          aria-label="年齢層"
          value={filterAgeGroup}
          onChange={(e) => setFilterAgeGroup(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">年齢層を選択</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">聖徒/友人</label>
        <select
          aria-label="聖徒/友人"
          value={filterBeliever}
          onChange={(e) => setFilterBeliever(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">聖徒/友人を選択</option>
          <option value="believer">聖徒</option>
          <option value="friend">友人</option>
        </select>
      </div>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            setFilterDistrict("");
            setFilterGroup("");
            setFilterAgeGroup("");
            setFilterBeliever("");
          }}
          className="text-sm text-primary-600 hover:underline touch-target"
        >
          フィルター解除
        </button>
      )}
    </div>
  );

  const sortContent = (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">並び順</label>
      <select
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value as SortOption)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
          <option key={k} value={k}>{SORT_LABELS[k]}</option>
        ))}
      </select>
    </div>
  );

  const groupContent = (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">グルーピング1層目</label>
        <select
          value={group1}
          onChange={(e) => {
            setGroup1(e.target.value as GroupOption | "");
            setGroup2("");
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">なし</option>
          {(Object.keys(GROUP_LABELS) as GroupOption[]).map((k) => (
            <option key={k} value={k}>{GROUP_LABELS[k]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">グルーピング2層目</label>
        <select
          value={group2}
          onChange={(e) => setGroup2(e.target.value as GroupOption | "")}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">なし</option>
          {group2Options.map((k) => (
            <option key={k} value={k}>{GROUP_LABELS[k]}</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* モバイル: アイコンボタンでモーダルを開く */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setFilterModalOpen(true)}
          className={`flex items-center justify-center w-10 h-10 rounded-lg border touch-target ${
            hasActiveFilter
              ? "border-primary-500 bg-primary-50 text-primary-600"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          aria-label="フィルター"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setSortModalOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 touch-target"
          aria-label="並び順"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setGroupModalOpen(true)}
          className={`flex items-center justify-center w-10 h-10 rounded-lg border touch-target ${
            group1 || group2 ? "border-primary-500 bg-primary-50 text-primary-600" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          aria-label="グルーピング"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </button>
        <Link
          href="/members/new"
          className="inline-flex items-center justify-center px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg touch-target ml-auto hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          追加
        </Link>
      </div>

      {/* デスクトップ: フィルター（モバイルでは非表示） */}
      <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap p-3 bg-slate-50 rounded-lg border border-slate-200">
        <select
          aria-label="ローカル/ゲスト"
          value={memberType}
          onChange={(e) => {
            const t = e.target.value as "local" | "guest" | "all";
            window.location.href = buildMembersUrl(t);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="local">ローカル</option>
          <option value="guest">ゲスト</option>
          <option value="all">ローカル+ゲスト</option>
        </select>
        <select
          aria-label="地区"
          value={filterDistrict}
          onChange={(e) => {
            setFilterDistrict(e.target.value);
            setFilterGroup("");
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">地区を選択</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          aria-label="小組"
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">小組を選択</option>
          {groupOptionsForFilter.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          aria-label="年齢層"
          value={filterAgeGroup}
          onChange={(e) => setFilterAgeGroup(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">年齢層を選択</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
        <select
          aria-label="聖徒/友人"
          value={filterBeliever}
          onChange={(e) => setFilterBeliever(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
        >
          <option value="">聖徒/友人を選択</option>
          <option value="believer">聖徒</option>
          <option value="friend">友人</option>
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setFilterDistrict("");
              setFilterGroup("");
              setFilterAgeGroup("");
              setFilterBeliever("");
            }}
            className="text-sm text-primary-600 hover:underline touch-target"
          >
            フィルター解除
          </button>
        )}
      </div>
      {/* デスクトップ: 並び順・グルーピング（モバイルでは非表示） */}
      <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">並び順</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOption)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">グルーピング1層目</label>
          <select
            value={group1}
            onChange={(e) => {
              setGroup1(e.target.value as GroupOption | "");
              setGroup2("");
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
          >
            <option value="">なし</option>
            {(Object.keys(GROUP_LABELS) as GroupOption[]).map((k) => (
              <option key={k} value={k}>{GROUP_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">グルーピング2層目</label>
          <select
            value={group2}
            onChange={(e) => setGroup2(e.target.value as GroupOption | "")}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
          >
            <option value="">なし</option>
            {group2Options.map((k) => (
              <option key={k} value={k}>{GROUP_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <Link
          href="/members/new"
          className="inline-flex items-center justify-center px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg touch-target ml-auto hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          メンバーを追加
        </Link>
      </div>

      {/* モバイル用モーダル */}
      <Modal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="フィルター">
        {filterContent}
      </Modal>
      <Modal open={sortModalOpen} onClose={() => setSortModalOpen(false)} title="並び順">
        {sortContent}
      </Modal>
      <Modal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} title="グルーピング">
        {groupContent}
      </Modal>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase w-8" />
                <th className="px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase">氏名</th>
                <th className="hidden md:table-cell px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase">フリガナ</th>
                <th className="px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase">地区</th>
                <th className="px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase">小組</th>
                <th className="px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase">年齢層</th>
                <th className="px-1.5 py-1 text-left text-xs font-medium text-slate-500 uppercase">聖徒/友人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sections.map((section, idx) => {
                const prev = sections[idx - 1];
                const showGroup1 = group1 && (!prev || prev.group1Key !== section.group1Key);
                const showGroup2 = group2 && (!prev || prev.group1Key !== section.group1Key || prev.group2Key !== section.group2Key);
                return (
                  <Fragment key={`${section.group1Key}-${section.group2Key}-${idx}`}>
                    {showGroup1 && (
                      <tr className="bg-slate-100">
                        <td colSpan={7} className="px-1.5 py-1 text-sm font-medium text-slate-700">
                          {GROUP_LABELS[group1 as GroupOption]}：{section.group1Label || "—"}
                        </td>
                      </tr>
                    )}
                    {showGroup2 && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-1.5 py-1 pl-3 text-sm font-medium text-slate-600">
                          {GROUP_LABELS[group2 as GroupOption]}：{section.group2Label || "—"}
                        </td>
                      </tr>
                    )}
                    {section.members.map((m) => {
                    const isExpanded = expandedId === m.id;
                    return (
                      <Fragment key={m.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : m.id)}
                          className="hover:bg-slate-50 cursor-pointer touch-target"
                        >
                          <td className="px-1.5 py-1 text-slate-400">{isExpanded ? "▼" : "▶"}</td>
                          <td className="px-1.5 py-1">
                            <Link
                              href={`/members/${m.id}/edit${buildMembersUrl(memberType).replace("/members", "")}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-primary-600 hover:underline"
                            >
                              {m.name}
                            </Link>
                          </td>
                          <td className="hidden md:table-cell px-1.5 py-1 text-sm text-slate-600 whitespace-nowrap">{m.furigana ?? "—"}</td>
                          <td className="px-1.5 py-1 text-sm text-slate-600 whitespace-nowrap">{districtMap.get(m.district_id ?? "") ?? "—"}</td>
                          <td className="px-1.5 py-1 text-sm text-slate-600 whitespace-nowrap">{groupMap.get(m.group_id ?? "") ?? (m.is_local ? "未所属" : "—")}</td>
                          <td className="px-1.5 py-1 text-sm text-slate-600 whitespace-nowrap">{m.age_group ? CATEGORY_LABELS[m.age_group] : "—"}</td>
                          <td className="px-1.5 py-1 text-sm text-slate-600 whitespace-nowrap">{m.is_baptized ? "聖徒" : "友人"}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${m.id}-detail`}>
                            <td colSpan={7} className="px-1.5 py-1.5 bg-slate-50 border-b border-slate-200">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                <span className="text-slate-500 md:hidden">フリガナ</span>
                                <span className="text-slate-800 md:hidden">{m.furigana ?? "—"}</span>
                                <span className="text-slate-500">性別</span>
                                <span className="text-slate-800">{m.gender === "male" ? "男" : "女"}</span>
                                <span className="text-slate-500">ローカル/ゲスト</span>
                                <span className="text-slate-800">{m.is_local ? "ローカル" : "ゲスト"}</span>
                                <span className="text-slate-500">地区</span>
                                <span className="text-slate-800">{districtMap.get(m.district_id ?? "") ?? "—"}</span>
                                <span className="text-slate-500">小組</span>
                                <span className="text-slate-800">{groupMap.get(m.group_id ?? "") ?? (m.is_local ? "未所属" : "—")}</span>
                                <span className="text-slate-500">区分</span>
                                <span className="text-slate-800">{m.age_group ? CATEGORY_LABELS[m.age_group] : "—"}</span>
                                <span className="text-slate-500">聖徒/友人</span>
                                <span className="text-slate-800">{m.is_baptized ? "聖徒" : "友人"}</span>
                                <span className="text-slate-500">バプテスマ日</span>
                                <span className="text-slate-800">{formatBaptismDate(m)}</span>
                                {m.baptism_date_precision && (
                                  <>
                                    <span className="text-slate-500">バプテスマ日精度</span>
                                    <span className="text-slate-800">{BAPTISM_PRECISION_LABELS[m.baptism_date_precision] ?? m.baptism_date_precision}</span>
                                  </>
                                )}
                                <span className="text-slate-500">主言語</span>
                                <span className="text-slate-800">{getLanguageLabel(m.language_main)}</span>
                                <span className="text-slate-500">副言語</span>
                                <span className="text-slate-800">{getLanguageLabel(m.language_sub)}</span>
                                {m.follower_id && (
                                  <>
                                    <span className="text-slate-500">フォロー担当</span>
                                    <span className="text-slate-800">{memberNameMap.get(m.follower_id) ?? m.follower_id}</span>
                                  </>
                                )}
                                {m.is_local && (
                                  <>
                                    <span className="text-slate-500">ローカルメンバー転入日</span>
                                    <span className="text-slate-800">
                                      {m.enrollment_periods?.length
                                        ? m.enrollment_periods
                                            .sort((a, b) => a.period_no - b.period_no)
                                            .map((p, i) => `期間${i + 1}: ${p.join_date ?? "—"}${p.is_uncertain ? " (不確定)" : ""}`)
                                            .join(" / ")
                                        : m.local_member_join_date ?? "—"}
                                    </span>
                                    {(m.enrollment_periods?.some((p) => p.leave_date) || m.local_member_leave_date) && (
                                      <>
                                        <span className="text-slate-500">ローカルメンバー転出日</span>
                                        <span className="text-slate-800">
                                          {m.enrollment_periods?.length
                                            ? m.enrollment_periods
                                                .sort((a, b) => a.period_no - b.period_no)
                                                .filter((p) => p.leave_date)
                                                .map((p) => `期間${p.period_no}: ${p.leave_date}`)
                                                .join(" / ")
                                            : m.local_member_leave_date ?? ""}
                                        </span>
                                      </>
                                    )}
                                    {m.enrollment_periods?.some((p) => p.memo) && (
                                      <>
                                        <span className="text-slate-500">在籍メモ</span>
                                        <span className="text-slate-800">
                                          {m.enrollment_periods
                                            ?.sort((a, b) => a.period_no - b.period_no)
                                            .map((p, i) =>
                                              p.memo ? (
                                                <Fragment key={p.period_no}>
                                                  {i > 0 && <span className="block mt-1" />}
                                                  <span className="block">
                                                    <span className="text-slate-500 font-medium">期間{i + 1}: </span>
                                                    <EnrollmentMemoHtml memo={p.memo} />
                                                  </span>
                                                </Fragment>
                                              ) : null
                                            )}
                                        </span>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredMembers.length === 0 && (
          <div className="px-1.5 py-6 text-center text-slate-500 text-sm">
            {members.length === 0
              ? "メンバーがいません"
              : "条件に一致するメンバーがいません"}
          </div>
        )}
      </div>
    </div>
  );
}
