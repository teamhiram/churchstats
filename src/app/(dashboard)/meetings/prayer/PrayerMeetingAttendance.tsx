"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import { CATEGORY_LABELS } from "@/types/database";
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

type AttendanceRow = {
  id: string;
  member_id: string;
  memo: string | null;
  is_online: boolean | null;
  is_away: boolean | null;
  attended?: boolean;
};

type Props = {
  districts: District[];
  groups: Group[];
  defaultDistrictId: string;
  initialYear: number;
  initialWeekStartIso: string;
  weekOptions: WeekOption[];
};

export function PrayerMeetingAttendance({
  districts,
  groups,
  defaultDistrictId,
  initialYear,
  initialWeekStartIso,
  weekOptions,
}: Props) {
  const districtId = defaultDistrictId ?? "";
  const weekStartIso = initialWeekStartIso;
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

  const ensurePrayerMeetingRecord = useCallback(
    async (initialEventDate?: string | null) => {
      if (!districtId || !weekStartIso || districtId === "__all__") return null;
      return ensurePrayerMeetingRecordForDistrict(districtId, initialEventDate);
    },
    [districtId, weekStartIso]
  );

  const ensurePrayerMeetingRecordForDistrict = useCallback(
    async (did: string, initialEventDate?: string | null) => {
      if (!did || !weekStartIso) return null;
      const supabase = createClient();
      const district = districts.find((d) => d.id === did);
      const name = district ? `${district.name}祈りの集会` : "祈りの集会";
      const { data: existing } = await supabase
        .from("prayer_meeting_records")
        .select("id")
        .eq("district_id", did)
        .eq("week_start", weekStartIso)
        .maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await supabase
        .from("prayer_meeting_records")
        .insert({
          district_id: did,
          week_start: weekStartIso,
          event_date: initialEventDate ?? null,
          name: name || null,
        })
        .select("id")
        .single();
      if (error) return null;
      return created?.id ?? null;
    },
    [weekStartIso, districts]
  );

  useEffect(() => {
    if (!districtId || !weekStartIso) {
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
    const isAllDistricts = districtId === "__all__";

    if (isAllDistricts) {
      const districtIdsToLoad = districts.map((d) => d.id).filter((id) => id !== "__all__");
      if (districtIdsToLoad.length === 0) {
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
          .from("prayer_meeting_records")
          .select("id, event_date")
          .in("district_id", districtIdsToLoad)
          .eq("week_start", weekStartIso);
        if (cancelled) return;
        const recordIds = (recordsData ?? []).map((r) => r.id);

        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
          .in("district_id", districtIdsToLoad)
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
          .from("prayer_meeting_attendance")
          .select("id, member_id, memo, is_online, is_away, attended")
          .in("prayer_meeting_record_id", recordIds);
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
      .from("prayer_meeting_records")
      .select("id, event_date")
      .eq("district_id", districtId)
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
          .eq("district_id", districtId)
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
              .from("prayer_meeting_attendance")
              .select("id, member_id, memo, is_online, is_away, attended")
              .eq("prayer_meeting_record_id", rid)
              .then(async (attRes) => {
                if (cancelled) return;
                const records = (attRes.data ?? []) as AttendanceRow[];
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
  }, [districtId, weekStartIso, districts]);

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
    const did = member.district_id ?? districtId;
    if (districtId === "__all__" && !did) return;
    const rid = await ensurePrayerMeetingRecordForDistrict(did);
    if (!rid) {
      setMessage("集会の登録に失敗しました。");
      return;
    }
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("prayer_meeting_attendance").insert({
      prayer_meeting_record_id: rid,
      member_id: member.id,
      memo: null,
      is_online: false,
      is_away: false,
      reported_by_user_id: user?.id ?? null,
    });
    if (error) {
      if (error.code === "23505") setMessage("この方はすでに登録済みです。");
      else setMessage(error.message);
      return;
    }
    setRoster((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
    const { data: rec } = await supabase
      .from("prayer_meeting_attendance")
      .select("id, member_id, memo, is_online, is_away, attended")
      .eq("prayer_meeting_record_id", rid)
      .eq("member_id", member.id)
      .single();
    if (rec) {
      setAttendanceMap((prev) => new Map(prev).set(member.id, { ...rec, attended: rec.attended ?? true } as AttendanceRow));
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
          .from("prayer_meeting_attendance")
          .update({ attended: false, is_online: false, is_away: false, memo: memoVal || null })
          .eq("id", rec.id);
        setAttendanceMap((prev) =>
          new Map(prev).set(memberId, { ...rec, attended: false, is_online: false, is_away: false, memo: memoVal || null })
        );
      } else {
        await supabase.from("prayer_meeting_attendance").update({ attended: true }).eq("id", rec.id);
        setAttendanceMap((prev) => {
          const next = new Map(prev);
          const r = next.get(memberId);
          if (r) next.set(memberId, { ...r, attended: true });
          return next;
        });
      }
    } else {
      const isAll = districtId === "__all__";
      let rid = isAll ? null : recordId;
      if (!rid) {
        rid = isAll
          ? await ensurePrayerMeetingRecordForDistrict(member.district_id ?? "")
          : await ensurePrayerMeetingRecord();
        if (!rid) {
          setMessage("集会の登録に失敗しました。");
          return;
        }
        if (!isAll) setRecordId(rid);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("prayer_meeting_attendance")
        .insert({
          prayer_meeting_record_id: rid,
          member_id: memberId,
          memo: null,
          is_online: false,
          is_away: false,
          attended: true,
          reported_by_user_id: user?.id ?? null,
        })
        .select("id, member_id, memo, is_online, is_away, attended")
        .single();
      if (error) {
        if (error.code === "23505") setMessage("この方はすでに登録済みです。");
        else setMessage(error.message);
        return;
      }
      setAttendanceMap((prev) => new Map(prev).set(memberId, { id: inserted.id, member_id: memberId, memo: null, is_online: inserted.is_online ?? false, is_away: inserted.is_away ?? false, attended: inserted.attended ?? true }));
      setMemos((prev) => new Map(prev).set(memberId, ""));
      setRoster((prev) => (prev.some((m) => m.id === memberId) ? prev : [...prev, member]));
    }
  };

  const saveMemo = async (memberId: string) => {
    const memo = (memos.get(memberId) ?? "").trim();
    const rec = attendanceMap.get(memberId);
    const supabase = createClient();
    if (rec) {
      await supabase.from("prayer_meeting_attendance").update({ memo: memo || null }).eq("id", rec.id);
    }
  };

  const toggleOnline = async (memberId: string) => {
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const next = !(rec.is_online ?? false);
    const supabase = createClient();
    await supabase.from("prayer_meeting_attendance").update({ is_online: next }).eq("id", rec.id);
    setAttendanceMap((prev) => {
      const nextMap = new Map(prev);
      const r = nextMap.get(memberId);
      if (r) nextMap.set(memberId, { ...r, is_online: next });
      return nextMap;
    });
  };

  const toggleIsAway = async (memberId: string) => {
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const next = !(rec.is_away ?? false);
    const supabase = createClient();
    await supabase.from("prayer_meeting_attendance").update({ is_away: next }).eq("id", rec.id);
    setAttendanceMap((prev) => {
      const nextMap = new Map(prev);
      const r = nextMap.get(memberId);
      if (r) nextMap.set(memberId, { ...r, is_away: next });
      return nextMap;
    });
  };

  const onEventDateChange = async (value: string) => {
    setEventDate(value);
    const supabase = createClient();
    if (recordId) {
      await supabase
        .from("prayer_meeting_records")
        .update({ event_date: value || null, updated_at: new Date().toISOString() })
        .eq("id", recordId);
    } else if (value) {
      const rid = await ensurePrayerMeetingRecord(value);
      if (rid) setRecordId(rid);
    }
  };

  const isAllDistricts = districtId === "__all__";

  return (
    <div className="space-y-4">
      {!districtId ? (
        <p className="text-slate-500 text-sm">地区を選択してください（上記のフィルターで選択）。</p>
      ) : (
        <>
          {districtId && !loading && !isAllDistricts && (
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

          {districtId && (
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
                        placeholder="名前で検索（他地区・他地方も可）"
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
              {isAllDistricts && (
                <p className="text-slate-600 text-sm">全ての地区を表示しています。各メンバーの所属地区の集会として出欠を登録・変更できます。</p>
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
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠（{[...attendanceMap.values()].filter((r) => r.attended !== false).length}）</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">オンライン</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">他地方で出席</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">メモ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {roster.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-500 text-sm">
                              名簿がありません
                            </td>
                          </tr>
                        )}
                        {sections.map((section, idx) => (
                          <Fragment key={`s-${section.group1Key}-${idx}`}>
                            {group1 && section.members.length > 0 && (
                              <tr className="bg-slate-100">
                                <td colSpan={5} className="px-3 py-1 text-sm font-medium text-slate-700">
                                  {GROUP_LABELS[group1]}：{section.group1Label || "—"}
                                </td>
                              </tr>
                            )}
                            {section.members.map((m) => {
                        const rec = attendanceMap.get(m.id);
                        const attended = Boolean(rec && rec.attended !== false);
                        const isOnline = rec?.is_online ?? false;
                        const isAway = rec?.is_away ?? false;
                        const memo = memos.get(m.id) ?? "";
                        const memoPlaceholder = isAway ? "出席した地方を記載してください" : "欠席理由など";
                        return (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 text-slate-800">{m.name}</td>
                            <td className="px-3 py-1.5">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={attended}
                                onClick={() => toggleAttendance(m.id, m)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 cursor-pointer ${
                                  attended ? "bg-primary-600" : "bg-slate-200"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
                                    attended ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-3 py-1.5">
                              {attended ? (
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isOnline}
                                  onClick={() => toggleOnline(m.id)}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 cursor-pointer ${
                                    isOnline ? "bg-primary-600" : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
                                      isOnline ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {attended ? (
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isAway}
                                  onClick={() => toggleIsAway(m.id)}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 cursor-pointer ${
                                    isAway ? "bg-primary-600" : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
                                      isAway ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={memo}
                                onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                                onBlur={() => saveMemo(m.id)}
                                placeholder={memoPlaceholder}
                                className={`w-full max-w-xs px-2 py-0.5 text-sm border rounded touch-target ${
                                  isAway ? "border-amber-400" : "border-slate-300"
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
