"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { formatDateYmd } from "@/lib/weekUtils";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
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
};

type Props = {
  districts: District[];
  groups: Group[];
  defaultDistrictId: string;
  initialSundayIso: string;
};

export function SundayAttendance({
  districts,
  groups,
  defaultDistrictId,
  initialSundayIso,
}: Props) {
  const router = useRouter();
  const districtId = defaultDistrictId || (districts[0]?.id ?? "");
  const sundayIso = initialSundayIso;
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
  const [memos, setMemos] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
  const [message, setMessage] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOption>("furigana");
  const [group1, setGroup1] = useState<GroupOption | "">("");

  const districtMap = useMemo(() => new Map(districts.map((d) => [d.id, d.name])), [districts]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const ensureMeetingForDistrict = useCallback(async (did: string) => {
    if (!did || !sundayIso) return null;
    const supabase = createClient();
    const district = districts.find((d) => d.id === did);
    const name = district ? `${district.name}地区集会` : "";
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("event_date", sundayIso)
      .eq("meeting_type", "main")
      .eq("district_id", did)
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("meetings")
      .insert({
        event_date: sundayIso,
        meeting_type: "main",
        district_id: did,
        name: name || "主日集会",
      })
      .select("id")
      .single();
    if (error) return null;
    return created?.id ?? null;
  }, [sundayIso, districts]);

  const ensureMeeting = useCallback(async () => {
    if (!districtId || !sundayIso || districtId === "__all__") return null;
    return ensureMeetingForDistrict(districtId);
  }, [districtId, sundayIso, ensureMeetingForDistrict]);

  useEffect(() => {
    if (!districtId || !sundayIso) {
      setMeetingId(null);
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
        setMeetingId(null);
        setRoster([]);
        setAttendanceMap(new Map());
        setMemos(new Map());
        setLoading(false);
        return;
      }
      (async () => {
        const meetingIds: string[] = [];
        for (const did of districtIdsToLoad) {
          const mid = await ensureMeetingForDistrict(did);
          if (mid) meetingIds.push(mid);
        }
        if (cancelled) return;
        setMeetingId(null);

        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
          .in("district_id", districtIdsToLoad)
          .order("name");
        if (cancelled) return;
        const districtMembers = (membersData ?? []) as MemberRow[];

        if (meetingIds.length === 0) {
          setRoster(districtMembers);
          setAttendanceMap(new Map());
          setMemos(new Map());
          setLoading(false);
          return;
        }

        const { data: attData } = await supabase
          .from("attendance_records")
          .select("id, member_id, memo, is_online, is_away")
          .in("meeting_id", meetingIds);
        if (cancelled) return;
        const records = (attData ?? []) as AttendanceRow[];
        const map = new Map<string, AttendanceRow>();
        const memoMap = new Map<string, string>();
        records.forEach((r) => {
          map.set(r.member_id, r);
          memoMap.set(r.member_id, r.memo ?? "");
        });
        const rosterMemberIds = new Set(districtMembers.map((m) => m.id));
        const guestIds = records.map((r) => r.member_id).filter((id) => !rosterMemberIds.has(id));
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
    })();
      return () => {
        cancelled = true;
      };
    }

    supabase
      .from("meetings")
      .select("id")
      .eq("event_date", sundayIso)
      .eq("meeting_type", "main")
      .eq("district_id", districtId)
      .maybeSingle()
      .then(({ data: existingMeeting }) => {
        if (cancelled) return;
        const mid = existingMeeting?.id ?? null;
        setMeetingId(mid);
        return supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized")
          .eq("district_id", districtId)
          .order("name")
          .then((membersRes) => {
            if (cancelled) return;
            const districtMembers = (membersRes.data ?? []) as MemberRow[];
            if (!mid) {
              setRoster(districtMembers);
              setAttendanceMap(new Map());
              setMemos(new Map());
              setLoading(false);
              return;
            }
            return supabase
              .from("attendance_records")
              .select("id, member_id, memo, is_online, is_away")
              .eq("meeting_id", mid)
              .then(async (attRes) => {
                if (cancelled) return;
                const records = (attRes.data ?? []) as AttendanceRow[];
                const map = new Map<string, AttendanceRow>();
                const memoMap = new Map<string, string>();
                records.forEach((r) => {
                  map.set(r.member_id, r);
                  memoMap.set(r.member_id, r.memo ?? "");
                });
                const districtIds = new Set(districtMembers.map((m) => m.id));
                const guestIds = records.map((r) => r.member_id).filter((id) => !districtIds.has(id));
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
  }, [districtId, sundayIso, districts, ensureMeetingForDistrict]);

  const toggleAttendance = async (memberId: string, member: MemberRow) => {
    setMessage("");
    const supabase = createClient();
    const rec = attendanceMap.get(memberId);
    if (rec) {
      await supabase.from("attendance_records").delete().eq("id", rec.id);
      setAttendanceMap((prev) => {
        const next = new Map(prev);
        next.delete(memberId);
        return next;
      });
      setMemos((prev) => {
        const next = new Map(prev);
        next.delete(memberId);
        return next;
      });
    } else {
      const isAll = districtId === "__all__";
      let mid = isAll ? null : meetingId;
      if (!mid) {
        mid = isAll
          ? await ensureMeetingForDistrict(member.district_id ?? "")
          : await ensureMeeting();
        if (!mid) {
          setMessage("集会の登録に失敗しました。");
          return;
        }
        if (!isAll) setMeetingId(mid);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("attendance_records")
        .insert({
          meeting_id: mid,
          member_id: memberId,
          recorded_category: member.age_group,
          recorded_is_baptized: Boolean(member.is_baptized),
          district_id: member.district_id,
          group_id: member.group_id,
          memo: null,
          is_online: false,
          is_away: false,
          reported_by_user_id: user?.id ?? null,
        })
        .select("id, member_id, memo, is_online, is_away")
        .single();
      if (error) {
        if (error.code === "23505") setMessage("この方はすでに登録済みです。");
        else setMessage(error.message);
        return;
      }
      setAttendanceMap((prev) => new Map(prev).set(memberId, { id: inserted.id, member_id: memberId, memo: null, is_online: inserted.is_online ?? false, is_away: inserted.is_away ?? false }));
      setMemos((prev) => new Map(prev).set(memberId, ""));
      setRoster((prev) => (prev.some((m) => m.id === memberId) ? prev : [...prev, member]));
    }
    router.refresh();
  };

  const saveMemo = async (memberId: string) => {
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const memo = memos.get(memberId) ?? "";
    const supabase = createClient();
    await supabase.from("attendance_records").update({ memo: memo || null }).eq("id", rec.id);
    router.refresh();
  };

  const toggleOnline = async (memberId: string) => {
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const next = !(rec.is_online ?? false);
    const supabase = createClient();
    await supabase.from("attendance_records").update({ is_online: next }).eq("id", rec.id);
    setAttendanceMap((prev) => {
      const nextMap = new Map(prev);
      const r = nextMap.get(memberId);
      if (r) nextMap.set(memberId, { ...r, is_online: next });
      return nextMap;
    });
    router.refresh();
  };

  const toggleIsAway = async (memberId: string) => {
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const next = !(rec.is_away ?? false);
    const supabase = createClient();
    await supabase.from("attendance_records").update({ is_away: next }).eq("id", rec.id);
    setAttendanceMap((prev) => {
      const nextMap = new Map(prev);
      const r = nextMap.get(memberId);
      if (r) nextMap.set(memberId, { ...r, is_away: next });
      return nextMap;
    });
    router.refresh();
  };

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
    const isAll = districtId === "__all__";
    const mid = isAll
      ? await ensureMeetingForDistrict(member.district_id ?? "")
      : meetingId;
    if (!mid) {
      setMessage("集会の登録に失敗しました。");
      return;
    }
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("attendance_records").insert({
      meeting_id: mid,
      member_id: member.id,
      recorded_category: member.age_group,
      recorded_is_baptized: Boolean(member.is_baptized),
      district_id: member.district_id,
      group_id: member.group_id,
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
      .from("attendance_records")
      .select("id, member_id, memo, is_online, is_away")
      .eq("meeting_id", mid)
      .eq("member_id", member.id)
      .single();
    if (rec) {
      setAttendanceMap((prev) => new Map(prev).set(member.id, rec as AttendanceRow));
      setMemos((prev) => new Map(prev).set(member.id, ""));
    }
    setSearchQuery("");
    setSearchResults([]);
    router.refresh();
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

  return (
    <div className="space-y-4">
      {!districtId ? (
        <p className="text-slate-500 text-sm">地区を選択してください（上記のフィルターで選択）。</p>
      ) : (
      <>
      {districtId && (
        <>
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
          {message && <p className="text-sm text-amber-600">{message}</p>}

          <div>
            <h2 className="font-semibold text-slate-800 mb-2">名簿（出欠・メモ）</h2>
            {loading ? (
              <p className="text-slate-500 text-sm">読み込み中…</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap mb-3">
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
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠（{attendanceMap.size}）</th>
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
                      const attended = attendanceMap.has(m.id);
                      const rec = attendanceMap.get(m.id);
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
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
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
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
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
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
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
              </>
            )}
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
