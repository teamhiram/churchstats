"use client";

import Link from "next/link";
import { Fragment, useState, useMemo } from "react";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

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

type MemberRow = {
  id: string;
  name: string;
  furigana: string | null;
  gender: string;
  is_local: boolean;
  district_id: string | null;
  group_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap p-3 bg-slate-50 rounded-lg border border-slate-200">
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
        {(filterDistrict || filterGroup || filterAgeGroup || filterBeliever) && (
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
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
          className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-600 text-white text-sm font-medium rounded-lg touch-target ml-auto hover:bg-slate-700"
        >
          メンバーを追加
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-8" />
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">氏名</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">フリガナ</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">地区</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">小組</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">年齢層</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">聖徒/友人</th>
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
                        <td colSpan={7} className="px-2 py-1.5 text-sm font-medium text-slate-700">
                          {GROUP_LABELS[group1 as GroupOption]}：{section.group1Label || "—"}
                        </td>
                      </tr>
                    )}
                    {showGroup2 && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-2 py-1 pl-4 text-sm font-medium text-slate-600">
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
                          <td className="px-2 py-1.5 text-slate-400">{isExpanded ? "▼" : "▶"}</td>
                          <td className="px-2 py-1.5">
                            <Link
                              href={`/members/${m.id}/edit`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-primary-600 hover:underline"
                            >
                              {m.name}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5 text-sm text-slate-600">{m.furigana ?? "—"}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-600">{districtMap.get(m.district_id ?? "") ?? "—"}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-600">{groupMap.get(m.group_id ?? "") ?? (m.is_local ? "未所属" : "—")}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-600">{m.age_group ? CATEGORY_LABELS[m.age_group] : "—"}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-600">{m.is_baptized ? "聖徒" : "友人"}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${m.id}-detail`}>
                            <td colSpan={7} className="px-2 py-2 bg-slate-50 border-b border-slate-200">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                <span className="text-slate-500">性別</span>
                                <span className="text-slate-800">{m.gender === "male" ? "男" : "女"}</span>
                                <span className="text-slate-500">ローカル/ゲスト</span>
                                <span className="text-slate-800">{m.is_local ? "ローカル" : "ゲスト"}</span>
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
          <div className="px-2 py-6 text-center text-slate-500 text-sm">
            {members.length === 0
              ? "メンバーがいません"
              : "条件に一致するメンバーがいません"}
          </div>
        )}
      </div>
    </div>
  );
}
