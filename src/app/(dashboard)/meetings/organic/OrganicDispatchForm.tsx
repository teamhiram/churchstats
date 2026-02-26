"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { formatDateYmd, getDaysInWeek, getSundayWeeksInYear } from "@/lib/weekUtils";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { getGojuonRowLabel, GOJUON_ROW_LABELS } from "@/lib/furigana";
import { DISPATCH_TYPE_LABELS, CATEGORY_LABELS } from "@/types/database";
import type { DispatchType } from "@/types/database";
import type { Category } from "@/types/database";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
type WeekOption = { value: string; label: string };
type SortOption = "furigana" | "district" | "group" | "age_group";
type GroupOption = "district" | "group" | "age_group" | "believer" | "attendance" | "gojuon";

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
  attendance: "出欠別",
  gojuon: "五十音別",
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
  visitor_ids: string[] | null;
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
  const [groupId, setGroupId] = useState<string>(() => {
    const d = defaultDistrictId ?? "";
    if (!d) return "";
    const list = d === "__all__" ? groupsProp : groupsProp.filter((g) => g.district_id === d);
    return list.length > 0 ? "__all__" : "";
  });
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [dispatchMap, setDispatchMap] = useState<Map<string, DispatchRow>>(new Map());
  const [localType, setLocalType] = useState<Map<string, "" | DispatchType>>(new Map());
  const [localDate, setLocalDate] = useState<Map<string, string>>(new Map());
  const [localMemo, setLocalMemo] = useState<Map<string, string>>(new Map());
  const [localVisitors, setLocalVisitors] = useState<Map<string, string[]>>(new Map());
  const [memberIdToName, setMemberIdToName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOption>("furigana");
  const [group1, setGroup1] = useState<GroupOption | "">("");
  const [group2, setGroup2] = useState<GroupOption | "">("");
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [recordPopupMemberId, setRecordPopupMemberId] = useState<string | null>(null);
  type PopupForm = { type: "" | DispatchType; date: string; memo: string; visitors: string[] };
  const [popupForm, setPopupForm] = useState<PopupForm | null>(null);
  const [popupVisitorSearchQuery, setPopupVisitorSearchQuery] = useState("");
  const [popupVisitorSearchResults, setPopupVisitorSearchResults] = useState<MemberRow[]>([]);

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
      setLocalVisitors(new Map());
      return;
    }
    if (groupId === "__all__" && groups.length === 0 && (districtId !== "__all__" || groupsProp.length === 0)) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    const groupIds =
      groupId === "__all__"
        ? districtId === "__all__"
          ? groupsProp.map((g) => g.id)
          : groups.map((g) => g.id)
        : [groupId];
    if (groupIds.length === 0) {
      setRoster([]);
      setDispatchMap(new Map());
      setLocalType(new Map());
      setLocalDate(new Map());
      setLocalMemo(new Map());
      setLocalVisitors(new Map());
      setLoading(false);
      return;
    }
    const weekDays = getDaysInWeek(weekStartIso);
    const weekDayValues = new Set(weekDays.map((d) => d.value));
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
        .select("id, member_id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo, visitor_ids")
        .in("group_id", groupIds)
        .eq("week_start", weekStartIso),
    ]).then(([membersRes, dispatchRes]) => {
      if (cancelled) return;
      const members = (membersRes.data ?? []) as MemberRow[];
      const records = (dispatchRes.data ?? []) as (DispatchRow & { visitor_ids?: string[] | null })[];
      if (dispatchRes.error) {
        console.error("[organic_dispatch] fetch error", dispatchRes.error);
        setSaveError(`派遣履歴の取得に失敗しました: ${dispatchRes.error.message}`);
      } else {
        setSaveError(null);
      }
      const map = new Map<string, DispatchRow>();
      const typeMap = new Map<string, "" | DispatchType>();
      const dateMap = new Map<string, string>();
      const memoMap = new Map<string, string>();
      const visitorsMap = new Map<string, string[]>();
      const normalizeVisitorIds = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((id) => String(id)).filter(Boolean) : [];
      records.forEach((r) => {
        const visitorIds = normalizeVisitorIds(r.visitor_ids);
        map.set(r.member_id, { ...r, visitor_ids: visitorIds });
        typeMap.set(r.member_id, r.dispatch_type ?? "");
        const d = r.dispatch_date ?? "";
        dateMap.set(r.member_id, weekDayValues.has(d) ? d : "");
        memoMap.set(r.member_id, r.dispatch_memo ?? "");
        visitorsMap.set(r.member_id, visitorIds);
      });
      setRoster(members);
      setDispatchMap(map);
      setLocalType(typeMap);
      setLocalDate(dateMap);
      setLocalMemo(memoMap);
      setLocalVisitors(visitorsMap);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, weekStartIso, groups, districtId, groupsProp]);

  useEffect(() => {
    const fromRoster = new Map<string, string>(roster.map((m) => [m.id, m.name]));
    const visitorIds = new Set<string>();
    localVisitors.forEach((ids) => ids.forEach((id) => visitorIds.add(String(id))));
    dispatchMap.forEach((_, memberId) => visitorIds.add(String(memberId)));
    const missing = [...visitorIds].filter((id) => !fromRoster.has(id));
    if (missing.length === 0) {
      setMemberIdToName(fromRoster);
      return;
    }
    const supabase = createClient();
    supabase
      .from("members")
      .select("id, name")
      .in("id", missing)
      .then(({ data }) => {
        setMemberIdToName((prev) => {
          const next = new Map(prev);
          fromRoster.forEach((name, id) => next.set(id, name));
          (data ?? []).forEach((row: { id: string; name: string }) => next.set(row.id, row.name));
          return next;
        });
      });
  }, [roster, localVisitors, dispatchMap]);

  useEffect(() => {
    if (!popupVisitorSearchQuery.trim() || !recordPopupMemberId) {
      setPopupVisitorSearchResults([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("members")
      .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
      .ilike("name", `%${popupVisitorSearchQuery.trim()}%`)
      .limit(15)
      .then(({ data }) => {
        setPopupVisitorSearchResults((data ?? []) as MemberRow[]);
      });
  }, [popupVisitorSearchQuery, recordPopupMemberId]);

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

  const getKey = (opt: GroupOption, m: MemberRow): string => {
    if (opt === "district") return m.district_id ?? "__none__";
    if (opt === "group") return m.group_id ?? "__none__";
    if (opt === "age_group") return m.age_group ?? "__none__";
    if (opt === "attendance") return dispatchMap.has(m.id) ? "attended" : "absent";
    if (opt === "gojuon") return getGojuonRowLabel(m.furigana ?? m.name);
    return m.is_baptized ? "believer" : "friend";
  };
  const getLabel = (opt: GroupOption, key: string): string => {
    if (opt === "district") return key === "__none__" ? "—" : (districtMap.get(key) ?? "");
    if (opt === "group") return key === "__none__" ? "無所属" : (groupMap.get(key) ?? "");
    if (opt === "age_group") return key === "__none__" ? "不明" : (key in CATEGORY_LABELS ? CATEGORY_LABELS[key as Category] : "");
    if (opt === "attendance") return key === "attended" ? "出席" : "欠席";
    if (opt === "gojuon") return key;
    return key === "believer" ? "聖徒" : "友人";
  };
  const sortKeys = (opt: GroupOption, keys: string[]): string[] => {
    if (opt === "attendance") return ["attended", "absent"].filter((k) => keys.includes(k));
    if (opt === "gojuon") return GOJUON_ROW_LABELS.filter((l) => keys.includes(l));
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
  const group2Options = useMemo(
    () => (Object.keys(GROUP_LABELS) as GroupOption[]).filter((k) => k !== group1),
    [group1]
  );
  type Subsection = { group2Key: string; group2Label: string; members: MemberRow[] };
  type Section = { group1Key: string; group1Label: string; subsections: Subsection[] };
  const sections = useMemo((): Section[] => {
    if (!group1) return [{ group1Key: "", group1Label: "", subsections: [{ group2Key: "", group2Label: "", members: sortedMembers }] }];
    const map = new Map<string, MemberRow[]>();
    for (const m of sortedMembers) {
      const key = getKey(group1, m);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const group1Keys = sortKeys(group1, Array.from(map.keys()));
    return group1Keys.map((g1Key) => {
      const members = map.get(g1Key) ?? [];
      if (!group2) {
        return { group1Key: g1Key, group1Label: getLabel(group1, g1Key), subsections: [{ group2Key: "", group2Label: "", members }] };
      }
      const subMap = new Map<string, MemberRow[]>();
      for (const m of members) {
        const key = getKey(group2, m);
        if (!subMap.has(key)) subMap.set(key, []);
        subMap.get(key)!.push(m);
      }
      const group2Keys = sortKeys(group2, Array.from(subMap.keys()));
      const subsections = group2Keys.map((g2Key) => ({
        group2Key: g2Key,
        group2Label: getLabel(group2, g2Key),
        members: subMap.get(g2Key) ?? [],
      }));
      return { group1Key: g1Key, group1Label: getLabel(group1, g1Key), subsections };
    });
  }, [sortedMembers, group1, group2, districtMap, groupMap, dispatchMap]);
  const toggleSectionOpen = (key: string) => setSectionOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  const isSectionOpen = (key: string) => sectionOpen[key] ?? true;

  const { historyRecords, weekRangeLabel } = useMemo(() => {
    const year = initialYear;
    const weeks = getSundayWeeksInYear(year);
    const currentWeek = weeks.find((w) => formatDateYmd(w.weekStart) === weekStartIso);
    const weekRangeLabel = currentWeek
      ? `${format(currentWeek.weekStart, "yyyy/M/d", { locale: ja })}〜${format(currentWeek.weekEnd, "M/d", { locale: ja })}`
      : weekStartIso;
    const list = Array.from(dispatchMap.entries()).map(([memberId, record]) => ({
      member: roster.find((m) => m.id === memberId) ?? {
        id: memberId,
        name: "",
        furigana: null,
        district_id: null,
        group_id: null,
        age_group: null,
        is_baptized: false,
      },
      memberId,
      record,
    }));
    list.sort((a, b) => {
      const da = a.record.dispatch_date ?? a.record.week_start;
      const db = b.record.dispatch_date ?? b.record.week_start;
      const cmp = da.localeCompare(db);
      if (cmp !== 0) return cmp;
      const nameA = a.member.name || a.memberId;
      const nameB = b.member.name || b.memberId;
      return nameA.localeCompare(nameB);
    });
    return { historyRecords: list, weekRangeLabel };
  }, [roster, dispatchMap, weekStartIso, initialYear]);

  const syncOne = useCallback(
    async (
      memberId: string,
      overrides?: { type?: "" | DispatchType; date?: string; memo?: string; visitors?: string[] }
    ) => {
      if (!groupId || !weekStartIso) return;
      const effectiveGroupId = groupId === "__all__" ? roster.find((m) => m.id === memberId)?.group_id : groupId;
      if (!effectiveGroupId) return;
      setSaveError(null);
      const type = ((overrides?.type !== undefined ? overrides.type : localType.get(memberId)) ?? "") as DispatchType | "";
      const date = (overrides?.date !== undefined ? overrides.date : localDate.get(memberId) ?? "").trim();
      const memo = (overrides?.memo !== undefined ? overrides.memo : localMemo.get(memberId) ?? "").trim();
      const visitorIds = overrides?.visitors !== undefined ? overrides.visitors : (localVisitors.get(memberId) ?? []);
      const visitorIdsNormalized = visitorIds.map((id) => String(id)).filter(Boolean);
      const allFilled = type !== "" && date !== "" && memo !== "";
      const supabase = createClient();
      const existing = dispatchMap.get(memberId);

      if (allFilled) {
        const payload = {
          dispatch_type: type as DispatchType,
          dispatch_date: date,
          dispatch_memo: memo,
          visitor_ids: visitorIdsNormalized,
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
          setDispatchMap((prev) => {
            const next = new Map(prev);
            const r = next.get(memberId);
            if (r) next.set(memberId, { ...r, visitor_ids: visitorIdsNormalized });
            return next;
          });
        } else {
          const { data: inserted, error } = await supabase
            .from("organic_dispatch_records")
            .insert({
              member_id: memberId,
              group_id: effectiveGroupId,
              week_start: weekStartIso,
              ...payload,
            })
            .select("id, member_id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo, visitor_ids")
            .single();
          if (error) {
            const isRls = /row-level security|RLS/i.test(error.message ?? "");
            setSaveError(isRls ? "保存する権限がありません。報告者以上のロールが必要です。" : `保存に失敗しました: ${error.message}`);
            return;
          }
          if (inserted) {
            setDispatchMap((prev) => new Map(prev).set(memberId, { ...(inserted as DispatchRow), visitor_ids: visitorIdsNormalized }));
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
    [groupId, weekStartIso, dispatchMap, roster, localType, localDate, localMemo, localVisitors]
  );

  const openRecordPopup = (memberId: string) => {
    setRecordPopupMemberId(memberId);
    setPopupForm({
      type: (localType.get(memberId) ?? "") as "" | DispatchType,
      date: localDate.get(memberId) ?? "",
      memo: localMemo.get(memberId) ?? "",
      visitors: localVisitors.get(memberId) ?? [],
    });
    setPopupVisitorSearchQuery("");
    setPopupVisitorSearchResults([]);
  };

  const closeRecordPopup = () => {
    setRecordPopupMemberId(null);
    setPopupForm(null);
    setPopupVisitorSearchQuery("");
    setPopupVisitorSearchResults([]);
  };

  const saveRecordFromPopup = () => {
    if (!recordPopupMemberId || !popupForm) return;
    const { type, date, memo, visitors } = popupForm;
    const allFilled = type !== "" && date.trim() !== "" && memo.trim() !== "";
    if (!allFilled) {
      setSaveError("派遣種類・派遣日・メモの3項目をすべて入力してください。");
      return;
    }
    setSaveError(null);
    setLocalType((prev) => new Map(prev).set(recordPopupMemberId, type));
    setLocalDate((prev) => new Map(prev).set(recordPopupMemberId, date.trim()));
    setLocalMemo((prev) => new Map(prev).set(recordPopupMemberId, memo.trim()));
    setLocalVisitors((prev) => new Map(prev).set(recordPopupMemberId, visitors));
    syncOne(recordPopupMemberId, { visitors });
    closeRecordPopup();
  };

  const deleteRecordFromPopup = () => {
    if (!recordPopupMemberId) return;
    const existing = dispatchMap.get(recordPopupMemberId);
    if (!existing) {
      closeRecordPopup();
      return;
    }
    const memberIdToClear = recordPopupMemberId;
    setSaveError(null);
    const supabase = createClient();
    supabase.from("organic_dispatch_records").delete().eq("id", existing.id).then(({ error }) => {
      if (error) {
        setSaveError(/row-level security|RLS/i.test(error.message ?? "") ? "削除する権限がありません。" : `削除に失敗しました: ${error.message}`);
        return;
      }
      setDispatchMap((prev) => {
        const next = new Map(prev);
        next.delete(memberIdToClear);
        return next;
      });
      setLocalType((prev) => {
        const next = new Map(prev);
        next.delete(memberIdToClear);
        return next;
      });
      setLocalDate((prev) => {
        const next = new Map(prev);
        next.delete(memberIdToClear);
        return next;
      });
      setLocalMemo((prev) => {
        const next = new Map(prev);
        next.delete(memberIdToClear);
        return next;
      });
      setLocalVisitors((prev) => {
        const next = new Map(prev);
        next.delete(memberIdToClear);
        return next;
      });
      closeRecordPopup();
    });
  };

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
              <span>表示設定（フリー検索・並べ順・グルーピング）</span>
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
                      onChange={(e) => {
                        const v = e.target.value as GroupOption | "";
                        setGroup1(v);
                        if (v === group2) setGroup2("");
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                    >
                      <option value="">なし</option>
                      {(Object.keys(GROUP_LABELS) as GroupOption[]).map((k) => (
                        <option key={k} value={k}>{GROUP_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  {group1 && (
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
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <h2 className="font-semibold text-slate-800 mb-3">派遣履歴</h2>
            <p className="text-xs text-slate-500 mb-2">
              表示週: {weekRangeLabel}（上記の週セレクターで変更できます）
            </p>
            {historyRecords.length > 0 ? (
              <ul className="space-y-3">
                {historyRecords.map(({ member, memberId, record }) => (
                      <li
                        key={record.id}
                        className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <button
                            type="button"
                            onClick={() => openRecordPopup(memberId)}
                            className="inline-flex shrink-0 items-center justify-center rounded h-4 w-4 text-slate-500 hover:bg-slate-200 hover:text-slate-700 touch-target"
                            aria-label="編集"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                            </svg>
                          </button>
                          <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {record.dispatch_date
                              ? format(parseISO(record.dispatch_date), "yyyy/M/d")
                              : format(parseISO(record.week_start), "yyyy/M/d") + "（週）"}
                          </span>
                          <span className="font-medium text-slate-800">
                            {member.name || memberIdToName.get(memberId) || "—"}
                          </span>
                          <span className="text-slate-500">
                            {groupMap.get(record.group_id) ?? record.group_id}
                          </span>
                          {record.dispatch_type && (
                            <span className="text-primary-600">
                              {DISPATCH_TYPE_LABELS[record.dispatch_type]}
                            </span>
                          )}
                        </div>
                        {record.dispatch_memo && record.dispatch_memo.trim() !== "" && (
                          <p className="mt-1.5 text-slate-600 whitespace-pre-wrap">
                            {record.dispatch_memo.trim()}
                          </p>
                        )}
                        {(record.visitor_ids ?? []).length > 0 && (
                          <p className="mt-1.5 text-slate-600 text-xs">
                            訪問者: {(record.visitor_ids ?? []).map((vid) => memberIdToName.get(String(vid)) ?? String(vid)).join("、")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
            ) : (
              <p className="text-sm text-slate-500">記録がありません。別の週を選ぶと表示される場合があります。</p>
            )}
          </div>

          <p className="text-slate-600 text-sm mb-2">
            「記録する」をクリックしてポップアップで派遣種類・訪問者・派遣日・メモを入力し、保存してください。
          </p>
          {loading ? (
            <p className="text-slate-500 text-sm">読み込み中…</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">記録する</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-center text-slate-500 text-sm">
                        名簿がありません
                      </td>
                    </tr>
                  )}
                  {sections.map((section, idx) => {
                    const hasGroup1 = Boolean(group1 && section.group1Key);
                    const hasGroup2 = Boolean(group2);
                    const g1Key = `g1-${section.group1Key}`;
                    const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
                    return (
                    <Fragment key={`s-${section.group1Key}-${idx}`}>
                      {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                        <tr className="bg-slate-100">
                          <td colSpan={2} className="px-3 py-0">
                            <button
                              type="button"
                              onClick={() => toggleSectionOpen(g1Key)}
                              className="w-full flex items-center justify-between px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-200/70 touch-target"
                              aria-expanded={g1Open}
                            >
                              <span>{group1 ? `${GROUP_LABELS[group1]}：${section.group1Label || "—"}` : ""}</span>
                              <svg
                                className={`w-4 h-4 text-slate-500 transition-transform ${g1Open ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )}
                      {(hasGroup1 ? g1Open : true) && section.subsections.map((sub, subIdx) => {
                        const hasSubHeader = hasGroup2 && sub.group2Key;
                        const g2Key = hasSubHeader ? `g1-${section.group1Key}::g2-${sub.group2Key}` : "";
                        const g2Open = g2Key ? isSectionOpen(g2Key) : true;
                        return (
                          <Fragment key={`sub-${section.group1Key}-${sub.group2Key}-${subIdx}`}>
                            {hasSubHeader && sub.members.length > 0 && (
                              <tr className="bg-slate-50">
                                <td colSpan={2} className="px-3 py-0 pl-6">
                                  <button
                                    type="button"
                                    onClick={() => toggleSectionOpen(g2Key)}
                                    className="w-full flex items-center justify-between px-3 py-1 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 touch-target"
                                    aria-expanded={g2Open}
                                  >
                                    <span>{group2 ? `${GROUP_LABELS[group2]}：${sub.group2Label || "—"}` : ""}</span>
                                    <svg
                                      className={`w-4 h-4 text-slate-500 transition-transform ${g2Open ? "rotate-180" : ""}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            )}
                            {(!hasSubHeader || g2Open) && sub.members.map((m) => {
                    const hasRecord = dispatchMap.has(m.id);
                    return (
                    <tr
                      key={m.id}
                      className={hasRecord ? "bg-primary-50/70 hover:bg-primary-100/70 border-l-2 border-l-primary-500" : "hover:bg-slate-50"}
                    >
                      <td className="px-3 py-1.5 text-slate-800">{m.name}</td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => openRecordPopup(m.id)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 touch-target"
                        >
                          {hasRecord ? "編集" : "記録する"}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {recordPopupMemberId && popupForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="organic-record-popup-title"
          onClick={() => closeRecordPopup()}
        >
          <div
            className="w-full max-w-md bg-white rounded-lg shadow-lg p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="organic-record-popup-title" className="text-sm font-semibold text-slate-800 mb-4">
              派遣を記録 — {roster.find((r) => r.id === recordPopupMemberId)?.name ?? ""}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">派遣種類</label>
                <select
                  value={popupForm.type}
                  onChange={(e) => setPopupForm((prev) => prev && { ...prev, type: (e.target.value || "") as "" | DispatchType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                >
                  {DISPATCH_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">訪問者</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {popupForm.visitors.map((vid) => (
                    <span
                      key={vid}
                      className="inline-flex items-center gap-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-800"
                    >
                      {memberIdToName.get(vid) ?? vid}
                      <button
                        type="button"
                        onClick={() => setPopupForm((prev) => prev && { ...prev, visitors: prev.visitors.filter((id) => id !== vid) })}
                        className="ml-0.5 rounded p-0.5 hover:bg-slate-300 touch-target"
                        aria-label={`${memberIdToName.get(vid) ?? vid}を削除`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={popupVisitorSearchQuery}
                    onChange={(e) => setPopupVisitorSearchQuery(e.target.value)}
                    placeholder="名前で検索して追加"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg touch-target"
                  />
                  {popupVisitorSearchResults.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-0.5">
                      {popupVisitorSearchResults
                        .filter((vm) => vm.id !== recordPopupMemberId && !popupForm.visitors.includes(vm.id))
                        .map((vm) => (
                          <li key={vm.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPopupForm((prev) => prev && { ...prev, visitors: [...prev.visitors, vm.id] });
                                setMemberIdToName((p) => new Map(p).set(vm.id, vm.name));
                                setPopupVisitorSearchQuery("");
                                setPopupVisitorSearchResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 touch-target"
                            >
                              {vm.name}
                              {vm.furigana && <span className="ml-1 text-slate-500 text-xs">{vm.furigana}</span>}
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">派遣日</label>
                <select
                  value={popupForm.date}
                  onChange={(e) => setPopupForm((prev) => prev && { ...prev, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                >
                  <option value="">—</option>
                  {getDaysInWeek(weekStartIso).map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">メモ</label>
                <textarea
                  value={popupForm.memo}
                  onChange={(e) => setPopupForm((prev) => prev && { ...prev, memo: e.target.value })}
                  placeholder="メモ"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg touch-target resize-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <button
                type="button"
                onClick={closeRecordPopup}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 touch-target"
              >
                キャンセル
              </button>
              {dispatchMap.has(recordPopupMemberId) && (
                <button
                  type="button"
                  onClick={deleteRecordFromPopup}
                  className="px-4 py-2 text-sm border border-red-300 rounded-lg text-red-700 hover:bg-red-50 touch-target"
                >
                  削除
                </button>
              )}
              <button
                type="button"
                onClick={saveRecordFromPopup}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 touch-target"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
