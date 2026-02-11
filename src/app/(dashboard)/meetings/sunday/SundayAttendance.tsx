"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { Toggle } from "@/components/Toggle";
import { formatDateYmd } from "@/lib/weekUtils";
import { getGojuonRowLabel, GOJUON_ROW_LABELS } from "@/lib/furigana";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import { ensureSundayMeetingsBatch, getSundayMeetingModes, setSundayMeetingMode, mergeDistrictAttendanceToLocality } from "./actions";
import { isInEnrollmentPeriod } from "@/lib/enrollmentPeriod";
import { removeDistrictRegularMember } from "@/app/(dashboard)/settings/organization/actions";

type District = { id: string; name: string; locality_id?: string };
type Group = { id: string; name: string; district_id: string };
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
  is_local?: boolean;
  local_member_join_date?: string | null;
  local_member_leave_date?: string | null;
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
  initialSundayIso: string;
  sundayDisplay: string;
};

export function SundayAttendance({
  districts,
  groups,
  defaultDistrictId,
  initialSundayIso,
  sundayDisplay,
}: Props) {
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
  const [group2, setGroup2] = useState<GroupOption | "">("");
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [memoPopupMemberId, setMemoPopupMemberId] = useState<string | null>(null);
  const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);
  const [excludedMemberIds, setExcludedMemberIds] = useState<Set<string>>(new Set());
  const [excludedForDeletion, setExcludedForDeletion] = useState<Map<string, string>>(new Map());
  const [regularListExcludePopup, setRegularListExcludePopup] = useState<{ memberId: string; member: MemberRow; districtId: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCombinedPerLocality, setIsCombinedPerLocality] = useState<Record<string, boolean>>({});

  const districtMap = useMemo(() => new Map(districts.map((d) => [d.id, d.name])), [districts]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const localityIdsToFetch = useMemo(() => {
    if (districtId === "__all__") {
      return [...new Set(districts.map((d) => d.locality_id).filter(Boolean))] as string[];
    }
    const d = districts.find((x) => x.id === districtId);
    return d?.locality_id ? [d.locality_id] : [];
  }, [districtId, districts]);

  useEffect(() => {
    if (!sundayIso || localityIdsToFetch.length === 0) {
      setIsCombinedPerLocality((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    getSundayMeetingModes(sundayIso, localityIdsToFetch).then(setIsCombinedPerLocality);
  }, [sundayIso, localityIdsToFetch]);

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
        const meetingIdMap = await ensureSundayMeetingsBatch(sundayIso, districts, isCombinedPerLocality);
        const meetingIds = districtIdsToLoad.map((did) => meetingIdMap[did]).filter(Boolean);
        if (cancelled) return;
        setMeetingId(null);

        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date")
          .in("district_id", districtIdsToLoad)
          .order("name");
        if (cancelled) return;
        const districtMembers = ((membersData ?? []) as MemberRow[]).filter((m) =>
          isInEnrollmentPeriod(m, sundayIso)
        );

        if (meetingIds.length === 0) {
          setRoster(districtMembers);
          setAttendanceMap(new Map());
          setMemos(new Map());
          setLoading(false);
          return;
        }

        const { data: attData } = await supabase
          .from("attendance_records")
          .select("id, member_id, memo, is_online, is_away, attended")
          .in("meeting_id", meetingIds);
        if (cancelled) return;
        const records = (attData ?? []) as AttendanceRow[];
        const map = new Map<string, AttendanceRow>();
        const memoMap = new Map<string, string>();
        records.forEach((r) => {
          map.set(r.member_id, { ...r, attended: r.attended });
          memoMap.set(r.member_id, r.memo ?? "");
        });
        const rosterMemberIds = new Set(districtMembers.map((m) => m.id));
        const guestIds = records.map((r) => r.member_id).filter((id) => !rosterMemberIds.has(id));
        let guests: MemberRow[] = [];
        if (guestIds.length > 0) {
const { data: guestData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date")
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

    const district = districts.find((d) => d.id === districtId);
    const lid = district?.locality_id;
    const isCombined = lid ? (isCombinedPerLocality[lid] ?? false) : false;

    if (lid && isCombined) {
      const districtsInLocality = districts.filter((d) => d.locality_id === lid && d.id !== "__all__");
      const districtIdsInLocality = districtsInLocality.map((d) => d.id);
      if (districtIdsInLocality.length === 0) {
        setMeetingId(null);
        setRoster([]);
        setAttendanceMap(new Map());
        setMemos(new Map());
        setLoading(false);
        return;
      }
      (async () => {
        const meetingIdMap = await ensureSundayMeetingsBatch(sundayIso, districtsInLocality, { [lid]: true });
        const mid = meetingIdMap[districtId] ?? null;
        if (cancelled) return;
        setMeetingId(mid);
        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date")
          .in("district_id", districtIdsInLocality)
          .order("name");
        if (cancelled) return;
        const districtMembers = ((membersData ?? []) as MemberRow[]).filter((m) =>
          isInEnrollmentPeriod(m, sundayIso)
        );
        if (!mid) {
          setRoster(districtMembers);
          setAttendanceMap(new Map());
          setMemos(new Map());
          setLoading(false);
          return;
        }
        const { data: attData } = await supabase
          .from("attendance_records")
          .select("id, member_id, memo, is_online, is_away, attended")
          .eq("meeting_id", mid);
        if (cancelled) return;
        const records = (attData ?? []) as AttendanceRow[];
        const map = new Map<string, AttendanceRow>();
        const memoMap = new Map<string, string>();
        records.forEach((r) => {
          map.set(r.member_id, { ...r, attended: r.attended });
          memoMap.set(r.member_id, r.memo ?? "");
        });
        const rosterMemberIds = new Set(districtMembers.map((m) => m.id));
        const guestIds = records.map((r) => r.member_id).filter((id) => !rosterMemberIds.has(id));
        let guests: MemberRow[] = [];
        if (guestIds.length > 0) {
          const { data: guestData } = await supabase
            .from("members")
            .select("id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date")
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
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date")
          .eq("district_id", districtId)
          .order("name")
          .then((membersRes) => {
            if (cancelled) return;
            const districtMembers = ((membersRes.data ?? []) as MemberRow[]).filter((m) =>
              isInEnrollmentPeriod(m, sundayIso)
            );
            if (!mid) {
              setRoster(districtMembers);
              setAttendanceMap(new Map());
              setMemos(new Map());
              setLoading(false);
              return;
            }
            return supabase
              .from("attendance_records")
              .select("id, member_id, memo, is_online, is_away, attended")
              .eq("meeting_id", mid)
              .then(async (attRes) => {
                if (cancelled) return;
                const records = (attRes.data ?? []) as AttendanceRow[];
                const map = new Map<string, AttendanceRow>();
                const memoMap = new Map<string, string>();
                records.forEach((r) => {
                  map.set(r.member_id, { ...r, attended: r.attended });
                  memoMap.set(r.member_id, r.memo ?? "");
                });
                const districtIds = new Set(districtMembers.map((m) => m.id));
                const guestIds = records.map((r) => r.member_id).filter((id) => !districtIds.has(id));
                let guests: MemberRow[] = [];
                if (guestIds.length > 0) {
                  const { data: guestData } = await supabase
                    .from("members")
                    .select("id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date")
                    .in("id", guestIds);
                  guests = (guestData ?? []) as MemberRow[];
                }
                // #region agent log — 2/1 信仰別不整合（出欠登録内訳）
                if (sundayIso === "2026-02-01" || sundayIso === "2025-02-01") {
                  const rosterAll = [...districtMembers, ...guests];
                  const memberBaptized = new Map(rosterAll.map((m) => [m.id, m.is_baptized]));
                  let byFaithRoster = { saint: 0, friend: 0 };
                  rosterAll.forEach((m) => {
                    if (m.is_baptized) byFaithRoster.saint += 1;
                    else byFaithRoster.friend += 1;
                  });
                  let byFaithAttendedOnly = { saint: 0, friend: 0 };
                  records.forEach((r) => {
                    if (r.attended !== false) {
                      const bapt = memberBaptized.get(r.member_id);
                      if (bapt) byFaithAttendedOnly.saint += 1;
                      else byFaithAttendedOnly.friend += 1;
                    }
                  });
                  fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "SundayAttendance.tsx",
                      message: "2/1 出欠登録内訳",
                      data: {
                        sundayIso,
                        districtId,
                        meetingId: mid,
                        rosterSize: rosterAll.length,
                        attendanceMapSize: map.size,
                        byFaithRoster,
                        byFaithAttendedOnly,
                        recordsWithAttendedFalse: records.filter((r) => r.attended === false).length,
                      },
                      timestamp: Date.now(),
                      hypothesisId: "A,C",
                    }),
                  }).catch(() => {});
                }
                // #endregion
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
  }, [districtId, sundayIso, districts, ensureMeetingForDistrict, refreshTrigger, isCombinedPerLocality]);

  const toggleAttendance = (memberId: string, member: MemberRow) => {
    if (!isEditMode) return;
    setMessage("");
    const rec = attendanceMap.get(memberId);
    const memoVal = (memos.get(memberId) ?? "").trim();
    const isCurrentlyOn = Boolean(rec && rec.attended !== false);
    if (rec) {
      if (isCurrentlyOn) {
        setAttendanceMap((prev) =>
          new Map(prev).set(memberId, { ...rec, attended: false, is_online: false, is_away: false, memo: memoVal || null })
        );
      } else {
        setAttendanceMap((prev) => {
          const next = new Map(prev);
          const r = next.get(memberId);
          if (r) next.set(memberId, { ...r, attended: true });
          return next;
        });
      }
    } else {
      const isAll = districtId === "__all__";
      const mid = isAll ? null : meetingId;
      setAttendanceMap((prev) =>
        new Map(prev).set(memberId, {
          id: "",
          member_id: memberId,
          memo: null,
          is_online: false,
          is_away: false,
          attended: true,
        })
      );
      setMemos((prev) => new Map(prev).set(memberId, ""));
      setRoster((prev) => (prev.some((m) => m.id === memberId) ? prev : [...prev, member]));
    }
  };

  const saveMemo = (_memberId: string) => {
    if (!isEditMode) return;
    // In edit mode, memo is kept in memos state; persisted on 保存する
  };

  const toggleOnline = (memberId: string) => {
    if (!isEditMode) return;
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const next = !(rec.is_online ?? false);
    setAttendanceMap((prev) => {
      const nextMap = new Map(prev);
      const r = nextMap.get(memberId);
      if (r) nextMap.set(memberId, { ...r, is_online: next });
      return nextMap;
    });
  };

  const toggleIsAway = (memberId: string) => {
    if (!isEditMode) return;
    const rec = attendanceMap.get(memberId);
    if (!rec) return;
    const next = !(rec.is_away ?? false);
    setAttendanceMap((prev) => {
      const nextMap = new Map(prev);
      const r = nextMap.get(memberId);
      if (r) nextMap.set(memberId, { ...r, is_away: next });
      return nextMap;
    });
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
        "id, name, furigana, district_id, group_id, age_group, is_baptized, is_local, local_member_join_date, local_member_leave_date, districts(name, localities(name)), groups(name)"
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
            local_member_join_date: (row.local_member_join_date as string | null) ?? null,
            local_member_leave_date: (row.local_member_leave_date as string | null) ?? null,
            district_name: dist?.name,
            locality_name: dist?.localities?.name ?? dist?.locality?.name,
            group_name: (row.groups as { name: string } | null)?.name,
          };
        });
        setSearchResults(rows);
      });
  }, [searchQuery]);

  const handleExclude = async (member: MemberRow) => {
    const rec = attendanceMap.get(member.id);
    const did = districtId === "__all__" ? (member.district_id ?? "") : districtId;
    if (!did) {
      setExcludedMemberIds((prev) => new Set(prev).add(member.id));
      if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(member.id, rec.id));
      setAttendanceMap((prev) => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });
      setMemos((prev) => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });
      return;
    }
    const supabase = createClient();
    const { data: onList } = await supabase
      .from("district_regular_list")
      .select("id")
      .eq("district_id", did)
      .eq("member_id", member.id)
      .maybeSingle();
    if (onList) {
      setRegularListExcludePopup({ memberId: member.id, member, districtId: did });
    } else {
      setExcludedMemberIds((prev) => new Set(prev).add(member.id));
      if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(member.id, rec.id));
      setAttendanceMap((prev) => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });
      setMemos((prev) => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });
    }
  };

  const addFromSearch = (member: MemberRow) => {
    if (!isEditMode) return;
    if (attendanceMap.has(member.id)) {
      setMessage("この方はすでに登録済みです。");
      return;
    }
    if (!isInEnrollmentPeriod(member, sundayIso)) {
      setEnrollmentBlockedMemberId(member.id);
      return;
    }
    setMessage("");
    setAttendanceMap((prev) =>
      new Map(prev).set(member.id, {
        id: "",
        member_id: member.id,
        memo: null,
        is_online: false,
        is_away: false,
        attended: true,
      })
    );
    setMemos((prev) => new Map(prev).set(member.id, ""));
    setRoster((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
    setSearchQuery("");
    setSearchResults([]);
  };

  const displayRoster = isEditMode
    ? roster.filter((m) => !excludedMemberIds.has(m.id))
    : roster.filter((m) => attendanceMap.has(m.id));
  const sortedMembers = useMemo(() => {
    const list = [...displayRoster];
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
  }, [displayRoster, sortOrder, districtMap, groupMap]);

  const getKey = (opt: GroupOption, m: MemberRow): string => {
    if (opt === "district") return m.district_id ?? "__none__";
    if (opt === "group") return m.group_id ?? "__none__";
    if (opt === "age_group") return m.age_group ?? "__none__";
    if (opt === "attendance") {
      const rec = attendanceMap.get(m.id);
      return (rec && rec.attended !== false) ? "attended" : "absent";
    }
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
  }, [sortedMembers, group1, group2, districtMap, groupMap, attendanceMap]);
  const toggleSectionOpen = (key: string) => setSectionOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  const isSectionOpen = (key: string) => sectionOpen[key] ?? true;

  const hasNoRecords = !loading && attendanceMap.size === 0;

  const currentDistrict = districts.find((d) => d.id === districtId);
  const localityId = currentDistrict?.locality_id;
  const showCombinedToggle = districtId !== "__all__" && Boolean(localityId);
  const isCombined = localityId ? (isCombinedPerLocality[localityId] ?? false) : false;

  const handleCombinedToggle = async (next: boolean) => {
    if (!localityId) return;
    await setSundayMeetingMode(localityId, sundayIso, next);
    setIsCombinedPerLocality((prev) => ({ ...prev, [localityId]: next }));
  };

  return (
    <div className="space-y-4">
      {!districtId ? (
        <p className="text-slate-500 text-sm">地区を選択してください（上記のフィルターで選択）。</p>
      ) : (
      <>
      {districtId && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-medium text-slate-800">主日：{sundayDisplay}</p>
            {showCombinedToggle && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">合同集会</span>
                <Toggle
                  checked={isCombined}
                  onChange={() => handleCombinedToggle(!isCombined)}
                  disabled={loading}
                />
              </label>
            )}
          </div>
          <div className="sticky top-0 z-10 flex justify-end gap-2 py-2 bg-white border-b border-slate-200 -mx-4 px-4 md:-mx-6 md:px-6">
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 touch-target"
              >
                記録モードに切り替える
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMode(false);
                    setExcludedMemberIds(new Set());
                    setExcludedForDeletion(new Map());
                    setRegularListExcludePopup(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 touch-target disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setMessage("");
                    setSaving(true);
                    const supabase = createClient();
                    const isAll = districtId === "__all__";
                    let mid: string | null = meetingId;
                    if (isAll) {
                      mid = null;
                    } else if (!mid && localityId && isCombined) {
                      const districtsInLocality = districts.filter((d) => d.locality_id === localityId && d.id !== "__all__");
                      const meetingIdMap = await ensureSundayMeetingsBatch(sundayIso, districtsInLocality, { [localityId]: true });
                      mid = meetingIdMap[districtId] ?? null;
                    } else if (!mid) {
                      mid = await ensureMeeting();
                    }
                    for (const [, recId] of excludedForDeletion) {
                      await supabase.from("attendance_records").delete().eq("id", recId);
                    }
                    if (isAll) {
                      const meetingIdMap = await ensureSundayMeetingsBatch(sundayIso, districts, isCombinedPerLocality);
                      for (const [localityIdKey, isComb] of Object.entries(isCombinedPerLocality)) {
                        if (!isComb) continue;
                        const districtsInLoc = districts.filter((d) => d.locality_id === localityIdKey && d.id !== "__all__");
                        const localityMid = districtsInLoc.length > 0 ? meetingIdMap[districtsInLoc[0].id] : null;
                        if (localityMid) {
                          await mergeDistrictAttendanceToLocality(
                            sundayIso,
                            localityIdKey,
                            districtsInLoc.map((d) => d.id),
                            localityMid
                          );
                        }
                      }
                      for (const [, rec] of attendanceMap) {
                        const member = roster.find((m) => m.id === rec.member_id);
                        const did = member?.district_id ?? "";
                        const meetId = did ? meetingIdMap[did] : null;
                        if (!meetId) continue;
                        if (rec.id) {
                          await supabase.from("attendance_records").upsert({
                            id: rec.id,
                            meeting_id: meetId,
                            member_id: rec.member_id,
                            memo: memos.get(rec.member_id) || null,
                            is_online: rec.is_online ?? false,
                            is_away: rec.is_away ?? false,
                            attended: rec.attended ?? true,
                            recorded_is_local: Boolean(member?.is_local ?? true),
                          }, { onConflict: "id" });
                        } else {
                          const { data: { user } } = await supabase.auth.getUser();
                          await supabase.from("attendance_records").insert({
                            meeting_id: meetId,
                            member_id: rec.member_id,
                            recorded_category: member?.age_group ?? null,
                            recorded_is_baptized: Boolean(member?.is_baptized),
                            recorded_is_local: Boolean(member?.is_local ?? true),
                            district_id: member?.district_id ?? null,
                            group_id: member?.group_id ?? null,
                            memo: memos.get(rec.member_id) || null,
                            is_online: rec.is_online ?? false,
                            is_away: rec.is_away ?? false,
                            attended: rec.attended ?? true,
                            reported_by_user_id: user?.id ?? null,
                          });
                        }
                      }
                    } else if (mid) {
                      if (localityId && isCombined) {
                        const districtsInLoc = districts.filter((d) => d.locality_id === localityId && d.id !== "__all__");
                        await mergeDistrictAttendanceToLocality(
                          sundayIso,
                          localityId,
                          districtsInLoc.map((d) => d.id),
                          mid
                        );
                      }
                      for (const [, rec] of attendanceMap) {
                        const member = roster.find((m) => m.id === rec.member_id);
                        if (rec.id) {
                          await supabase.from("attendance_records").update({
                            memo: memos.get(rec.member_id) || null,
                            is_online: rec.is_online ?? false,
                            is_away: rec.is_away ?? false,
                            attended: rec.attended ?? true,
                            recorded_is_local: Boolean(member?.is_local ?? true),
                          }).eq("id", rec.id);
                        } else {
                          const { data: { user } } = await supabase.auth.getUser();
                          await supabase.from("attendance_records").insert({
                            meeting_id: mid,
                            member_id: rec.member_id,
                            recorded_category: member?.age_group ?? null,
                            recorded_is_baptized: Boolean(member?.is_baptized),
                            recorded_is_local: Boolean(member?.is_local ?? true),
                            district_id: member?.district_id ?? null,
                            group_id: member?.group_id ?? null,
                            memo: memos.get(rec.member_id) || null,
                            is_online: rec.is_online ?? false,
                            is_away: rec.is_away ?? false,
                            attended: rec.attended ?? true,
                            reported_by_user_id: user?.id ?? null,
                          });
                        }
                      }
                    }
                    setSaving(false);
                    setIsEditMode(false);
                    setExcludedMemberIds(new Set());
                    setExcludedForDeletion(new Map());
                    setMessage("保存しました。");
                    setRefreshTrigger((t) => t + 1);
                  }}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 touch-target"
                >
                  {saving ? "保存中…" : "保存する"}
                </button>
              </>
            )}
          </div>
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
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
                {isEditMode && (
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
                        .map((m) => {
                          const outOfEnrollment = !isInEnrollmentPeriod(m, sundayIso);
                          return (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => addFromSearch(m)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 touch-target ${outOfEnrollment ? "text-red-600" : ""}`}
                              >
                                <span className="font-medium">{m.name}</span>
                                <span className={`ml-2 text-xs ${outOfEnrollment ? "text-red-500" : "text-slate-500"}`}>
                                  {[m.locality_name, m.district_name, m.group_name, m.age_group ? CATEGORY_LABELS[m.age_group] : ""]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
                )}
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
          {message && <p className="text-sm text-amber-600">{message}</p>}

          <div>
            {loading ? (
              <p className="text-slate-500 text-sm">読み込み中…</p>
            ) : !isEditMode && displayRoster.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">まだ記録はありません。</p>
            ) : (
              <>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠({[...attendanceMap.values()].filter((r) => r.attended !== false).length})</th>
                        <th className="px-1 py-1.5 text-center text-xs font-medium text-slate-500 uppercase w-14 sm:w-24">ｵﾝﾗｲﾝ({[...attendanceMap.values()].filter((r) => r.attended !== false && r.is_online).length})</th>
                        <th className="px-1 py-1.5 text-center text-xs font-medium text-slate-500 uppercase w-14 sm:w-24">他地方({[...attendanceMap.values()].filter((r) => r.attended !== false && r.is_away).length})</th>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto"><span className="hidden sm:inline">メモ</span></th>
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
                      {sections.map((section, idx) => {
                        const hasGroup1 = Boolean(group1 && section.group1Key);
                        const hasGroup2 = Boolean(group2);
                        const g1Key = `g1-${section.group1Key}`;
                        const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
                        return (
                        <Fragment key={`s-${section.group1Key}-${idx}`}>
                          {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                            <tr className="bg-slate-100">
                              <td colSpan={5} className="px-3 py-0">
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
                                    <td colSpan={5} className="px-3 py-0 pl-6">
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
                      const rec = attendanceMap.get(m.id);
                      const attended = Boolean(rec && rec.attended !== false);
                      const isOnline = rec?.is_online ?? false;
                      const isAway = rec?.is_away ?? false;
                      const memo = memos.get(m.id) ?? "";
                      const memoPlaceholder = isAway ? "出席した地方を記載してください" : "欠席理由など";
                      return (
                        <Fragment key={m.id}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 text-slate-800">
                            <div className="flex items-center gap-1">
                              {isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => handleExclude(m)}
                                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-red-600 hover:bg-red-50 touch-target text-sm font-bold"
                                  aria-label={`${m.name}を除外`}
                                  title="除外"
                                >
                                  −
                                </button>
                              )}
                              <span>{m.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            {isEditMode ? (
                              <Toggle
                                checked={attended}
                                onChange={() => toggleAttendance(m.id, m)}
                                ariaLabel={`${m.name}の出欠`}
                              />
                            ) : (
                              <span className={attended ? "text-primary-600" : "text-slate-400"}>{attended ? "○" : "×"}</span>
                            )}
                          </td>
                          <td className="px-1 py-1.5 align-middle">
                            {attended ? (
                              isEditMode ? (
                                <Toggle
                                  checked={isOnline}
                                  onChange={() => toggleOnline(m.id)}
                                  ariaLabel={`${m.name}のオンライン`}
                                />
                              ) : (
                                <span className={isOnline ? "text-primary-600" : "text-slate-400"}>{isOnline ? "○" : "—"}</span>
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-1 py-1.5 align-middle">
                            {attended ? (
                              isEditMode ? (
                                <Toggle
                                  checked={isAway}
                                  onChange={() => toggleIsAway(m.id)}
                                  ariaLabel={`${m.name}の他地方`}
                                />
                              ) : (
                                <span className={isAway ? "text-amber-600" : "text-slate-400"}>{isAway ? "○" : "—"}</span>
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {isEditMode ? (
                              <>
                                <div className="sm:hidden">
                                  <button
                                    type="button"
                                    onClick={() => setMemoPopupMemberId(m.id)}
                                    className="p-1 rounded touch-target inline-flex"
                                    aria-label="メモを編集"
                                  >
                                    <svg className={`w-5 h-5 ${memo.trim() ? "text-primary-600" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                    value={memo}
                                    onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                                    onBlur={() => saveMemo(m.id)}
                                    placeholder={memoPlaceholder}
                                    className={`w-full max-w-xs px-2 py-0.5 text-sm border rounded touch-target ${
                                      isAway ? "border-amber-400" : "border-slate-300"
                                    }`}
                                  />
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-600 text-sm">{memo || "—"}</span>
                            )}
                          </td>
                        </tr>
                        {memo.trim() && (
                          <tr className="sm:hidden bg-slate-50/50">
                            <td colSpan={5} className="px-3 py-0.5 pb-1.5 text-xs text-slate-500">
                              {memo}
                            </td>
                          </tr>
                        )}
                        </Fragment>
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
              </>
            )}
          </div>
        </>
      )}
      </>
      )}

      {regularListExcludePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="regular-list-exclude-title"
          onClick={() => setRegularListExcludePopup(null)}
        >
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="regular-list-exclude-title" className="text-sm font-medium text-slate-700 mb-2">レギュラーリストに登録されている名前です</h2>
            <p className="text-sm text-slate-600 mb-4">
              レギュラーリストからも削除しますか？
              過去の記録に影響はありません。今週以降に影響します。地区のレギュラーリストから外れると、今後その地区の主日の登録モードで「レギュラーリストで補完する」を押したときに、その名前一覧に含まれなくなります。
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setRegularListExcludePopup(null)}
                className="w-full px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg touch-target"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { memberId, member, districtId } = regularListExcludePopup;
                  const rec = attendanceMap.get(memberId);
                  setExcludedMemberIds((prev) => new Set(prev).add(memberId));
                  if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(memberId, rec.id));
                  setAttendanceMap((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
                  setMemos((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
                  await removeDistrictRegularMember(districtId, memberId);
                  setRegularListExcludePopup(null);
                }}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg touch-target"
              >
                削除する
              </button>
              <button
                type="button"
                onClick={() => {
                  const { memberId } = regularListExcludePopup;
                  const rec = attendanceMap.get(memberId);
                  setExcludedMemberIds((prev) => new Set(prev).add(memberId));
                  if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(memberId, rec.id));
                  setAttendanceMap((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
                  setMemos((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
                  setRegularListExcludePopup(null);
                }}
                className="w-full px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg touch-target"
              >
                削除しない
              </button>
            </div>
          </div>
        </div>
      )}

      {enrollmentBlockedMemberId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrollment-blocked-title"
          onClick={() => setEnrollmentBlockedMemberId(null)}
        >
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="enrollment-blocked-title" className="text-sm font-medium text-slate-700 mb-2">在籍期間外</h2>
            <p className="text-sm text-slate-600 mb-4">
              このメンバーは在籍期間外です。名簿編集にて「ローカルメンバー転入日」や「ローカルメンバー転出日」をご確認ください。
            </p>
            <button
              type="button"
              onClick={() => setEnrollmentBlockedMemberId(null)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg touch-target"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {memoPopupMemberId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memo-popup-title"
          onClick={() => setMemoPopupMemberId(null)}
        >
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="memo-popup-title" className="text-sm font-medium text-slate-700 mb-2">メモ</h2>
            <textarea
              value={memos.get(memoPopupMemberId) ?? ""}
              onChange={(e) => setMemos((prev) => new Map(prev).set(memoPopupMemberId, e.target.value))}
              placeholder={(attendanceMap.get(memoPopupMemberId)?.is_away) ? "出席した地方を記載してください" : "欠席理由など"}
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
                  saveMemo(memoPopupMemberId);
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
