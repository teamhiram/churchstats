"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
type WeekOption = { value: string; label: string };
/** 小組集会は地区順を省く */
type SortOption = "furigana" | "group" | "age_group";
type GroupOption = "district" | "group" | "age_group" | "believer";

const SORT_LABELS: Record<SortOption, string> = {
  furigana: "フリガナ順",
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

type AttendanceRow = {
  id: string;
  member_id: string;
  memo: string | null;
  attended?: boolean;
};

type Props = {
  districts: District[];
  defaultDistrictId: string;
  initialYear: number;
  initialWeekStartIso: string;
  weekOptions: WeekOption[];
};

export function SmallGroupAttendance({
  districts,
  defaultDistrictId,
  initialYear,
  initialWeekStartIso,
  weekOptions,
}: Props) {
  const districtId = defaultDistrictId ?? "";
  const weekStartIso = initialWeekStartIso;
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<string>("");
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
  const [memos, setMemos] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOption>("furigana");
  const [group1, setGroup1] = useState<GroupOption | "">("");
  const [accordionOpen, setAccordionOpen] = useState(false);

  const districtMap = useMemo(() => new Map(districts.map((d) => [d.id, d.name])), [districts]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  useEffect(() => {
    if (!districtId) {
      setGroups([]);
      setGroupId("");
      return;
    }
    const supabase = createClient();
    const isAllDistricts = districtId === "__all__";
    const query = supabase
      .from("groups")
      .select("id, name, district_id")
      .order("name");
    (isAllDistricts ? query : query.eq("district_id", districtId)).then(({ data }) => {
      const list = data ?? [];
      setGroups(list);
      setGroupId((prev) => {
        const stillValid = list.some((g) => g.id === prev) || prev === "__all__";
        return stillValid ? prev : (isAllDistricts ? "__all__" : (list[0]?.id ?? ""));
      });
    });
  }, [districtId]);

  const ensureGroupMeetingRecord = useCallback(
    async (initialEventDate?: string | null) => {
      if (!groupId || !weekStartIso || groupId === "__all__") return null;
      return ensureGroupMeetingRecordForGroup(groupId, initialEventDate);
    },
    [groupId, weekStartIso]
  );

  const ensureGroupMeetingRecordForGroup = useCallback(
    async (gid: string, initialEventDate?: string | null) => {
      if (!gid || !weekStartIso) return null;
      const supabase = createClient();
      let group = groups.find((g) => g.id === gid);
      if (!group) {
        const { data: g } = await supabase.from("groups").select("id, name, district_id").eq("id", gid).maybeSingle();
        group = g ?? undefined;
      }
      const name = group?.name ?? "小組集会";
      const { data: existing } = await supabase
        .from("group_meeting_records")
        .select("id")
        .eq("group_id", gid)
        .eq("week_start", weekStartIso)
        .maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await supabase
        .from("group_meeting_records")
        .insert({
          group_id: gid,
          week_start: weekStartIso,
          event_date: initialEventDate ?? null,
          name: name || null,
        })
        .select("id")
        .single();
      if (error) return null;
      return created?.id ?? null;
    },
    [weekStartIso, groups]
  );

  useEffect(() => {
    if (!groupId || !weekStartIso) {
      setRecordId(null);
      setEventDate("");
      setRoster([]);
      setAttendanceMap(new Map());
      setMemos(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    const isAllGroups = groupId === "__all__";
    const groupIds = isAllGroups ? groups.map((g) => g.id) : [groupId];

    if (isAllGroups) {
      if (groupIds.length === 0) {
        setRecordId(null);
        setEventDate("");
        setRoster([]);
        setAttendanceMap(new Map());
        setMemos(new Map());
        setLoading(false);
        return;
      }
      (async () => {
        const { data: recordsData } = await supabase
          .from("group_meeting_records")
          .select("id, event_date")
          .in("group_id", groupIds)
          .eq("week_start", weekStartIso);
        if (cancelled) return;
        const recordIds = (recordsData ?? []).map((r) => r.id);

        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
          .in("group_id", groupIds)
          .order("name");
        if (cancelled) return;
        const districtMembers = (membersData ?? []) as MemberRow[];

        if (recordIds.length === 0) {
          setRecordId(null);
          setEventDate("");
          setRoster(districtMembers);
          setAttendanceMap(new Map());
          setMemos(new Map());
          setLoading(false);
          return;
        }

        const { data: attData } = await supabase
          .from("group_meeting_attendance")
          .select("id, member_id, memo, attended")
          .in("group_meeting_record_id", recordIds);
        if (cancelled) return;
        const records = (attData ?? []) as AttendanceRow[];
        const map = new Map<string, AttendanceRow>();
        const memoMap = new Map<string, string>();
        records.forEach((r) => {
          map.set(r.member_id, { ...r, attended: r.attended === false ? false : true });
          memoMap.set(r.member_id, r.memo ?? "");
        });
        const districtMemberIds = new Set(districtMembers.map((m) => m.id));
        const guestIds = records.map((r) => r.member_id).filter((id) => !districtMemberIds.has(id));
        let guests: MemberRow[] = [];
        if (guestIds.length > 0) {
          const { data: guestData } = await supabase
            .from("members")
            .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
            .in("id", guestIds);
          guests = (guestData ?? []) as MemberRow[];
        }
        setRecordId(null);
        setEventDate("");
        setRoster([...districtMembers, ...guests]);
        setAttendanceMap(map);
        setMemos(memoMap);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }

    supabase
      .from("group_meeting_records")
      .select("id, event_date")
      .eq("group_id", groupId)
      .eq("week_start", weekStartIso)
      .maybeSingle()
      .then(({ data: existingRecord }) => {
        if (cancelled) return;
        const rid = existingRecord?.id ?? null;
        const evDate = (existingRecord as { id: string; event_date?: string | null } | null)?.event_date ?? "";
        setRecordId(rid);
        setEventDate(evDate ?? "");
        return supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
          .eq("group_id", groupId)
          .order("name")
          .then((membersRes) => {
            if (cancelled) return;
            const districtMembers = (membersRes.data ?? []) as MemberRow[];
            if (!rid) {
              setRoster(districtMembers);
              setAttendanceMap(new Map());
              setMemos(new Map());
              setEventDate("");
              setLoading(false);
              return;
            }
            return supabase
              .from("group_meeting_attendance")
              .select("id, member_id, memo, attended")
              .eq("group_meeting_record_id", rid)
              .then(async (attRes) => {
                if (cancelled) return;
                const records = (attRes.data ?? []) as AttendanceRow[];
                const map = new Map<string, AttendanceRow>();
                const memoMap = new Map<string, string>();
                records.forEach((r) => {
                  map.set(r.member_id, { ...r, attended: r.attended === false ? false : true });
                  memoMap.set(r.member_id, r.memo ?? "");
                });
                const districtIdsSet = new Set(districtMembers.map((m) => m.id));
                const guestIds = records.map((r) => r.member_id).filter((id) => !districtIdsSet.has(id));
                let guests: MemberRow[] = [];
                if (guestIds.length > 0) {
                  const { data: guestData } = await supabase
                    .from("members")
                    .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
                    .in("id", guestIds);
                  guests = (guestData ?? []) as MemberRow[];
                }
                setRoster([...districtMembers, ...guests]);
                setAttendanceMap(map);
                setMemos(memoMap);
                setLoading(false);
              });
          });
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

  const addFromSearch = async (member: MemberRow) => {
    const gid = member.group_id ?? groupId;
    if (groupId === "__all__" && !gid) return;
    const rid = await ensureGroupMeetingRecordForGroup(gid);
    if (!rid) {
      setMessage("集会の登録に失敗しました。");
      return;
    }
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("group_meeting_attendance").insert({
      group_meeting_record_id: rid,
      member_id: member.id,
      memo: null,
      reported_by_user_id: user?.id ?? null,
    });
    if (error) {
      if (error.code === "23505") setMessage("この方はすでに登録済みです。");
      else setMessage(error.message);
      return;
    }
    setRoster((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
    const { data: rec } = await supabase
      .from("group_meeting_attendance")
      .select("id, member_id, memo, attended")
      .eq("group_meeting_record_id", rid)
      .eq("member_id", member.id)
      .single();
    if (rec) {
      setAttendanceMap((prev) => new Map(prev).set(member.id, rec as AttendanceRow));
      setMemos((prev) => new Map(prev).set(member.id, ""));
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const sortedMembers = useMemo(() => {
    const list = [...roster];
    const collator = new Intl.Collator("ja");
    const byFurigana = (a: MemberRow, b: MemberRow) =>
      collator.compare((a.furigana ?? a.name), (b.furigana ?? b.name));
    const byName = (a: MemberRow, b: MemberRow) => collator.compare(a.name, b.name);
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
    else if (sortOrder === "group") list.sort(byGroup);
    else list.sort(byAgeGroup);
    return list;
  }, [roster, sortOrder, groupMap]);

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
  const sections = useMemo((): Section[] => {
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
  }, [sortedMembers, group1, districtMap, groupMap]);

  const toggleAttendance = async (memberId: string, member: MemberRow) => {
    setMessage("");
    const supabase = createClient();
    const rec = attendanceMap.get(memberId);
    const memoVal = (memos.get(memberId) ?? "").trim();
    const isCurrentlyOn = Boolean(rec && rec.attended !== false);
    if (rec) {
      if (isCurrentlyOn) {
        await supabase
          .from("group_meeting_attendance")
          .update({ attended: false, memo: memoVal || null })
          .eq("id", rec.id);
        setAttendanceMap((prev) =>
          new Map(prev).set(memberId, { ...rec, attended: false, memo: memoVal || null })
        );
      } else {
        await supabase.from("group_meeting_attendance").update({ attended: true }).eq("id", rec.id);
        setAttendanceMap((prev) => {
          const next = new Map(prev);
          const r = next.get(memberId);
          if (r) next.set(memberId, { ...r, attended: true });
          return next;
        });
      }
    } else {
      const isAllGroups = groupId === "__all__";
      let rid = isAllGroups ? null : recordId;
      if (!rid) {
        rid = isAllGroups
          ? await ensureGroupMeetingRecordForGroup(member.group_id ?? "")
          : await ensureGroupMeetingRecord();
        if (!rid) {
          setMessage("集会の登録に失敗しました。");
          return;
        }
        if (!isAllGroups) setRecordId(rid);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("group_meeting_attendance")
        .insert({
          group_meeting_record_id: rid,
          member_id: memberId,
          memo: null,
          attended: true,
          reported_by_user_id: user?.id ?? null,
        })
        .select("id, member_id, memo, attended")
        .single();
      if (error) {
        if (error.code === "23505") setMessage("この方はすでに登録済みです。");
        else setMessage(error.message);
        return;
      }
      setAttendanceMap((prev) => new Map(prev).set(memberId, { id: inserted.id, member_id: memberId, memo: null, attended: inserted.attended ?? true }));
      setMemos((prev) => new Map(prev).set(memberId, ""));
      setRoster((prev) => (prev.some((m) => m.id === memberId) ? prev : [...prev, member]));
    }
  };

  const saveMemo = async (memberId: string) => {
    const memo = (memos.get(memberId) ?? "").trim();
    const rec = attendanceMap.get(memberId);
    const supabase = createClient();
    if (rec) {
      await supabase.from("group_meeting_attendance").update({ memo: memo || null }).eq("id", rec.id);
    }
  };

  const onEventDateChange = async (value: string) => {
    setEventDate(value);
    const supabase = createClient();
    if (recordId) {
      await supabase
        .from("group_meeting_records")
        .update({ event_date: value || null, updated_at: new Date().toISOString() })
        .eq("id", recordId);
    } else if (value) {
      const rid = await ensureGroupMeetingRecord(value);
      if (rid) setRecordId(rid);
    }
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
            <option value="">選択</option>
            {districtId === "__all__" && groups.length > 0 && (
              <option value="__all__">すべての小組</option>
            )}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {groupId && !loading && groupId !== "__all__" && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">実施日</label>
            <select
              value={eventDate}
              onChange={(e) => onEventDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
            >
              <option value="">—</option>
              {getDaysInWeek(weekStartIso).map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-0.5">選択した週の範囲内の日付のみ選択できます</p>
          </div>
        </div>
      )}

      {groupId && (
        <>
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
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
                    placeholder="名前で検索（他小組も可）"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                  />
                  {searchResults.length > 0 && (
                    <ul className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-lg max-h-60 overflow-auto">
                      {searchResults
                        .filter((m) => !attendanceMap.has(m.id))
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
                </div>
              </div>
            )}
          </div>
          {message && <p className="text-sm text-amber-600">{message}</p>}
          {groupId === "__all__" && (
            <p className="text-slate-600 text-sm">すべての小組を表示しています。出欠の登録・変更は小組を選択してから行ってください。</p>
          )}

          <div>
            {loading ? (
              <p className="text-slate-500 text-sm">読み込み中…</p>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">メモ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-500 text-sm">
                          名簿がありません
                        </td>
                      </tr>
                    )}
                    {sections.map((section, idx) => (
                      <Fragment key={`s-${section.group1Key}-${idx}`}>
                        {group1 && section.members.length > 0 && (
                          <tr className="bg-slate-100">
                            <td colSpan={3} className="px-3 py-1 text-sm font-medium text-slate-700">
                              {GROUP_LABELS[group1]}：{section.group1Label || "—"}
                            </td>
                          </tr>
                        )}
                        {section.members.map((m) => {
                    const recRow = attendanceMap.get(m.id);
                    const attended = Boolean(recRow && recRow.attended !== false);
                    const memo = memos.get(m.id) ?? "";
                    const isAllGroups = groupId === "__all__";
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-800">{m.name}</td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={attended}
                            disabled={isAllGroups}
                            onClick={() => toggleAttendance(m.id, m)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                              isAllGroups ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                            } ${attended ? "bg-primary-600" : "bg-slate-200"}`}
                          >
                            <span
                              className={`pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
                                attended ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={memo}
                            readOnly={isAllGroups}
                            onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                            onBlur={() => saveMemo(m.id)}
                            placeholder="欠席理由など"
                            className={`w-full max-w-xs px-2 py-0.5 text-sm border border-slate-300 rounded touch-target ${
                              isAllGroups ? "bg-slate-100 cursor-not-allowed" : ""
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                        </Fragment>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}
