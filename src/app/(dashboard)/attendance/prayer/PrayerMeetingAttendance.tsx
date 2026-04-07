"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import { formatMemberName, formatMemberFurigana } from "@/lib/memberName";
import { getGojuonRowLabel, GOJUON_ROW_LABELS, hiraganaToKatakana, escapeForIlike } from "@/lib/furigana";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/types/database";
import type { Category } from "@/types/database";
import { isInEnrollmentPeriod } from "@/lib/enrollmentPeriod";
import { useAttendanceEditMode } from "../AttendanceEditModeContext";
import {
  GROUP_LABELS,
  MEMBERS_SELECT,
  SORT_LABELS,
  type AttendanceRow,
  type District,
  type Group,
  type GroupOption,
  type MemberRow,
  type Section,
  type SortOption,
  type WeekOption,
} from "./prayerAttendanceTypes";
import { usePrayerAttendanceRecordActions } from "./usePrayerAttendanceRecordActions";
import { PrayerAttendanceRosterView } from "./PrayerAttendanceRosterView";

function toMemberRow(row: Record<string, unknown> & { last_name?: string | null; first_name?: string | null; last_furigana?: string | null; first_furigana?: string | null }): MemberRow {
  return {
    id: row.id as string,
    name: formatMemberName(row),
    furigana: formatMemberFurigana(row) || null,
    district_id: (row.district_id as string) ?? null,
    group_id: (row.group_id as string) ?? null,
    age_group: (row.age_group as Category) ?? null,
    is_baptized: Boolean(row.is_baptized),
    local_member_join_date: (row.local_member_join_date as string) ?? null,
    local_member_leave_date: (row.local_member_leave_date as string) ?? null,
    locality_name: (row as { locality_name?: string }).locality_name,
    district_name: (row as { district_name?: string }).district_name,
    group_name: (row as { group_name?: string }).group_name,
  };
}

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
  const [group1, setGroup1] = useState<GroupOption | "">("attendance");
  const [group2, setGroup2] = useState<GroupOption | "">("");
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setGroup2("");
  }, [isEditMode]);

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memoPopupMemberId, setMemoPopupMemberId] = useState<string | null>(null);
  const { setEditMode: setGlobalEditMode } = useAttendanceEditMode();
  useEffect(() => {
    setGlobalEditMode(isEditMode);
    return () => setGlobalEditMode(false);
  }, [isEditMode, setGlobalEditMode]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);
  const [memberTierMap, setMemberTierMap] = useState<Map<string, "regular" | "semi" | "pool">>(new Map());
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [showDeleteRecordConfirm, setShowDeleteRecordConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

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

  const buildDistrictMemberTierMap = useCallback(
    async (
      supabaseClient: ReturnType<typeof createClient>,
      districtIds: string[],
      members: MemberRow[]
    ): Promise<Map<string, "regular" | "semi" | "pool">> => {
      if (districtIds.length === 0 || members.length === 0) return new Map();
      const [regRes, semiRes, poolRes] = await Promise.all([
        supabaseClient.from("district_regular_list").select("district_id, member_id").in("district_id", districtIds),
        supabaseClient.from("district_semi_regular_list").select("district_id, member_id").in("district_id", districtIds),
        supabaseClient.from("district_pool_list").select("district_id, member_id").in("district_id", districtIds),
      ]);
      const regularByDistrict = new Map<string, Set<string>>();
      const semiByDistrict = new Map<string, Set<string>>();
      const poolByDistrict = new Map<string, Set<string>>();
      ((regRes.data ?? []) as { district_id: string; member_id: string }[]).forEach((r) => {
        if (!regularByDistrict.has(r.district_id)) regularByDistrict.set(r.district_id, new Set());
        regularByDistrict.get(r.district_id)!.add(r.member_id);
      });
      ((semiRes.data ?? []) as { district_id: string; member_id: string }[]).forEach((r) => {
        if (!semiByDistrict.has(r.district_id)) semiByDistrict.set(r.district_id, new Set());
        semiByDistrict.get(r.district_id)!.add(r.member_id);
      });
      ((poolRes.data ?? []) as { district_id: string; member_id: string }[]).forEach((r) => {
        if (!poolByDistrict.has(r.district_id)) poolByDistrict.set(r.district_id, new Set());
        poolByDistrict.get(r.district_id)!.add(r.member_id);
      });
      const map = new Map<string, "regular" | "semi" | "pool">();
      members.forEach((m) => {
        const did = m.district_id ?? "";
        if (regularByDistrict.get(did)?.has(m.id)) map.set(m.id, "regular");
        else if (semiByDistrict.get(did)?.has(m.id)) map.set(m.id, "semi");
        else if (poolByDistrict.get(did)?.has(m.id)) map.set(m.id, "pool");
        else map.set(m.id, "semi");
      });
      return map;
    },
    []
  );

  useEffect(() => {
    if (!districtId || !weekStartIso) {
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
    const isAllDistricts = districtId === "__all__";

    if (isAllDistricts) {
      const districtIdsToLoad = districts.map((d) => d.id).filter((id) => id !== "__all__");
      if (districtIdsToLoad.length === 0) {
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
          .from("prayer_meeting_records")
          .select("id, event_date")
          .in("district_id", districtIdsToLoad)
          .eq("week_start", weekStartIso);
        if (cancelled) return;
        const recordIds = (recordsData ?? []).map((r) => r.id);

        const { data: membersData } = await supabase
          .from("members")
          .select(MEMBERS_SELECT)
          .neq("status", "inactive")
          .neq("status", "tobedeleted")
          .in("district_id", districtIdsToLoad)
          .order("last_furigana");
        if (cancelled) return;
        const refDate = weekStartIso;
        const districtMembers = ((membersData ?? []) as Record<string, unknown>[]).map(toMemberRow).filter((m) =>
          isInEnrollmentPeriod(m, refDate)
        );

        if (recordIds.length === 0) {
          const tierMap = await buildDistrictMemberTierMap(supabase, districtIdsToLoad, districtMembers);
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
          .from("prayer_meeting_attendance")
          .select("id, member_id, memo, is_online, is_away, attended")
          .in("prayer_meeting_record_id", recordIds);
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
            .select(MEMBERS_SELECT)
            .neq("status", "inactive")
            .neq("status", "tobedeleted")
            .in("id", guestIds);
          guests = ((guestData ?? []) as Record<string, unknown>[]).map(toMemberRow);
        }
        const tierMap = await buildDistrictMemberTierMap(supabase, districtIdsToLoad, districtMembers);
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
          .select(MEMBERS_SELECT)
          .neq("status", "inactive")
          .neq("status", "tobedeleted")
          .eq("district_id", districtId)
          .order("last_furigana")
          .then(async (membersRes) => {
            if (cancelled) return;
            const evDate = (existingRecord as { id: string; event_date?: string | null } | null)?.event_date ?? "";
            const refDate = evDate || weekStartIso;
            const districtMembers = ((membersRes.data ?? []) as Record<string, unknown>[]).map(toMemberRow).filter((m) =>
              isInEnrollmentPeriod(m, refDate)
            );
            if (!rid) {
              const tierMap = await buildDistrictMemberTierMap(supabase, [districtId], districtMembers);
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
              .from("prayer_meeting_attendance")
              .select("id, member_id, memo, is_online, is_away, attended")
              .eq("prayer_meeting_record_id", rid)
              .then(async (attRes) => {
                if (cancelled) return;
                const records = (attRes.data ?? []) as AttendanceRow[];
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
                    .select(MEMBERS_SELECT)
                    .neq("status", "inactive")
                    .neq("status", "tobedeleted")
                    .in("id", guestIds);
                  guests = ((guestData ?? []) as Record<string, unknown>[]).map(toMemberRow);
                }
                const tierMap = await buildDistrictMemberTierMap(supabase, [districtId], districtMembers);
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
  }, [districtId, weekStartIso, districts, refreshTrigger]);

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
        `${MEMBERS_SELECT}, districts(name, localities(name)), groups(name)`
      )
      .neq("status", "inactive")
      .neq("status", "tobedeleted")
      .or(`last_furigana.ilike.${patFurigana},first_furigana.ilike.${patFurigana},last_name.ilike.${patName},first_name.ilike.${patName}`)
      .limit(15)
      .then(({ data }) => {
        const rows = (data ?? []).map((row: Record<string, unknown>) => {
          const dist = row.districts as { name?: string; localities?: { name: string }; locality?: { name: string } } | null;
          const r = toMemberRow(row);
          r.district_name = dist?.name;
          r.locality_name = dist?.localities?.name ?? dist?.locality?.name;
          r.group_name = (row.groups as { name: string } | null)?.name;
          return r;
        });
        setSearchResults(rows);
      });
  }, [searchQuery]);

  const refDateForEnrollment = eventDate || weekStartIso;
  const {
    setAttendanceChoice,
    saveMemo,
    toggleOnline,
    addFromSearch,
  } = usePrayerAttendanceRecordActions({
    isEditMode,
    refDateForEnrollment,
    attendanceMap,
    memos,
    setAttendanceMap,
    setMemos,
    setGuestIds,
    setRoster,
    setMessage,
    setSearchQuery,
    setSearchResults,
    setEnrollmentBlockedMemberId,
  });

  const displayRoster = useMemo(() => {
    const base = isEditMode
      ? roster
      : roster.filter((m) => attendanceMap.has(m.id));
    return base;
  }, [isEditMode, roster, attendanceMap]);
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
    const ageOrder = CATEGORY_ORDER;
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
        const order = CATEGORY_ORDER;
        return (order.indexOf(a as Category) >= 0 ? order.indexOf(a as Category) : 999) - (order.indexOf(b as Category) >= 0 ? order.indexOf(b as Category) : 999);
      }
      return a === "believer" ? -1 : 1;
    });
  };
  const group2Options = useMemo(
    () => (Object.keys(GROUP_LABELS) as GroupOption[]).filter((k) => k !== group1),
    [group1]
  );
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

  const performSave = async () => {
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    const isAll = districtId === "__all__";
    try {
      if (isAll) {
        const districtIds = [...new Set(roster.filter((m) => attendanceMap.has(m.id)).map((m) => m.district_id).filter(Boolean))] as string[];
        const recordIdMap: Record<string, string> = {};
        for (const did of districtIds) {
          const rid = await ensurePrayerMeetingRecordForDistrict(did);
          if (rid) recordIdMap[did] = rid;
        }
        for (const [memberId, rec] of attendanceMap) {
          const member = roster.find((m) => m.id === memberId);
          const did = member?.district_id ?? "";
          const rid = recordIdMap[did];
          if (!rid) continue;
          const memo = (memos.get(memberId) ?? "").trim() || null;
          if (rec.id) {
            await supabase
              .from("prayer_meeting_attendance")
              .update({
                attended: rec.attended,
                is_online: rec.is_online ?? false,
                is_away: rec.is_away ?? false,
                memo,
              })
              .eq("id", rec.id);
          } else {
            await supabase.from("prayer_meeting_attendance").insert({
              prayer_meeting_record_id: rid,
              member_id: memberId,
              memo,
              is_online: rec.is_online ?? false,
              is_away: rec.is_away ?? false,
              attended: rec.attended !== false,
              reported_by_user_id: uid,
            });
          }
        }
      } else {
        let rid = recordId;
        if (!rid) {
          rid = await ensurePrayerMeetingRecord(eventDate || undefined);
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
              .from("prayer_meeting_attendance")
              .update({
                attended: rec.attended,
                is_online: rec.is_online ?? false,
                is_away: rec.is_away ?? false,
                memo,
              })
              .eq("id", rec.id);
          } else {
            await supabase.from("prayer_meeting_attendance").insert({
              prayer_meeting_record_id: rid,
              member_id: memberId,
              memo,
              is_online: rec.is_online ?? false,
              is_away: rec.is_away ?? false,
              attended: rec.attended !== false,
              reported_by_user_id: uid,
            });
          }
        }
      }
      setSaving(false);
      setIsEditMode(false);
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
              <div className="flex flex-nowrap items-center justify-end gap-3 py-2 bg-white border-b border-slate-200 -mx-4 px-4 md:-mx-6 md:px-6">
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => performSave()}
                      disabled={saving}
                      className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 touch-target"
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
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-2 sm:gap-3">
                      <div className="flex items-end gap-2 flex-shrink-0">
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
                      </div>
                      {isEditMode && (
                        <div className="w-full sm:min-w-[200px] sm:flex-1 relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="名前で検索（他地区・他地方も可）"
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
          {isAllDistricts && (
                <p className="text-slate-600 text-sm">全ての地区を表示しています。各メンバーの所属地区の集会として出欠を登録・変更できます。</p>
              )}

              <div>
                {loading ? (
                  <p className="text-slate-500 text-sm">読み込み中…</p>
                ) : !isEditMode && displayRoster.length === 0 ? (
                  <p className="text-slate-500 text-sm py-8 text-center">まだ記録はありません。</p>
                ) : (
                  <>
                    <PrayerAttendanceRosterView
                      roster={roster}
                      sections={sections}
                      group1={group1}
                      group2={group2}
                      isEditMode={isEditMode}
                      attendanceMap={attendanceMap}
                      memos={memos}
                      memberTierMap={memberTierMap}
                      guestIds={guestIds}
                      isSectionOpen={isSectionOpen}
                      toggleSectionOpen={toggleSectionOpen}
                      setAttendanceChoice={setAttendanceChoice}
                      toggleOnline={toggleOnline}
                      setMemos={setMemos}
                      saveMemo={saveMemo}
                      setMemoPopupMemberId={setMemoPopupMemberId}
                    />
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
        </>
      )}

      {/* 記録モード時: 保存ボタン（スマホのみ・フッターよりやや上に固定） */}
      {districtId && isEditMode && (
        <div
          className="fixed right-4 z-30 md:hidden bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]"
          aria-hidden
        >
          <button
            type="button"
            onClick={() => performSave()}
            disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 disabled:opacity-50 touch-target"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
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
              placeholder="欠席理由など"
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
                    if (districtId === "__all__") {
                      const { data: records } = await supabase
                        .from("prayer_meeting_records")
                        .select("id")
                        .eq("week_start", weekStartIso);
                      const ids = (records ?? []).map((r: { id: string }) => r.id);
                      if (ids.length > 0) {
                        await supabase.from("prayer_meeting_attendance").delete().in("prayer_meeting_record_id", ids);
                      }
                    } else if (recordId) {
                      await supabase.from("prayer_meeting_attendance").delete().eq("prayer_meeting_record_id", recordId);
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
    </div>
  );
}
