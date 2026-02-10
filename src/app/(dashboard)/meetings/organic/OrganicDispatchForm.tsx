"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import { getGojuonRowLabel, GOJUON_ROW_LABELS } from "@/lib/furigana";
import { Toggle } from "@/components/Toggle";
import { DISPATCH_TYPE_LABELS, CATEGORY_LABELS } from "@/types/database";
import type { DispatchType } from "@/types/database";
import type { Category } from "@/types/database";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
type WeekOption = { value: string; label: string };
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
  district_id: string | null;
  group_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
  locality_name?: string;
  district_name?: string;
  group_name?: string;
};

type DispatchRow = {
  id: string;
  member_id: string;
  group_id: string;
  week_start: string;
  dispatch_type: DispatchType | null;
  dispatch_date: string | null;
  dispatch_memo: string | null;
};

type Props = {
  districts: District[];
  groups: Group[];
  defaultDistrictId: string;
  initialYear: number;
  initialWeekStartIso: string;
  weekOptions: WeekOption[];
};

const DISPATCH_OPTIONS: { value: "" | DispatchType; label: string }[] = [
  { value: "", label: "選択" },
  { value: "message", label: DISPATCH_TYPE_LABELS.message },
  { value: "phone", label: DISPATCH_TYPE_LABELS.phone },
  { value: "in_person", label: DISPATCH_TYPE_LABELS.in_person },
];

