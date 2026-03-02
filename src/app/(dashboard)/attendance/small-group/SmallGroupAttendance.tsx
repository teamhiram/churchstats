"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Toggle } from "@/components/Toggle";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import { getGojuonRowLabel, GOJUON_ROW_LABELS, hiraganaToKatakana, escapeForIlike } from "@/lib/furigana";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import { isInEnrollmentPeriod } from "@/lib/enrollmentPeriod";
import { useAttendanceEditMode } from "../AttendanceEditModeContext";
import { removeGroupRegularMember } from "@/app/(dashboard)/settings/organization/actions";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
type WeekOption = { value: string; label: string };
/** 小組集会は地区順を省く */
type SortOption = "furigana" | "group" | "age_group";
type GroupOption = "district" | "group" | "age_group" | "believer" | "attendance" | "list" | "gojuon";

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
  attendance: "出欠別",
  list: "リスト別",
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
  const [group1, setGroup1] = useState<GroupOption | "">("attendance");
  const [group2, setGroup2] = useState<GroupOption | "">("");
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setGroup2(isEditMode ? "list" : "");
  }, [isEditMode]);

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setEditMode: setGlobalEditMode } = useAttendanceEditMode();
  useEffect(() => {
    setGlobalEditMode(isEditMode);
    return () => setGlobalEditMode(false);
  }, [isEditMode, setGlobalEditMode]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);
  const [excludedMemberIds, setExcludedMemberIds] = useState<Set<string>>(new Set());
  const [excludedForDeletion, setExcludedForDeletion] = useState<Map<string, string>>(new Map());
  const [regularListExcludePopup, setRegularListExcludePopup] = useState<{ memberId: string; member: MemberRow; groupId: string } | null>(null);
  const [memberTierMap, setMemberTierMap] = useState<Map<string, "regular" | "semi" | "pool">>(new Map());
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [showDeleteRecordConfirm, setShowDeleteRecordConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

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

  const buildGroupMemberTierMap = useCallback(
    async (
      supabaseClient: ReturnType<typeof createClient>,
      groupIds: string[],
      members: MemberRow[]
    ): Promise<Map<string, "regular" | "semi" | "pool">> => {
      if (groupIds.length === 0 || members.length === 0) return new Map();
      const [regRes, semiRes, poolRes] = await Promise.all([
        supabaseClient.from("group_regular_list").select("group_id, member_id").in("group_id", groupIds),
        supabaseClient.from("group_semi_regular_list").select("group_id, member_id").in("group_id", groupIds),
        supabaseClient.from("group_pool_list").select("group_id, member_id").in("group_id", groupIds),
      ]);
      const regularByGroup = new Map<string, Set<string>>();
      const semiByGroup = new Map<string, Set<string>>();
      const poolByGroup = new Map<string, Set<string>>();
      ((regRes.data ?? []) as { group_id: string; member_id: string }[]).forEach((r) => {
        if (!regularByGroup.has(r.group_id)) regularByGroup.set(r.group_id, new Set());
        regularByGroup.get(r.group_id)!.add(r.member_id);
      });
      ((semiRes.data ?? []) as { group_id: string; member_id: string }[]).forEach((r) => {
        if (!semiByGroup.has(r.group_id)) semiByGroup.set(r.group_id, new Set());
        semiByGroup.get(r.group_id)!.add(r.member_id);
      });
      ((poolRes.data ?? []) as { group_id: string; member_id: string }[]).forEach((r) => {
        if (!poolByGroup.has(r.group_id)) poolByGroup.set(r.group_id, new Set());
        poolByGroup.get(r.group_id)!.add(r.member_id);
      });
      const map = new Map<string, "regular" | "semi" | "pool">();
      members.forEach((m) => {
        const gid = m.group_id ?? "";
        if (regularByGroup.get(gid)?.has(m.id)) map.set(m.id, "regular");
        else if (semiByGroup.get(gid)?.has(m.id)) map.set(m.id, "semi");
        else if (poolByGroup.get(gid)?.has(m.id)) map.set(m.id, "pool");
        else map.set(m.id, "semi");
      });
      return map;
    },
    []
  );

  useEffect(() => {
    if (!groupId || !weekStartIso) {
      setRecordId(null);
      setEventDate("");
      setRoster([]);
      setGuestIds(new Set());
      setAttendanceMap(new Map());
      setMemos(new Map());
      setMemberTierMap(new Map());
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
        setGuestIds(new Set());
        setAttendanceMap(new Map());
        setMemos(new Map());
        setMemberTierMap(new Map());
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
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, local_member_join_date, local_member_leave_date")
          .in("group_id", groupIds)
          .order("name");
        if (cancelled) return;
        const refDate = weekStartIso;
        const districtMembers = ((membersData ?? []) as MemberRow[]).filter((m) =>
          isInEnrollmentPeriod(m, refDate)
        );

        if (recordIds.length === 0) {
          const tierMap = await buildGroupMemberTierMap(supabase, groupIds, districtMembers);
          if (cancelled) return;
          setMemberTierMap(tierMap);
          setRecordId(null);
          setEventDate("");
          setGuestIds(new Set());
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
          map.set(r.member_id, { ...r, attended: r.attended });
          memoMap.set(r.member_id, r.memo ?? "");
        });
                const districtMemberIds = new Set(districtMembers.map((m) => m.id));
        const guestIds = records.map((r) => r.member_id).filter((id) => !districtMemberIds.has(id));
        let guests: MemberRow[] = [];
        if (guestIds.length > 0) {
          const { data: guestData } = await supabase
            .from("members")
            .select("id, name, furigana, district_id, group_id, age_group, is_baptized, local_member_join_date, local_member_leave_date")
            .in("id", guestIds);
          guests = (guestData ?? []) as MemberRow[];
        }
        const tierMap = await buildGroupMemberTierMap(supabase, groupIds, districtMembers);
        if (cancelled) return;
        setMemberTierMap(tierMap);
        setRecordId(null);
        setEventDate("");
        setGuestIds(new Set(guestIds));
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
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, local_member_join_date, local_member_leave_date")
          .eq("group_id", groupId)
          .order("name")
          .then(async (membersRes) => {
            if (cancelled) return;
            const evDate = (existingRecord as { id: string; event_date?: string | null } | null)?.event_date ?? "";
            const refDate = evDate || weekStartIso;
            const districtMembers = ((membersRes.data ?? []) as MemberRow[]).filter((m) =>
              isInEnrollmentPeriod(m, refDate)
            );
            if (!rid) {
              const tierMap = await buildGroupMemberTierMap(supabase, [groupId], districtMembers);
              if (cancelled) return;
              setMemberTierMap(tierMap);
              setGuestIds(new Set());
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
                  map.set(r.member_id, { ...r, attended: r.attended });
                  memoMap.set(r.member_id, r.memo ?? "");
                });
                const districtIdsSet = new Set(districtMembers.map((m) => m.id));
                const guestIds = records.map((r) => r.member_id).filter((id) => !districtIdsSet.has(id));
                let guests: MemberRow[] = [];
                if (guestIds.length > 0) {
                  const { data: guestData } = await supabase
                    .from("members")
                    .select("id, name, furigana, district_id, group_id, age_group, is_baptized, local_member_join_date, local_member_leave_date")
                    .in("id", guestIds);
                  guests = (guestData ?? []) as MemberRow[];
                }
                const tierMap = await buildGroupMemberTierMap(supabase, [groupId], districtMembers);
                if (cancelled) return;
                setMemberTierMap(tierMap);
                setGuestIds(new Set(guestIds));
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
  }, [groupId, weekStartIso, groups, refreshTrigger]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.trim();
    const qKata = hiraganaToKatakana(q);
    const patFurigana = `%${escapeForIlike(qKata)}%`;
    const patName = `%${escapeForIlike(q)}%`;
    const supabase = createClient();
    supabase
      .from("members")
      .select(
        "id, name, furigana, district_id, group_id, age_group, is_baptized, local_member_join_date, local_member_leave_date, districts(name, localities(name)), groups(name)"
      )
      .or(`furigana.ilike.${patFurigana},name.ilike.${patName}`)
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

  const refDateForEnrollment = eventDate || weekStartIso;
  const handleExclude = async (member: MemberRow) => {
    const rec = attendanceMap.get(member.id);
    const gid = groupId === "__all__" ? (member.group_id ?? "") : groupId;
    if (!gid) {
      setExcludedMemberIds((prev) => new Set(prev).add(member.id));
      if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(member.id, rec.id));
      setAttendanceMap((prev) => { const n = new Map(prev); n.delete(member.id); return n; });
      setMemos((prev) => { const n = new Map(prev); n.delete(member.id); return n; });
      return;
    }
    const supabase = createClient();
    const { data: onList } = await supabase
      .from("group_regular_list")
      .select("id")
      .eq("group_id", gid)
      .eq("member_id", member.id)
      .maybeSingle();
    if (onList) {
      setRegularListExcludePopup({ memberId: member.id, member, groupId: gid });
    } else {
      setExcludedMemberIds((prev) => new Set(prev).add(member.id));
      if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(member.id, rec.id));
      setAttendanceMap((prev) => { const n = new Map(prev); n.delete(member.id); return n; });
      setMemos((prev) => { const n = new Map(prev); n.delete(member.id); return n; });
    }
  };

  const addFromSearch = (member: MemberRow) => {
    if (!isEditMode) return;
    if (attendanceMap.has(member.id)) {
      setMessage("この方はすでに登録済みです。");
      return;
    }
    if (!isInEnrollmentPeriod(member, refDateForEnrollment)) {
      setEnrollmentBlockedMemberId(member.id);
      return;
    }
    setMessage("");
    setAttendanceMap((prev) =>
      new Map(prev).set(member.id, {
        id: "",
        member_id: member.id,
        memo: null,
        attended: true,
      })
    );
    setMemos((prev) => new Map(prev).set(member.id, ""));
    setGuestIds((prev) => new Set([...prev, member.id]));
    setRoster((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
    setSearchQuery("");
    setSearchResults([]);
  };

  const hasAttendanceData = useCallback(
    (memberId: string): boolean => {
      const rec = attendanceMap.get(memberId);
      if (!rec) return false;
      return rec.attended === true || ((memos.get(memberId) ?? "").trim() !== "");
    },
    [attendanceMap, memos]
  );

  const displayRoster = useMemo(() => {
    const base = isEditMode
      ? roster.filter((m) => !excludedMemberIds.has(m.id))
      : roster.filter((m) => attendanceMap.has(m.id));
    return base;
  }, [isEditMode, roster, excludedMemberIds, attendanceMap]);
  const sortedMembers = useMemo(() => {
    const list = [...displayRoster];
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
  }, [displayRoster, sortOrder, groupMap]);

  const getKey = (opt: GroupOption, m: MemberRow): string => {
    if (opt === "district") return m.district_id ?? "__none__";
    if (opt === "group") return m.group_id ?? "__none__";
    if (opt === "age_group") return m.age_group ?? "__none__";
    if (opt === "attendance") {
      const rec = attendanceMap.get(m.id);
      if (!rec) return "unrecorded";
      return rec.attended !== false ? "attended" : "absent";
    }
    if (opt === "list") return memberTierMap.get(m.id) ?? "semi";
    if (opt === "gojuon") return getGojuonRowLabel(m.furigana ?? m.name);
    return m.is_baptized ? "believer" : "friend";
  };
  const getLabel = (opt: GroupOption, key: string): string => {
    if (opt === "district") return key === "__none__" ? "—" : (districtMap.get(key) ?? "");
    if (opt === "group") return key === "__none__" ? "無所属" : (groupMap.get(key) ?? "");
    if (opt === "age_group") return key === "__none__" ? "不明" : (key in CATEGORY_LABELS ? CATEGORY_LABELS[key as Category] : "");
    if (opt === "attendance") return key === "attended" ? "○ 出席" : key === "absent" ? "× 欠席" : "ー 記録なし";
    if (opt === "list") return key === "regular" ? "レギュラー" : key === "semi" ? "準レギュラー" : "プール";
    if (opt === "gojuon") return key;
    return key === "believer" ? "聖徒" : "友人";
  };
  const sortKeys = (opt: GroupOption, keys: string[]): string[] => {
    if (opt === "attendance") return ["attended", "absent", "unrecorded"].filter((k) => keys.includes(k));
    if (opt === "list") return ["regular", "semi", "pool"].filter((k) => keys.includes(k));
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
  }, [sortedMembers, group1, group2, districtMap, groupMap, attendanceMap, memberTierMap]);
  const defaultSectionOpen = (key: string) => (key.includes("::g2-pool") ? false : true);
  const toggleSectionOpen = (key: string) => setSectionOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultSectionOpen(key)) }));
  const isSectionOpen = (key: string) => sectionOpen[key] ?? defaultSectionOpen(key);

  const setAttendanceChoice = (memberId: string, member: MemberRow, choice: "unrecorded" | "present" | "absent") => {
    if (!isEditMode) return;
    setMessage("");
    const memoVal = (memos.get(memberId) ?? "").trim();
    if (choice === "unrecorded") {
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
      return;
    }
    const attended = choice === "present";
    const rec = attendanceMap.get(memberId);
    if (rec) {
      setAttendanceMap((prev) =>
        new Map(prev).set(memberId, { ...rec, attended, memo: memoVal || null })
      );
    } else {
      setAttendanceMap((prev) =>
        new Map(prev).set(memberId, {
          id: "",
          member_id: memberId,
          memo: null,
          attended,
        })
      );
      setMemos((prev) => new Map(prev).set(memberId, ""));
      setGuestIds((prev) => new Set([...prev, memberId]));
      setRoster((prev) => (prev.some((m) => m.id === memberId) ? prev : [...prev, member]));
    }
  };

  const saveMemo = (_memberId: string) => {
    if (!isEditMode) return;
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

  const performSave = async () => {
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    const isAll = groupId === "__all__";
    try {
      for (const [, recId] of excludedForDeletion) {
        await supabase.from("group_meeting_attendance").delete().eq("id", recId);
      }
      if (isAll) {
        const groupIds = [...new Set(roster.filter((m) => attendanceMap.has(m.id)).map((m) => m.group_id).filter(Boolean))] as string[];
        const recordIdMap: Record<string, string> = {};
        for (const gid of groupIds) {
          const rid = await ensureGroupMeetingRecordForGroup(gid);
          if (rid) recordIdMap[gid] = rid;
        }
        for (const [memberId, rec] of attendanceMap) {
          const member = roster.find((m) => m.id === memberId);
          const gid = member?.group_id ?? "";
          const rid = recordIdMap[gid];
          if (!rid) continue;
          const memo = (memos.get(memberId) ?? "").trim() || null;
          if (rec.id) {
            await supabase
              .from("group_meeting_attendance")
              .update({ attended: rec.attended, memo })
              .eq("id", rec.id);
          } else {
            await supabase.from("group_meeting_attendance").insert({
              group_meeting_record_id: rid,
              member_id: memberId,
              memo,
              attended: rec.attended !== false,
              reported_by_user_id: uid,
            });
          }
        }
      } else {
        let rid = recordId;
        if (!rid) {
          rid = await ensureGroupMeetingRecord(eventDate || undefined);
          if (rid) setRecordId(rid);
        }
        if (!rid) {
          setMessage("集会の登録に失敗しました。");
          setSaving(false);
          return;
        }
        for (const [memberId, rec] of attendanceMap) {
          const memo = (memos.get(memberId) ?? "").trim() || null;
          if (rec.id) {
            await supabase
              .from("group_meeting_attendance")
              .update({ attended: rec.attended, memo })
              .eq("id", rec.id);
          } else {
            await supabase.from("group_meeting_attendance").insert({
              group_meeting_record_id: rid,
              member_id: memberId,
              memo,
              attended: rec.attended !== false,
              reported_by_user_id: uid,
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
    } catch {
      setMessage("保存に失敗しました。");
      setSaving(false);
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
          <div className="flex flex-nowrap items-center justify-end gap-3 py-2 bg-white border-b border-slate-200 -mx-4 px-4 md:-mx-6 md:px-6">
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => performSave()}
                      disabled={saving}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 touch-target"
                    >
                      {saving ? "保存中…" : "保存する"}
                    </button>
                  )}
                  <span className="text-sm font-medium text-slate-700">モード：</span>
                  <span
                    className="inline-flex rounded-lg border border-slate-300 overflow-hidden bg-slate-50"
                    role="group"
                    aria-label="閲覧・記録モード切替"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditMode) {
                          setIsEditMode(false);
                          setExcludedMemberIds(new Set());
                          setExcludedForDeletion(new Map());
                          setRegularListExcludePopup(null);
                          setMessage("");
                        } else {
                          setIsEditMode(true);
                        }
                      }}
                      disabled={saving}
                      className={`px-4 py-2 text-sm font-medium touch-target rounded-l-lg transition-colors disabled:opacity-50 ${
                        !isEditMode ? "bg-primary-600 text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      閲覧
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditMode) {
                          setIsEditMode(true);
                        } else {
                          setIsEditMode(false);
                          setExcludedMemberIds(new Set());
                          setExcludedForDeletion(new Map());
                          setRegularListExcludePopup(null);
                          setMessage("");
                        }
                      }}
                      disabled={saving}
                      className={`px-4 py-2 text-sm font-medium touch-target rounded-r-lg transition-colors disabled:opacity-50 ${
                        isEditMode ? "bg-primary-600 text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      記録
                    </button>
                  </span>
                </div>
              </div>
          <div className="border border-slate-200 rounded-lg bg-white">
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
                  <div className="border-t border-slate-200 px-4 pb-4 pt-2">
                    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                        <label className="hidden sm:inline text-sm font-medium text-slate-700 shrink-0">並び順</label>
                        <select
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value as SortOption)}
                          className="min-w-0 flex-1 sm:flex-initial px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                        >
                          {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
                            <option key={k} value={k}>{SORT_LABELS[k]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                        <label className="hidden sm:inline text-sm font-medium text-slate-700 shrink-0">グルーピング1層目</label>
                        <select
                          value={group1}
                          onChange={(e) => {
                            const v = e.target.value as GroupOption | "";
                            setGroup1(v);
                            if (v === group2) setGroup2("");
                          }}
                          className="min-w-0 flex-1 sm:flex-initial px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                        >
                          <option value="">なし</option>
                          {(Object.keys(GROUP_LABELS) as GroupOption[]).map((k) => (
                            <option key={k} value={k}>{GROUP_LABELS[k]}</option>
                          ))}
                        </select>
                      </div>
                      {group1 && (
                        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                          <label className="hidden sm:inline text-sm font-medium text-slate-700 shrink-0">グルーピング2層目</label>
                          <select
                            value={group2}
                            onChange={(e) => setGroup2(e.target.value as GroupOption | "")}
                            className="min-w-0 flex-1 sm:flex-initial px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
                          >
                            <option value="">なし</option>
                            {group2Options.map((k) => (
                              <option key={k} value={k}>{GROUP_LABELS[k]}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {isEditMode && (
                        <div className="min-w-[200px] flex-1 relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="名前で検索（他小組も可）"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                          />
                          {searchResults.length > 0 && (
                            <ul className="absolute left-0 right-0 top-full z-20 mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-lg max-h-60 overflow-auto">
                              {searchResults.map((m) => {
                                  const outOfEnrollment = !isInEnrollmentPeriod(m, refDateForEnrollment);
                                  const isAdded = attendanceMap.has(m.id);
                                  return (
                                    <li key={m.id}>
                                      <button
                                        type="button"
                                        onClick={() => !isAdded && addFromSearch(m)}
                                        disabled={isAdded}
                                        className={`w-full text-left px-3 py-2 text-sm touch-target ${isAdded ? "cursor-default bg-slate-50 text-slate-500" : "hover:bg-slate-50"} ${outOfEnrollment && !isAdded ? "text-red-600" : ""}`}
                                      >
                                        <span className="font-medium">{m.name}</span>
                                        {m.furigana && <span className="ml-2 text-xs text-slate-400">{m.furigana}</span>}
                                        <span className={`ml-2 text-xs ${outOfEnrollment && !isAdded ? "text-red-500" : "text-slate-500"}`}>
                                          {[m.locality_name, m.district_name, m.group_name, m.age_group ? CATEGORY_LABELS[m.age_group] : ""]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </span>
                                        {isAdded && <span className="ml-2 text-xs font-medium text-emerald-600">追加済み</span>}
                                      </button>
                                    </li>
                                  );
                                })}
                            </ul>
                          )}
                        </div>
                      )}
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
            ) : !isEditMode && displayRoster.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">まだ記録はありません。</p>
            ) : (
              <>
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
                    {sections.map((section, idx) => {
                      const hasGroup1 = Boolean(group1 && section.group1Key);
                      const hasGroup2 = Boolean(group2);
                      const g1Key = `g1-${section.group1Key}`;
                      const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
                      return (
                      <Fragment key={`s-${section.group1Key}-${idx}`}>
                        {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                          <tr className="bg-gray-800">
                            <td colSpan={3} className="px-3 py-0">
                              <button
                                type="button"
                                onClick={() => toggleSectionOpen(g1Key)}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-left text-sm font-medium text-white hover:bg-gray-700 touch-target"
                                aria-expanded={g1Open}
                              >
                                <span>{group1 ? `${GROUP_LABELS[group1]}：${section.group1Label || "—"}` : ""}</span>
                                <svg
                                  className={`w-4 h-4 text-gray-300 transition-transform ${g1Open ? "rotate-180" : ""}`}
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
                        {hasGroup1 && g1Open && section.subsections.some((s) => s.members.length > 0) && (
                          <tr className="bg-slate-50">
                            <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                            <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠</th>
                            <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase">メモ</th>
                          </tr>
                        )}
                        {(hasGroup1 ? g1Open : true) && section.subsections.map((sub, subIdx) => {
                          const hasSubHeader = hasGroup2 && sub.group2Key;
                          const g2Key = hasSubHeader ? `g1-${section.group1Key}::g2-${sub.group2Key}` : "";
                          const g2Open = g2Key ? isSectionOpen(g2Key) : true;
                          return (
                            <Fragment key={`sub-${section.group1Key}-${sub.group2Key}-${subIdx}`}>
                              {hasSubHeader && sub.members.length > 0 && (
                                <tr className="bg-gray-500">
                                  <td colSpan={3} className="px-3 py-0 pl-6">
                                    <button
                                      type="button"
                                      onClick={() => toggleSectionOpen(g2Key)}
                                      className="w-full flex items-center justify-between px-3 py-1 text-left text-sm font-medium text-white hover:bg-gray-400 touch-target"
                                      aria-expanded={g2Open}
                                    >
                                      <span>{group2 ? `${GROUP_LABELS[group2]}：${sub.group2Label || "—"}` : ""}</span>
                                      <svg
                                        className={`w-4 h-4 text-gray-300 transition-transform ${g2Open ? "rotate-180" : ""}`}
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
                              {hasSubHeader && g2Open && sub.members.length > 0 && (
                                <tr className="bg-slate-50">
                                  <th className="px-3 py-1 pl-6 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                                  <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠</th>
                                  <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase">メモ</th>
                                </tr>
                              )}
                              {(!hasSubHeader || g2Open) && sub.members.map((m) => {
                                    const recRow = attendanceMap.get(m.id);
                                    const attended = Boolean(recRow && recRow.attended !== false);
                                    const unrecorded = !recRow;
                                    const memo = memos.get(m.id) ?? "";
                                    const tier = memberTierMap.get(m.id);
                                    const rowBgClass = tier === "semi" ? "bg-amber-50 hover:bg-amber-100" : tier === "pool" ? "bg-sky-50 hover:bg-sky-100" : "hover:bg-slate-50";
                                    return (
                                      <tr key={m.id} className={rowBgClass}>
                                        <td className="px-3 py-0.5 text-slate-800 text-sm">
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
                                            {isEditMode ? (
                                              <span className={guestIds.has(m.id) ? "text-slate-400" : ""}>{m.name}</span>
                                            ) : (
                                              <Link href={`/members/${m.id}`} className={`text-primary-600 hover:underline ${guestIds.has(m.id) ? "text-slate-400" : ""}`}>
                                                {m.name}
                                              </Link>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-0.5">
                                          {isEditMode ? (
                                            <div className="flex items-center gap-0.5">
                                              <button
                                                type="button"
                                                onClick={() => setAttendanceChoice(m.id, m, "unrecorded")}
                                                className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-medium touch-target ${unrecorded ? "border-amber-400 bg-amber-100 text-slate-600 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-300"}`}
                                                aria-label={`${m.name}を記録なしに`}
                                                title="記録なし"
                                              >
                                                ー
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setAttendanceChoice(m.id, m, "present")}
                                                className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-medium touch-target ${attended ? "border-primary-400 bg-primary-100 text-primary-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-primary-50 hover:border-primary-400"}`}
                                                aria-label={`${m.name}を出席に`}
                                                title="出席"
                                              >
                                                ○
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setAttendanceChoice(m.id, m, "absent")}
                                                className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-medium touch-target ${!attended && !unrecorded ? "border-amber-400 bg-amber-100 text-amber-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-400"}`}
                                                aria-label={`${m.name}を欠席に`}
                                                title="欠席"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          ) : (
                                            <span className={attended ? "text-primary-600" : unrecorded ? "text-slate-400" : "text-slate-400"}>{attended ? "○" : unrecorded ? "ー" : "×"}</span>
                                          )}
                                        </td>
                        <td className="px-3 py-0.5">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={memo}
                              onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                              onBlur={() => saveMemo(m.id)}
                              placeholder="欠席理由など"
                              className="w-full max-w-xs px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                            />
                          ) : (
                            <span className="text-slate-600 text-sm">{memo || "—"}</span>
                          )}
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
                {!isEditMode && (
                  <div className="flex justify-end pt-4 pb-2 -mx-4 px-4 md:-mx-6 md:px-6">
                    <button
                      type="button"
                      onClick={() => setShowDeleteRecordConfirm(true)}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      記録を削除する
                    </button>
                  </div>
                )}
                {isEditMode && (
                  <div className="flex justify-end pt-4 pb-2 -mx-4 px-4 md:-mx-6 md:px-6">
                    <button
                      type="button"
                      onClick={() => performSave()}
                      disabled={saving}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 touch-target"
                    >
                      {saving ? "保存中…" : "保存する"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
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
              過去の記録に影響はありません。今週以降に影響します。小組のレギュラーリストから外れると、今後その小組の登録モードで「レギュラーリストで補完する」を押したときに、その名前一覧に含まれなくなります。
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
                  const { memberId, groupId } = regularListExcludePopup;
                  const rec = attendanceMap.get(memberId);
                  setExcludedMemberIds((prev) => new Set(prev).add(memberId));
                  if (rec?.id) setExcludedForDeletion((prev) => new Map(prev).set(memberId, rec.id));
                  setAttendanceMap((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
                  setMemos((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
                  await removeGroupRegularMember(groupId, memberId);
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

      {showDeleteRecordConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-record-title"
          onClick={() => {
            setShowDeleteRecordConfirm(false);
            setDeleteConfirmInput("");
          }}
        >
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-record-title" className="text-sm font-medium text-slate-800 mb-2">記録を削除</h2>
            <p className="text-sm text-slate-600 mb-4">
              本当に記録を削除しますか？削除した出欠データは復元できません。
            </p>
            <p className="text-sm text-slate-600 mb-2">確認のため「削除する」と入力してください。</p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="削除する"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-4 touch-target"
              aria-label="削除する と入力"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteRecordConfirm(false);
                  setDeleteConfirmInput("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 touch-target"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deleteConfirmInput !== "削除する"}
                onClick={async () => {
                  setShowDeleteRecordConfirm(false);
                  setDeleteConfirmInput("");
                  const supabase = createClient();
                  try {
                    if (groupId === "__all__") {
                      const { data: records } = await supabase
                        .from("group_meeting_records")
                        .select("id")
                        .eq("week_start", weekStartIso);
                      const ids = (records ?? []).map((r: { id: string }) => r.id);
                      if (ids.length > 0) {
                        await supabase.from("group_meeting_attendance").delete().in("group_meeting_record_id", ids);
                      }
                    } else if (recordId) {
                      await supabase.from("group_meeting_attendance").delete().eq("group_meeting_record_id", recordId);
                    }
                    setAttendanceMap(new Map());
                    setMemos(new Map());
                    setRefreshTrigger((t) => t + 1);
                    setMessage("記録を削除しました。");
                  } catch {
                    setMessage("記録の削除に失敗しました。");
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