export function OrganicDispatchForm({
  districts,
  groups: groupsProp,
  defaultDistrictId,
  initialYear,
  initialWeekStartIso,
  weekOptions,
}: Props) {
  const districtId = defaultDistrictId ?? "";
  const weekStartIso = initialWeekStartIso;
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [dispatchMap, setDispatchMap] = useState<Map<string, DispatchRow>>(new Map());
  const [localType, setLocalType] = useState<Map<string, "" | DispatchType>>(new Map());
  const [localDate, setLocalDate] = useState<Map<string, string>>(new Map());
  const [localMemo, setLocalMemo] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOption>("furigana");
  const [group1, setGroup1] = useState<GroupOption | "">("");
  const [gojuonGroup, setGojuonGroup] = useState(true);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [memoPopupMemberId, setMemoPopupMemberId] = useState<string | null>(null);

  const districtMap = useMemo(() => new Map(districts.map((d) => [d.id, d.name])), [districts]);
  const groupMap = useMemo(() => new Map(groupsProp.map((g) => [g.id, g.name])), [groupsProp]);

  useEffect(() => {
    if (!districtId) {
      setGroups([]);
      setGroupId("");
      return;
    }
    const supabase = createClient();
    const isAllDistricts = districtId === "__all__";
    const list = isAllDistricts ? groupsProp : groupsProp.filter((g) => g.district_id === districtId);
    setGroups(list);
    setGroupId((prev) => {
      const stillValid = list.some((g) => g.id === prev) || prev === "__all__";
      return stillValid ? prev : "__all__";
    });
  }, [districtId, groupsProp]);

  useEffect(() => {
    if (!groupId || !weekStartIso) {
      setRoster([]);
      setDispatchMap(new Map());
      setLocalType(new Map());
      setLocalDate(new Map());
      setLocalMemo(new Map());
      return;
    }
    if (groupId === "__all__" && groups.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    const groupIds = groupId === "__all__" ? groups.map((g) => g.id) : [groupId];
    if (groupIds.length === 0) {
      setRoster([]);
      setDispatchMap(new Map());
      setLocalType(new Map());
      setLocalDate(new Map());
      setLocalMemo(new Map());
      setLoading(false);
      return;
    }
    Promise.all([
      groupId === "__all__"
        ? supabase
            .from("members")
            .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
            .in("group_id", groupIds)
            .order("name")
        : supabase
            .from("members")
            .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
            .eq("group_id", groupId)
            .order("name"),
      supabase
        .from("organic_dispatch_records")
        .select("id, member_id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo")
        .in("group_id", groupIds)
        .eq("week_start", weekStartIso),
    ]).then(([membersRes, dispatchRes]) => {
      if (cancelled) return;
      const members = (membersRes.data ?? []) as MemberRow[];
      const records = (dispatchRes.data ?? []) as DispatchRow[];
      const map = new Map<string, DispatchRow>();
      const typeMap = new Map<string, "" | DispatchType>();
      const dateMap = new Map<string, string>();
      const memoMap = new Map<string, string>();
      const weekDayValues = new Set(getDaysInWeek(weekStartIso).map((d) => d.value));
      records.forEach((r) => {
        map.set(r.member_id, r);
        typeMap.set(r.member_id, r.dispatch_type ?? "");
        const d = r.dispatch_date ?? "";
        dateMap.set(r.member_id, weekDayValues.has(d) ? d : "");
        memoMap.set(r.member_id, r.dispatch_memo ?? "");
      });
      setRoster(members);
      setDispatchMap(map);
      setLocalType(typeMap);
      setLocalDate(dateMap);
      setLocalMemo(memoMap);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, weekStartIso, groups]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("members")
      .select(
        "id, name, furigana, district_id, group_id, age_group, is_baptized, districts(name, localities(name)), groups(name)"
      )
      .ilike("name", `%${searchQuery.trim()}%`)
      .limit(15)
      .then(({ data }) => {
        const rows = (data ?? []).map((row: Record<string, unknown>) => {
          const dist = row.districts as { name?: string; localities?: { name: string }; locality?: { name: string } } | null;
          return {
            id: row.id as string,
            name: row.name as string,
            furigana: (row.furigana as string | null) ?? null,
            district_id: row.district_id as string | null,
            group_id: row.group_id as string | null,
            age_group: row.age_group as Category | null,
            is_baptized: Boolean(row.is_baptized),
            district_name: dist?.name,
            locality_name: dist?.localities?.name ?? dist?.locality?.name,
            group_name: (row.groups as { name: string } | null)?.name,
          };
        });
        setSearchResults(rows);
      });
  }, [searchQuery]);

  const addFromSearch = (member: MemberRow) => {
    if (roster.some((m) => m.id === member.id)) return;
    setRoster((prev) => [...prev, member]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const sortedMembers = useMemo(() => {
    const list = [...roster];
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
  }, [roster, sortOrder, districtMap, groupMap]);

  type Section = { group1Key: string; group1Label: string; members: MemberRow[] };
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
  const useGojuonGrouping = sortOrder === "furigana" && gojuonGroup;
  const sections = useMemo((): Section[] => {
    if (useGojuonGrouping) {
      const map = new Map<string, MemberRow[]>();
      for (const m of sortedMembers) {
        const key = getGojuonRowLabel(m.furigana ?? m.name);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
      }
      return GOJUON_ROW_LABELS.filter((l) => map.has(l)).map((label) => ({
        group1Key: label,
        group1Label: label,
        members: map.get(label) ?? [],
      }));
    }
    if (!group1) return [{ group1Key: "", group1Label: "", members: sortedMembers }];
    const map = new Map<string, MemberRow[]>();
    for (const m of sortedMembers) {
      const key = getKey(group1, m);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const group1Keys = sortKeys(group1, Array.from(map.keys()));
    return group1Keys.map((g1Key) => ({
      group1Key: g1Key,
      group1Label: getLabel(group1, g1Key),
      members: map.get(g1Key) ?? [],
    }));
  }, [sortedMembers, group1, districtMap, groupMap, useGojuonGrouping]);

  const syncOne = useCallback(
    async (
      memberId: string,
      overrides?: { type?: "" | DispatchType; date?: string; memo?: string }
    ) => {
      if (!groupId || !weekStartIso) return;
      const effectiveGroupId = groupId === "__all__" ? roster.find((m) => m.id === memberId)?.group_id : groupId;
      if (!effectiveGroupId) return;
      setSaveError(null);
      const type = ((overrides?.type !== undefined ? overrides.type : localType.get(memberId)) ?? "") as DispatchType | "";
      const date = (overrides?.date !== undefined ? overrides.date : localDate.get(memberId) ?? "").trim();
      const memo = (overrides?.memo !== undefined ? overrides.memo : localMemo.get(memberId) ?? "").trim();
      const allFilled = type !== "" && date !== "" && memo !== "";
      const supabase = createClient();
      const existing = dispatchMap.get(memberId);

      if (allFilled) {
        const payload = {
          dispatch_type: type as DispatchType,
          dispatch_date: date,
          dispatch_memo: memo,
        };
        if (existing) {
          const { error } = await supabase
            .from("organic_dispatch_records")
            .update({
              ...payload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (error) {
            const isRls = /row-level security|RLS/i.test(error.message ?? "");
            setSaveError(isRls ? "保存する権限がありません。報告者以上のロールが必要です。" : `保存に失敗しました: ${error.message}`);
            return;
          }
        } else {
          const { data: inserted, error } = await supabase
            .from("organic_dispatch_records")
            .insert({
              member_id: memberId,
              group_id: effectiveGroupId,
              week_start: weekStartIso,
              ...payload,
            })
            .select("id, member_id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo")
            .single();
          if (error) {
            const isRls = /row-level security|RLS/i.test(error.message ?? "");
            setSaveError(isRls ? "保存する権限がありません。報告者以上のロールが必要です。" : `保存に失敗しました: ${error.message}`);
            return;
          }
          if (inserted) {
            setDispatchMap((prev) => new Map(prev).set(memberId, inserted as DispatchRow));
          }
        }
      } else if (existing) {
        const { error } = await supabase.from("organic_dispatch_records").delete().eq("id", existing.id);
        if (error) {
          const isRls = /row-level security|RLS/i.test(error.message ?? "");
          setSaveError(isRls ? "削除する権限がありません。" : `削除に失敗しました: ${error.message}`);
          return;
        }
        setDispatchMap((prev) => {
          const next = new Map(prev);
          next.delete(memberId);
          return next;
        });
      }
    },
    [groupId, weekStartIso, dispatchMap, roster, localType, localDate, localMemo]
  );

  const onTypeChange = (memberId: string, value: "" | DispatchType) => {
    setLocalType((prev) => new Map(prev).set(memberId, value));
    syncOne(memberId, { type: value });
  };

  const onDateChange = (memberId: string, value: string) => {
    setLocalDate((prev) => new Map(prev).set(memberId, value));
    syncOne(memberId, { date: value });
  };

  const onMemoBlur = (memberId: string, memoValue?: string) => {
    if (memoValue !== undefined) {
      setLocalMemo((prev) => new Map(prev).set(memberId, memoValue));
      syncOne(memberId, { memo: memoValue });
    } else {
      syncOne(memberId);
    }
  };

  useEffect(() => {
    const hasIncomplete = roster.some((m) => {
      const t = (localType.get(m.id) ?? "") as string;
      const d = (localDate.get(m.id) ?? "").trim();
      const me = (localMemo.get(m.id) ?? "").trim();
      const hasAny = t !== "" || d !== "" || me !== "";
      const hasAll = t !== "" && d !== "" && me !== "";
      return hasAny && !hasAll;
    });
    if (!hasIncomplete) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "種類・日付・メモの3項目をすべて入力しないと保存されません。";
      return "種類・日付・メモの3項目をすべて入力しないと保存されません。";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [roster, localType, localDate, localMemo]);

  return (
    <div className="space-y-4">
      {!districtId ? (
        <p className="text-slate-500 text-sm">地区を選択してください（上記のフィルターで選択）。</p>
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-1 max-w-xs">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">小組</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            <option value="__all__">すべての小組</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {saveError}
        </div>
      )}

      {groupId && (
        <div>
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setAccordionOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 touch-target"
              aria-expanded={accordionOpen}
            >
              <span>フリー検索・並び順・グルーピング</span>
              <svg
                className={`w-5 h-5 text-slate-500 transition-transform ${accordionOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {accordionOpen && (
              <div className="border-t border-slate-200 px-4 pb-4 pt-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">フリー検索（名前）</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="名前で検索（他地区・他小組も可）"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                  />
                  {searchResults.length > 0 && (
                    <ul className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-lg max-h-60 overflow-auto">
                      {searchResults
                        .filter((m) => !roster.some((r) => r.id === m.id))
                        .map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => addFromSearch(m)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 touch-target"
                            >
                              <span className="font-medium">{m.name}</span>
                              <span className="ml-2 text-slate-500 text-xs">
                                {[m.locality_name, m.district_name, m.group_name, m.age_group ? CATEGORY_LABELS[m.age_group] : ""]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
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
                      onChange={(e) => setGroup1(e.target.value as GroupOption | "")}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                    >
                      <option value="">なし</option>
                      {(Object.keys(GROUP_LABELS) as GroupOption[]).map((k) => (
                        <option key={k} value={k}>{GROUP_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  {sortOrder === "furigana" && (
                    <Toggle
                      checked={gojuonGroup}
                      onChange={() => setGojuonGroup((v) => !v)}
                      label="五十音グループ"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="text-slate-600 text-sm mb-2">
            種類・日付・メモの3項目をすべて入力すると保存されます。3項目入力しないままページを移動すると保存されません。
          </p>
          {loading ? (
            <p className="text-slate-500 text-sm">読み込み中…</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">派遣種類</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">派遣日</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto"><span className="hidden sm:inline">メモ</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-500 text-sm">
                        名簿がありません
                      </td>
                    </tr>
                  )}
                  {sections.map((section, idx) => (
                    <Fragment key={`s-${section.group1Key}-${idx}`}>
                      {(group1 || useGojuonGrouping) && section.members.length > 0 && (
                        <tr className="bg-slate-100">
                          <td colSpan={4} className="px-3 py-1 text-sm font-medium text-slate-700">
                            {useGojuonGrouping ? section.group1Label : (group1 ? `${GROUP_LABELS[group1]}：${section.group1Label || "—"}` : "—")}
                          </td>
                        </tr>
                      )}
                      {section.members.map((m) => {
                    const hasType = (localType.get(m.id) ?? "") !== "";
                    const hasDate = (localDate.get(m.id) ?? "") !== "";
                    const hasMemo = (localMemo.get(m.id) ?? "").trim() !== "";
                    const hasInput = hasType || hasDate || hasMemo;
                    return (
                    <Fragment key={m.id}>
                    <tr
                      className={hasInput ? "bg-primary-50/70 hover:bg-primary-100/70 border-l-2 border-l-primary-500" : "hover:bg-slate-50"}
                    >
                      <td className="px-3 py-1.5 text-slate-800">{m.name}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={localType.get(m.id) ?? ""}
                          onChange={(e) => onTypeChange(m.id, (e.target.value || "") as "" | DispatchType)}
                          className="w-full max-w-[140px] px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                        >
                          {DISPATCH_OPTIONS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={localDate.get(m.id) ?? ""}
                          onChange={(e) => onDateChange(m.id, e.target.value)}
                          className="w-full max-w-[160px] px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                        >
                          <option value="">—</option>
                          {getDaysInWeek(weekStartIso).map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className="sm:hidden">
                          <button
                            type="button"
                            onClick={() => setMemoPopupMemberId(m.id)}
                            className="p-1 rounded touch-target inline-flex"
                            aria-label="メモを編集"
                          >
                            <svg className={`w-5 h-5 ${(localMemo.get(m.id) ?? "").trim() ? "text-primary-600" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                          </button>
                        </div>
                        <div className="hidden sm:block">
                          <input
                            type="text"
                            value={localMemo.get(m.id) ?? ""}
                            onChange={(e) => setLocalMemo((prev) => new Map(prev).set(m.id, e.target.value))}
                            onBlur={(e) => onMemoBlur(m.id, e.target.value)}
                            placeholder="メモ"
                            className="w-full min-w-[120px] max-w-xs px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                          />
                        </div>
                      </td>
                    </tr>
                    {(localMemo.get(m.id) ?? "").trim() && (
                      <tr className="sm:hidden bg-slate-50/50">
                        <td colSpan={4} className="px-3 py-0.5 pb-1.5 text-xs text-slate-500">
                          {localMemo.get(m.id)}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {memoPopupMemberId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="organic-memo-popup-title"
          onClick={() => setMemoPopupMemberId(null)}
        >
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="organic-memo-popup-title" className="text-sm font-medium text-slate-700 mb-2">派遣メモ</h2>
            <textarea
              value={localMemo.get(memoPopupMemberId) ?? ""}
              onChange={(e) => setLocalMemo((prev) => new Map(prev).set(memoPopupMemberId, e.target.value))}
              placeholder="メモ"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg touch-target resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setMemoPopupMemberId(null)}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 touch-target"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onMemoBlur(memoPopupMemberId);
                  setMemoPopupMemberId(null);
                }}
                className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg touch-target"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
