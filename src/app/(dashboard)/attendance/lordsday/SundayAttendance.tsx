"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Toggle } from "@/components/Toggle";
import { PencilButton } from "@/components/PencilButton";
import { formatDateYmd } from "@/lib/weekUtils";
import { getGojuonRowLabel, GOJUON_ROW_LABELS, hiraganaToKatakana, escapeForIlike } from "@/lib/furigana";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import { ensureSundayMeetingsBatch, getSundayMeetingModes, setSundayMeetingMode } from "./actions";
import { isInEnrollmentPeriod } from "@/lib/enrollmentPeriod";
import { useAttendanceEditMode } from "../AttendanceEditModeContext";

type District = { id: string; name: string; locality_id?: string };
type Group = { id: string; name: string; district_id: string };
type SortOption = "furigana" | "district" | "group" | "age_group";
type GroupOption = "district" | "group" | "age_group" | "believer" | "attendance" | "list" | "gojuon";

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
  is_local?: boolean;
  locality_id?: string | null;
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
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [isCombinedPerLocality, setIsCombinedPerLocality] = useState<Record<string, boolean>>({});
  const [memoPopupMemberId, setMemoPopupMemberId] = useState<string | null>(null);
  const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);
  const [showDeleteRecordConfirm, setShowDeleteRecordConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setEditMode: setGlobalEditMode } = useAttendanceEditMode();
  useEffect(() => {
    setGlobalEditMode(isEditMode);
    return () => setGlobalEditMode(false);
  }, [isEditMode, setGlobalEditMode]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [memberTierMap, setMemberTierMap] = useState<Map<string, "regular" | "semi" | "pool">>(new Map());
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());

  const [group1, setGroup1] = useState<GroupOption | "">("attendance");
  const [group2, setGroup2] = useState<GroupOption | "">("");

  const savedSnapshotRef = useRef<{ attendance: Map<string, AttendanceRow>; memos: Map<string, string> } | null>(null);
  const isMemberDirty = useCallback(
    (memberId: string) => {
      const snap = savedSnapshotRef.current;
      if (!snap) return false;
      const cur = attendanceMap.get(memberId);
      const curMemo = memos.get(memberId) ?? "";
      const savedRec = snap.attendance.get(memberId);
      const savedMemo = snap.memos.get(memberId) ?? "";
      if (!cur && !savedRec) return curMemo !== savedMemo;
      if (!cur || !savedRec) return true;
      return (
        cur.attended !== savedRec.attended ||
        cur.is_online !== savedRec.is_online ||
        cur.is_away !== savedRec.is_away ||
        curMemo !== savedMemo
      );
    },
    [attendanceMap, memos]
  );
  const dirtyMemberIds = useMemo(() => {
    if (!isEditMode || !savedSnapshotRef.current) return new Set<string>();
    const set = new Set<string>();
    roster.forEach((m) => {
      if (isMemberDirty(m.id)) set.add(m.id);
    });
    attendanceMap.forEach((_, id) => {
      if (isMemberDirty(id)) set.add(id);
    });
    memos.forEach((_, id) => {
      if (isMemberDirty(id)) set.add(id);
    });
    return set;
  }, [isEditMode, roster, attendanceMap, memos, isMemberDirty]);

  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const saveFromUnsavedDialogRef = useRef(false);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditMode && dirtyMemberIds.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isEditMode, dirtyMemberIds.size]);

  useEffect(() => {
    setGroup2(isEditMode ? "list" : "");
  }, [isEditMode]);

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
      .from("lordsday_meeting_records")
      .select("id")
      .eq("event_date", sundayIso)
      .eq("meeting_type", "main")
      .eq("district_id", did)
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("lordsday_meeting_records")
      .insert({
        event_date: sundayIso,
        meeting_type: "main",
        district_id: did,
        name: name || "主日集会",
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      const { data: existingRow } = await supabase
        .from("lordsday_meeting_records")
        .select("id")
        .eq("event_date", sundayIso)
        .eq("meeting_type", "main")
        .eq("district_id", did)
        .maybeSingle();
      return existingRow?.id ?? null;
    }
    if (error) return null;
    return created?.id ?? null;
  }, [sundayIso, districts]);

  const ensureMeeting = useCallback(async () => {
    if (!districtId || !sundayIso || districtId === "__all__") return null;
    return ensureMeetingForDistrict(districtId);
  }, [districtId, sundayIso, ensureMeetingForDistrict]);

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
    if (!districtId || !sundayIso) {
      setMeetingId(null);
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
    const district = districts.find((d) => d.id === districtId);
    const lid = district?.locality_id;
    const isCombined = lid ? (isCombinedPerLocality[lid] ?? false) : false;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "SundayAttendance.tsx:useEffect",
        message: "load branch",
        data: {
          districtId,
          sundayIso,
          isAllDistricts,
          isCombined,
          branch: isAllDistricts ? "all" : lid && isCombined ? "combined" : "single",
          districtsLen: districts.length,
        },
        timestamp: Date.now(),
        hypothesisId: "H5",
      }),
    }).catch(() => {});
    // #endregion

    const resolveBestMeetingMapForDistricts = async (targetDistrictIds: string[]) => {
      if (targetDistrictIds.length === 0) return {} as Record<string, string>;
      const { data: meetingRows } = await supabase
        .from("lordsday_meeting_records")
        .select("id, district_id")
        .eq("event_date", sundayIso)
        .eq("meeting_type", "main")
        .in("district_id", targetDistrictIds);
      const rows = (meetingRows ?? []) as { id: string; district_id: string | null }[];
      const byDistrict = new Map<string, string[]>();
      rows.forEach((r) => {
        if (!r.district_id) return;
        if (!byDistrict.has(r.district_id)) byDistrict.set(r.district_id, []);
        byDistrict.get(r.district_id)!.push(r.id);
      });
      const allMeetingIds = rows.map((r) => r.id);
      const countByMeeting = new Map<string, number>();
      if (allMeetingIds.length > 0) {
        const { data: attRows } = await supabase
          .from("lordsday_meeting_attendance")
          .select("meeting_id")
          .in("meeting_id", allMeetingIds);
        ((attRows ?? []) as { meeting_id: string }[]).forEach((r) => {
          countByMeeting.set(r.meeting_id, (countByMeeting.get(r.meeting_id) ?? 0) + 1);
        });
      }
      const result: Record<string, string> = {};
      targetDistrictIds.forEach((did) => {
        const ids = byDistrict.get(did) ?? [];
        if (ids.length === 0) return;
        const chosen = [...ids].sort((a, b) => (countByMeeting.get(b) ?? 0) - (countByMeeting.get(a) ?? 0))[0];
        if (chosen) result[did] = chosen;
      });
      return result;
    };

    if (isAllDistricts) {
      const districtIdsToLoad = districts.map((d) => d.id).filter((id) => id !== "__all__");
      if (districtIdsToLoad.length === 0) {
        setMeetingId(null);
        setRoster([]);
        setGuestIds(new Set());
        setAttendanceMap(new Map());
        setMemos(new Map());
        setLoading(false);
        return;
      }
      (async () => {
        const meetingIdMap = await resolveBestMeetingMapForDistricts(districtIdsToLoad);
        const meetingIds = districtIdsToLoad.map((did) => meetingIdMap[did]).filter(Boolean);
        if (cancelled) return;
        setMeetingId(null);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "SundayAttendance.tsx:allDistrictLoad",
            message: "resolved meetings for all districts",
            data: { sundayIso, districtIdsToLoad, meetingIdMap, meetingIdsCount: meetingIds.length, runId: "post-fix" },
            timestamp: Date.now(),
            hypothesisId: "H14",
          }),
        }).catch(() => {});
        // #endregion

        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date")
          .in("district_id", districtIdsToLoad)
          .order("name");
        if (cancelled) return;
        const districtMembers = ((membersData ?? []) as MemberRow[]).filter((m) =>
          isInEnrollmentPeriod(m, sundayIso)
        );

        if (meetingIds.length === 0) {
          const tierMap = await buildDistrictMemberTierMap(supabase, districtIdsToLoad, districtMembers);
          if (cancelled) return;
          setMemberTierMap(tierMap);
          setGuestIds(new Set());
          setRoster(districtMembers);
          setAttendanceMap(new Map());
          setMemos(new Map());
          setLoading(false);
          return;
        }

        const { data: attData } = await supabase
          .from("lordsday_meeting_attendance")
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
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date")
          .in("id", guestIds);
        guests = (guestData ?? []) as MemberRow[];
      }
        const tierMap = await buildDistrictMemberTierMap(supabase, districtIdsToLoad, districtMembers);
        if (cancelled) return;
        setMemberTierMap(tierMap);
        setGuestIds(new Set(guestIds));
        setRoster([...districtMembers, ...guests]);
        setAttendanceMap(map);
        setMemos(memoMap);
        setLoading(false);
      })().catch((err) => {
        if (!cancelled) {
          setLoading(false);
          setRoster([]);
          setAttendanceMap(new Map());
          setMemos(new Map());
        }
        console.error("SundayAttendance all-districts load:", err);
      });
      return () => {
        cancelled = true;
      };
    }

    if (lid && isCombined) {
      const districtsInLocality = districts.filter((d) => d.locality_id === lid && d.id !== "__all__");
      const districtIdsInLocality = districtsInLocality.map((d) => d.id);
      if (districtIdsInLocality.length === 0) {
        setMeetingId(null);
        setRoster([]);
        setGuestIds(new Set());
        setAttendanceMap(new Map());
        setMemos(new Map());
        setLoading(false);
        return;
      }
      (async () => {
        const meetingIdMap = await resolveBestMeetingMapForDistricts(districtIdsInLocality);
        const meetingIds = districtIdsInLocality.map((did) => meetingIdMap[did]).filter(Boolean);
        if (cancelled) return;
        setMeetingId(meetingIdMap[districtId] ?? null);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "SundayAttendance.tsx:combinedLoad",
            message: "resolved meetings for combined locality load",
            data: { sundayIso, districtIdsInLocality, meetingIdMap, meetingIdsCount: meetingIds.length, runId: "post-fix" },
            timestamp: Date.now(),
            hypothesisId: "H15",
          }),
        }).catch(() => {});
        // #endregion
        const { data: membersData } = await supabase
          .from("members")
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date")
          .in("district_id", districtIdsInLocality)
          .order("name");
        if (cancelled) return;
        const districtMembers = ((membersData ?? []) as MemberRow[]).filter((m) =>
          isInEnrollmentPeriod(m, sundayIso)
        );
        if (meetingIds.length === 0) {
          const tierMap = await buildDistrictMemberTierMap(supabase, districtIdsInLocality, districtMembers);
          if (cancelled) return;
          setMemberTierMap(tierMap);
          setGuestIds(new Set());
          setRoster(districtMembers);
          setAttendanceMap(new Map());
          setMemos(new Map());
          setLoading(false);
          return;
        }
        const { data: attData } = await supabase
          .from("lordsday_meeting_attendance")
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
            .select("id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date")
            .in("id", guestIds);
          guests = (guestData ?? []) as MemberRow[];
        }
        const tierMap = await buildDistrictMemberTierMap(supabase, districtIdsInLocality, districtMembers);
        if (cancelled) return;
        setMemberTierMap(tierMap);
        setGuestIds(new Set(guestIds));
        setRoster([...districtMembers, ...guests]);
        setAttendanceMap(map);
        setMemos(memoMap);
        setLoading(false);
      })().catch((err) => {
        if (!cancelled) {
          setLoading(false);
          setRoster([]);
          setAttendanceMap(new Map());
          setMemos(new Map());
        }
        console.error("SundayAttendance combined load:", err);
      });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const district = districts.find((d) => d.id === districtId);
      const lid = district?.locality_id;
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "SundayAttendance.tsx:singleDistrictLoad",
          message: "single district load entry",
          data: {
            districtId,
            sundayIso,
            districtFound: !!district,
            districtIdMatch: district?.id === districtId,
            branch: "singleDistrictNonCombined",
          },
          timestamp: Date.now(),
          hypothesisId: "H1,H3",
        }),
      }).catch(() => {});
      // #endregion
      const { data: existingMeetingsData } = await supabase
        .from("lordsday_meeting_records")
        .select("id")
        .eq("event_date", sundayIso)
        .eq("meeting_type", "main")
        .eq("district_id", districtId);
      const existingMeetingIds = ((existingMeetingsData ?? []) as { id: string }[]).map((m) => m.id);
      let mid: string | null = null;
      if (existingMeetingIds.length === 1) {
        mid = existingMeetingIds[0];
      } else if (existingMeetingIds.length > 1) {
        const { data: attRows } = await supabase
          .from("lordsday_meeting_attendance")
          .select("meeting_id")
          .in("meeting_id", existingMeetingIds);
        const countByMeeting = new Map<string, number>();
        ((attRows ?? []) as { meeting_id: string }[]).forEach((r) => {
          countByMeeting.set(r.meeting_id, (countByMeeting.get(r.meeting_id) ?? 0) + 1);
        });
        mid = [...existingMeetingIds]
          .sort((a, b) => (countByMeeting.get(b) ?? 0) - (countByMeeting.get(a) ?? 0))[0] ?? null;
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "SundayAttendance.tsx:duplicateMeetingResolution",
            message: "resolved duplicate meetings for single district",
            data: {
              districtId,
              sundayIso,
              existingMeetingIds,
              chosenMeetingId: mid,
              counts: Object.fromEntries(existingMeetingIds.map((id) => [id, countByMeeting.get(id) ?? 0])),
              runId: "post-fix",
            },
            timestamp: Date.now(),
            hypothesisId: "H13",
          }),
        }).catch(() => {});
        // #endregion
      }
      if (cancelled) return;
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "SundayAttendance.tsx:afterBatch",
          message: "after ensureSundayMeetingsBatch",
          data: {
            districtId,
            meetingIdMapKeys: existingMeetingIds,
            mid,
            mapLen: existingMeetingIds.length,
          },
          timestamp: Date.now(),
          hypothesisId: "H1,H2",
        }),
      }).catch(() => {});
      // #endregion
      setMeetingId(mid);
      const { data: membersRes } = await supabase
        .from("members")
        .select("id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date")
        .eq("district_id", districtId)
        .order("name");
      if (cancelled) return;
      const districtMembers = ((membersRes ?? []) as MemberRow[]).filter((m) =>
        isInEnrollmentPeriod(m, sundayIso)
      );
      if (!mid) {
        const tierMap = await buildDistrictMemberTierMap(supabase, [districtId], districtMembers);
        if (cancelled) return;
        setMemberTierMap(tierMap);
        setGuestIds(new Set());
        setRoster(districtMembers);
        setAttendanceMap(new Map());
        setMemos(new Map());
        setLoading(false);
        return;
      }
      let { data: attData } = await supabase
        .from("lordsday_meeting_attendance")
        .select("id, member_id, memo, is_online, is_away, attended")
        .eq("meeting_id", mid);
      if (cancelled) return;
      let records = (attData ?? []) as AttendanceRow[];
      if (records.length === 0) {
        const { data: directMeeting } = await supabase
          .from("lordsday_meeting_records")
          .select("id")
          .eq("event_date", sundayIso)
          .eq("meeting_type", "main")
          .eq("district_id", districtId)
          .maybeSingle();
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "SundayAttendance.tsx:directMeetingProbe",
            message: "direct meeting probe result",
            data: { districtId, sundayIso, mid, directMeetingId: directMeeting?.id ?? null, runId: "post-fix" },
            timestamp: Date.now(),
            hypothesisId: "H6",
          }),
        }).catch(() => {});
        // #endregion
        if (directMeeting?.id && directMeeting.id !== mid) {
          // #region agent log
          fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "SundayAttendance.tsx:fallbackUsed",
              message: "direct meeting fallback",
              data: { districtId, sundayIso, mid, directMeetingId: directMeeting.id, runId: "post-fix" },
              timestamp: Date.now(),
              hypothesisId: "fallback",
            }),
          }).catch(() => {});
          // #endregion
          const { data: directAtt } = await supabase
            .from("lordsday_meeting_attendance")
            .select("id, member_id, memo, is_online, is_away, attended")
            .eq("meeting_id", directMeeting.id);
          if (cancelled) return;
          records = (directAtt ?? []) as AttendanceRow[];
        } else if (records.length === 0 && lid) {
          const { data: localityMeeting } = await supabase
            .from("lordsday_meeting_records")
            .select("id")
            .eq("event_date", sundayIso)
            .eq("meeting_type", "main")
            .is("district_id", null)
            .eq("locality_id", lid)
            .maybeSingle();
          // #region agent log
          fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "SundayAttendance.tsx:localityMeetingProbe",
              message: "locality meeting probe result",
              data: { districtId, sundayIso, lid, localityMeetingId: localityMeeting?.id ?? null, runId: "post-fix" },
              timestamp: Date.now(),
              hypothesisId: "H7",
            }),
          }).catch(() => {});
          // #endregion
          if (localityMeeting?.id) {
            const { data: locAtt } = await supabase
              .from("lordsday_meeting_attendance")
              .select("id, member_id, memo, is_online, is_away, attended")
              .eq("meeting_id", localityMeeting.id);
            if (cancelled) return;
            const locRecords = (locAtt ?? []) as AttendanceRow[];
            const districtMemberIds = new Set(districtMembers.map((m) => m.id));
            records = locRecords.filter((r) => districtMemberIds.has(r.member_id));
          }
        }
      }
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "SundayAttendance.tsx:afterAttLoad",
          message: "after attendance load",
          data: {
            districtId,
            mid,
            recordsCount: records.length,
            rosterCount: districtMembers.length,
            displayRosterWouldBe: records.length,
            runId: "post-fix",
          },
          timestamp: Date.now(),
          hypothesisId: "H2,H4",
        }),
      }).catch(() => {});
      // #endregion
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
          .select("id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date")
          .in("id", guestIds);
        guests = (guestData ?? []) as MemberRow[];
      }
      const tierMap = await buildDistrictMemberTierMap(supabase, [districtId], districtMembers);
      if (cancelled) return;
      setMemberTierMap(tierMap);
      setGuestIds(new Set(guestIds));
      setRoster([...districtMembers, ...guests]);
      setAttendanceMap(map);
      setMemos(memoMap);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [districtId, sundayIso, districts, refreshTrigger, isCombinedPerLocality]);

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
        new Map(prev).set(memberId, {
          ...rec,
          attended,
          is_online: attended ? (rec.is_online ?? false) : false,
          is_away: attended ? (rec.is_away ?? false) : false,
          memo: memoVal || null,
        })
      );
    } else {
      setAttendanceMap((prev) =>
        new Map(prev).set(memberId, {
          id: "",
          member_id: memberId,
          memo: null,
          is_online: false,
          is_away: false,
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
    const q = searchQuery.trim();
    const qKata = hiraganaToKatakana(q);
    const patFurigana = `%${escapeForIlike(qKata)}%`;
    const patName = `%${escapeForIlike(q)}%`;
    const supabase = createClient();
    supabase
      .from("members")
      .select(
        "id, name, furigana, district_id, group_id, age_group, is_baptized, locality_id, local_member_join_date, local_member_leave_date, districts(name, localities(name)), groups(name)"
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
            locality_id: (row.locality_id as string | null) ?? null,
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
    setGuestIds((prev) => new Set([...prev, member.id]));
    setRoster((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
    setSearchQuery("");
    setSearchResults([]);
  };

  const hasAttendanceData = useCallback(
    (memberId: string): boolean => {
      const rec = attendanceMap.get(memberId);
      if (!rec) return false;
      return (
        rec.attended === true ||
        rec.is_online === true ||
        rec.is_away === true ||
        ((memos.get(memberId) ?? "").trim() !== "")
      );
    },
    [attendanceMap, memos]
  );

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

  const performSave = async () => {
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
    if (isAll) {
      const meetingIdMap = await ensureSundayMeetingsBatch(sundayIso, districts, isCombinedPerLocality);
      for (const [, rec] of attendanceMap) {
        const member = roster.find((m) => m.id === rec.member_id);
        const did = member?.district_id ?? "";
        const meetId = did ? meetingIdMap[did] : null;
        if (!meetId) continue;
        const meetingLocalityId = did ? districts.find((d) => d.id === did)?.locality_id : null;
        const recordedIsLocal = Boolean(member?.locality_id != null && meetingLocalityId != null && member.locality_id === meetingLocalityId);
        if (rec.id) {
          await supabase.from("lordsday_meeting_attendance").upsert({
            id: rec.id,
            meeting_id: meetId,
            member_id: rec.member_id,
            memo: memos.get(rec.member_id) || null,
            is_online: rec.is_online ?? false,
            is_away: rec.is_away ?? false,
            attended: rec.attended ?? true,
            recorded_is_local: recordedIsLocal,
          }, { onConflict: "id" });
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("lordsday_meeting_attendance").insert({
            meeting_id: meetId,
            member_id: rec.member_id,
            recorded_category: member?.age_group ?? null,
            recorded_is_baptized: Boolean(member?.is_baptized),
            recorded_is_local: recordedIsLocal,
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
      const currentLocalityId = localityId ?? districts.find((d) => d.id === districtId)?.locality_id ?? null;
      const meetingIdMap =
        localityId && isCombined
          ? await ensureSundayMeetingsBatch(
              sundayIso,
              districts.filter((d) => d.locality_id === localityId && d.id !== "__all__"),
              { [localityId]: true }
            )
          : { [districtId]: mid };
      for (const [, rec] of attendanceMap) {
        const member = roster.find((m) => m.id === rec.member_id);
        const meetId = meetingIdMap[member?.district_id ?? ""] ?? mid;
        const recordedIsLocal = Boolean(currentLocalityId != null && member?.locality_id != null && member.locality_id === currentLocalityId);
        if (rec.id) {
          await supabase.from("lordsday_meeting_attendance").update({
            meeting_id: meetId,
            memo: memos.get(rec.member_id) || null,
            is_online: rec.is_online ?? false,
            is_away: rec.is_away ?? false,
            attended: rec.attended ?? true,
            recorded_is_local: recordedIsLocal,
          }).eq("id", rec.id);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("lordsday_meeting_attendance").insert({
            meeting_id: meetId,
            member_id: rec.member_id,
            recorded_category: member?.age_group ?? null,
            recorded_is_baptized: Boolean(member?.is_baptized),
            recorded_is_local: recordedIsLocal,
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
    setMessage("保存しました。");
    setRefreshTrigger((t) => t + 1);
    savedSnapshotRef.current = { attendance: new Map(attendanceMap), memos: new Map(memos) };
    if (saveFromUnsavedDialogRef.current) {
      saveFromUnsavedDialogRef.current = false;
      setShowUnsavedConfirm(false);
    }
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
          </div>
          <div className="flex flex-nowrap items-center justify-between gap-3 py-2 bg-white border-b border-slate-200 -mx-4 px-4 md:-mx-6 md:px-6">
            <div className="flex flex-nowrap items-center gap-3 min-w-0 shrink-0">
              {showCombinedToggle && isEditMode && (
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
                        if (dirtyMemberIds.size > 0) {
                          setShowUnsavedConfirm(true);
                          return;
                        }
                        savedSnapshotRef.current = null;
                        setIsEditMode(false);
                        setMessage("");
                      } else {
                        savedSnapshotRef.current = { attendance: new Map(attendanceMap), memos: new Map(memos) };
                        setIsEditMode(true);
                      }
                    }}
                    disabled={saving}
                    className={`px-4 py-2 text-sm font-medium touch-target rounded-l-lg transition-colors disabled:opacity-50 ${
                      !isEditMode
                        ? "bg-primary-600 text-white"
                        : "bg-transparent text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    閲覧
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditMode) {
                        savedSnapshotRef.current = { attendance: new Map(attendanceMap), memos: new Map(memos) };
                        setIsEditMode(true);
                        } else {
                        if (dirtyMemberIds.size > 0) {
                          setShowUnsavedConfirm(true);
                          return;
                        }
                        savedSnapshotRef.current = null;
                        setIsEditMode(false);
                        setMessage("");
                      }
                    }}
                    disabled={saving}
                    className={`px-4 py-2 text-sm font-medium touch-target rounded-r-lg transition-colors disabled:opacity-50 ${
                      isEditMode
                        ? "bg-primary-600 text-white"
                        : "bg-transparent text-slate-700 hover:bg-slate-100"
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
                              const outOfEnrollment = !isInEnrollmentPeriod(m, sundayIso);
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

          <div>
            {loading ? (
              <p className="text-slate-500 text-sm">読み込み中…</p>
            ) : !isEditMode && displayRoster.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">まだ記録はありません。</p>
            ) : (
              <>
                <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {isEditMode && <th className="w-6 px-1 py-1.5" aria-label="変更" />}
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase max-w-[9rem]">名前</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase min-w-[3.75rem] w-14 sm:w-24 whitespace-nowrap">出欠({[...attendanceMap.values()].filter((r) => r.attended !== false).length})</th>
                        <th className="px-1 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-16 sm:w-24 whitespace-nowrap">ｵﾝﾗｲﾝ({[...attendanceMap.values()].filter((r) => r.attended !== false && r.is_online).length})</th>
                        <th className="px-1 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-[4.5rem] sm:w-24 whitespace-nowrap">他地方({[...attendanceMap.values()].filter((r) => r.attended !== false && r.is_away).length})</th>
                        <th className={`px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto ${!isEditMode ? "hidden sm:table-cell" : ""}`}><span className="hidden sm:inline">メモ</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {roster.length === 0 && (
                        <tr>
                          <td colSpan={isEditMode ? 6 : 5} className="px-3 py-4 text-center text-slate-500 text-sm">
                            名簿がありません
                          </td>
                        </tr>
                      )}
                      {sections.map((section, idx) => {
                        const hasGroup1 = Boolean(group1 && section.group1Key);
                        const hasGroup2 = Boolean(group2);
                        const g1Key = `g1-${section.group1Key}`;
                        const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
                        const sectionMemberIds = section.subsections.flatMap((s) => s.members.map((m) => m.id));
                        const sectionAttendedCount = sectionMemberIds.filter((id) => {
                          const r = attendanceMap.get(id);
                          return r && r.attended !== false;
                        }).length;
                        const sectionAbsentCount = sectionMemberIds.filter((id) => {
                          const r = attendanceMap.get(id);
                          return r && r.attended === false;
                        }).length;
                        const sectionUnrecordedCount = sectionMemberIds.filter((id) => !attendanceMap.has(id)).length;
                        const sectionDisplayCount =
                          group1 === "attendance"
                            ? section.group1Key === "absent"
                              ? sectionAbsentCount
                              : section.group1Key === "unrecorded"
                                ? sectionUnrecordedCount
                                : sectionAttendedCount
                            : sectionAttendedCount;
                        const sectionOnlineCount = sectionMemberIds.filter((id) => {
                          const r = attendanceMap.get(id);
                          return r && r.attended !== false && r.is_online;
                        }).length;
                        const sectionAwayCount = sectionMemberIds.filter((id) => {
                          const r = attendanceMap.get(id);
                          return r && r.attended !== false && r.is_away;
                        }).length;
                        return (
                        <Fragment key={`s-${section.group1Key}-${idx}`}>
                          {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                            <tr className="bg-gray-800">
                              <td colSpan={isEditMode ? 6 : 5} className="px-3 py-0">
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
                              {isEditMode && <th className="w-6 px-1 py-1" aria-hidden />}
                              <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase max-w-[9rem]">名前</th>
                              <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase min-w-[3.75rem] w-14 sm:w-24 whitespace-nowrap">出欠({sectionDisplayCount})</th>
                              <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-16 sm:w-24 whitespace-nowrap">ｵﾝﾗｲﾝ({sectionOnlineCount})</th>
                              <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-[4.5rem] sm:w-24 whitespace-nowrap">他地方({sectionAwayCount})</th>
                              <th className={`px-2 py-1 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto ${!isEditMode ? "hidden sm:table-cell" : ""}`}><span className="hidden sm:inline">メモ</span></th>
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
                                    <td colSpan={isEditMode ? 6 : 5} className="px-3 py-0 pl-6">
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
                                    {isEditMode && <th className="w-6 px-1 py-1 pl-6" aria-hidden />}
                                    <th className="px-3 py-1 pl-6 text-left text-xs font-medium text-slate-500 uppercase max-w-[9rem]">名前</th>
                                    <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase min-w-[3.75rem] w-14 sm:w-24 whitespace-nowrap">出欠({(() => {
                                      const subAttended = sub.members.filter((m) => {
                                        const r = attendanceMap.get(m.id);
                                        return r && r.attended !== false;
                                      }).length;
                                      if (group1 !== "attendance") return subAttended;
                                      if (section.group1Key === "absent") {
                                        return sub.members.filter((m) => {
                                          const r = attendanceMap.get(m.id);
                                          return r && r.attended === false;
                                        }).length;
                                      }
                                      if (section.group1Key === "unrecorded") {
                                        return sub.members.filter((m) => !attendanceMap.has(m.id)).length;
                                      }
                                      return subAttended;
                                    })()})</th>
                                    <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-16 sm:w-24 whitespace-nowrap">ｵﾝﾗｲﾝ({sub.members.filter((m) => {
                                      const r = attendanceMap.get(m.id);
                                      return r && r.attended !== false && r.is_online;
                                    }).length})</th>
                                    <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-[4.5rem] sm:w-24 whitespace-nowrap">他地方({sub.members.filter((m) => {
                                      const r = attendanceMap.get(m.id);
                                      return r && r.attended !== false && r.is_away;
                                    }).length})</th>
                                    <th className={`px-2 py-1 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto ${!isEditMode ? "hidden sm:table-cell" : ""}`}><span className="hidden sm:inline">メモ</span></th>
                                  </tr>
                                )}
                                {(!hasSubHeader || g2Open) && sub.members.map((m) => {
                      const rec = attendanceMap.get(m.id);
                      const attended = Boolean(rec && rec.attended !== false);
                      const unrecorded = !rec;
                      const isOnline = rec?.is_online ?? false;
                      const isAway = rec?.is_away ?? false;
                      const memo = memos.get(m.id) ?? "";
                      const memoPlaceholder = isAway ? "出席した地方を記載してください" : "欠席理由など";
                      const tier = memberTierMap.get(m.id);
                      const rowBgClass = tier === "semi" ? "bg-amber-50 hover:bg-amber-100" : tier === "pool" ? "bg-sky-50 hover:bg-sky-100" : "hover:bg-slate-50";
                      return (
                        <Fragment key={m.id}>
                        <tr className={rowBgClass}>
                          {isEditMode && (
                            <td className="px-1 py-0.5 text-red-600 text-center w-6" title={dirtyMemberIds.has(m.id) ? "変更あり" : undefined}>
                              {dirtyMemberIds.has(m.id) ? "●" : ""}
                            </td>
                          )}
                          <td className="px-3 py-0.5 text-slate-800 text-sm max-w-[9rem] min-w-0">
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              {isEditMode ? (
                                <span className={`min-w-0 truncate ${guestIds.has(m.id) ? "text-slate-400" : ""}`}>{m.name}</span>
                              ) : (
                                <Link href={`/members/${m.id}`} className={`min-w-0 truncate text-primary-600 hover:underline ${guestIds.has(m.id) ? "text-slate-400" : ""}`}>
                                  {m.name}
                                </Link>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-0.5 text-left">
                            {isEditMode ? (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setAttendanceChoice(m.id, m, "unrecorded")}
                                  className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium p-0 ${unrecorded ? "border-amber-400 bg-amber-100 text-slate-600 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-300"}`}
                                  aria-label={`${m.name}を記録なしに`}
                                  title="記録なし"
                                >
                                  ー
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAttendanceChoice(m.id, m, "present")}
                                  className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium p-0 ${attended ? "border-primary-400 bg-primary-100 text-primary-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-primary-50 hover:border-primary-400"}`}
                                  aria-label={`${m.name}を出席に`}
                                  title="出席"
                                >
                                  ○
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAttendanceChoice(m.id, m, "absent")}
                                  className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium p-0 ${!attended && !unrecorded ? "border-amber-400 bg-amber-100 text-amber-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-400"}`}
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
                          <td className="px-1 py-0.5 align-middle text-left">
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
                            ) : isEditMode ? (
                              <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}のオンライン`} />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-1 py-0.5 align-middle text-left">
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
                            ) : isEditMode ? (
                              <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}の他地方`} />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className={`px-2 py-0.5 align-top ${!isEditMode ? "hidden sm:table-cell" : ""}`}>
                            {isEditMode ? (
                              <>
                                <div className="sm:hidden">
                                  <PencilButton
                                    aria-label="メモを編集"
                                    onClick={() => setMemoPopupMemberId(m.id)}
                                  />
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
                          <tr className="sm:hidden [border-top:0]">
                            <td colSpan={5} className="pl-4 pr-3 py-0.5 pb-1 text-xs text-slate-500 [border-top:0]">
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

                {/* スマホ用カード表示（D案） */}
                <div className="block sm:hidden border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {roster.length === 0 ? (
                    <p className="px-3 py-4 text-center text-slate-500 text-sm">名簿がありません</p>
                  ) : (
                    <div>
                      {/* 列タイトル（グルーピングなし時用） */}
                      {!group1 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex-nowrap min-w-0">
                          <span className="text-xs font-medium text-slate-500 uppercase min-w-0 truncate max-w-[50%]">名前</span>
                          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0 text-xs font-medium text-slate-500 uppercase">
                            <span>出欠</span>
                            <span>ｵﾝﾗｲﾝ</span>
                            <span>他地方</span>
                            <span>メモ</span>
                          </div>
                        </div>
                      )}
                      {sections.map((section, idx) => {
                      const hasGroup1 = Boolean(group1 && section.group1Key);
                      const hasGroup2 = Boolean(group2);
                      const g1Key = `g1-${section.group1Key}`;
                      const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
                      return (
                        <Fragment key={`card-s-${section.group1Key}-${idx}`}>
                          {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                            <div className="bg-gray-800">
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
                            </div>
                          )}
                          {hasGroup1 && g1Open && section.subsections.some((s) => s.members.length > 0) && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex-nowrap min-w-0">
                              <span className="text-xs font-medium text-slate-500 uppercase min-w-0 truncate max-w-[50%]">名前</span>
                              <div className="flex items-center gap-1.5 ml-auto flex-shrink-0 text-xs font-medium text-slate-500 uppercase">
                                <span>出欠</span>
                                <span>ｵﾝﾗｲﾝ</span>
                                <span>他地方</span>
                                <span>メモ</span>
                              </div>
                            </div>
                          )}
                          {(hasGroup1 ? g1Open : true) &&
                            section.subsections.map((sub, subIdx) => {
                              const hasSubHeader = hasGroup2 && sub.group2Key;
                              const g2Key = hasSubHeader ? `g1-${section.group1Key}::g2-${sub.group2Key}` : "";
                              const g2Open = g2Key ? isSectionOpen(g2Key) : true;
                              return (
                                <Fragment key={`card-sub-${section.group1Key}-${sub.group2Key}-${subIdx}`}>
                                  {hasSubHeader && sub.members.length > 0 && (
                                    <div className="bg-gray-500">
                                      <button
                                        type="button"
                                        onClick={() => toggleSectionOpen(g2Key)}
                                        className="w-full flex items-center justify-between px-3 py-1 pl-6 text-left text-sm font-medium text-white hover:bg-gray-400 touch-target"
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
                                    </div>
                                  )}
                                  {(!hasSubHeader || g2Open) &&
                                    sub.members.map((m) => {
                                      const rec = attendanceMap.get(m.id);
                                      const attended = Boolean(rec && rec.attended !== false);
                                      const unrecorded = !rec;
                                      const isOnline = rec?.is_online ?? false;
                                      const isAway = rec?.is_away ?? false;
                                      const memo = memos.get(m.id) ?? "";
                                      const tier = memberTierMap.get(m.id);
                                      const cardBgClass =
                                        tier === "semi" ? "bg-amber-50" : tier === "pool" ? "bg-sky-50" : "bg-white";
                                      return (
                                        <div
                                          key={m.id}
                                          className={`border-b border-slate-200 last:border-b-0 ${cardBgClass}`}
                                        >
                                          <div className="flex items-center gap-1.5 px-3 py-2 flex-nowrap min-w-0">
                                            {isEditMode && dirtyMemberIds.has(m.id) && (
                                              <span className="text-red-600 flex-shrink-0" title="変更あり">●</span>
                                            )}
                                            <span
                                              className={`min-w-0 truncate text-slate-800 text-sm text-left flex-shrink max-w-[50%] ${guestIds.has(m.id) ? "text-slate-400" : ""}`}
                                            >
                                              {isEditMode ? (
                                                m.name
                                              ) : (
                                                <Link
                                                  href={`/members/${m.id}`}
                                                  className="text-primary-600 hover:underline truncate block"
                                                >
                                                  {m.name}
                                                </Link>
                                              )}
                                            </span>
                                            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                                            {isEditMode ? (
                                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() => setAttendanceChoice(m.id, m, "unrecorded")}
                                                  className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-medium p-0 ${unrecorded ? "border-amber-400 bg-amber-100 text-slate-600 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-300"}`}
                                                  aria-label={`${m.name}を記録なしに`}
                                                >
                                                  ー
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setAttendanceChoice(m.id, m, "present")}
                                                  className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-medium p-0 ${attended ? "border-primary-400 bg-primary-100 text-primary-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-primary-50 hover:border-primary-400"}`}
                                                  aria-label={`${m.name}を出席に`}
                                                >
                                                  ○
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setAttendanceChoice(m.id, m, "absent")}
                                                  className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-medium p-0 ${!attended && !unrecorded ? "border-amber-400 bg-amber-100 text-amber-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-400"}`}
                                                  aria-label={`${m.name}を欠席に`}
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            ) : (
                                              <span
                                                className={`flex-shrink-0 ${attended ? "text-primary-600" : unrecorded ? "text-slate-400" : "text-slate-400"}`}
                                              >
                                                {attended ? "○" : unrecorded ? "ー" : "×"}
                                              </span>
                                            )}
                                            {attended ? (
                                              isEditMode ? (
                                                <Toggle
                                                  checked={isOnline}
                                                  onChange={() => toggleOnline(m.id)}
                                                  ariaLabel={`${m.name}のオンライン`}
                                                />
                                              ) : (
                                                <span className="text-slate-400 flex-shrink-0">{isOnline ? "○" : "—"}</span>
                                              )
                                            ) : isEditMode ? (
                                              <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}のオンライン`} />
                                            ) : (
                                              <span className="text-slate-300 flex-shrink-0">—</span>
                                            )}
                                            {attended ? (
                                              isEditMode ? (
                                                <Toggle
                                                  checked={isAway}
                                                  onChange={() => toggleIsAway(m.id)}
                                                  ariaLabel={`${m.name}の他地方`}
                                                />
                                              ) : (
                                                <span className="text-slate-400 flex-shrink-0">{isAway ? "○" : "—"}</span>
                                              )
                                            ) : isEditMode ? (
                                              <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}の他地方`} />
                                            ) : (
                                              <span className="text-slate-300 flex-shrink-0">—</span>
                                            )}
                                            {isEditMode && (
                                              <PencilButton
                                                variant="iconOnly"
                                                aria-label={`${m.name}のメモを編集`}
                                                onClick={() => setMemoPopupMemberId(m.id)}
                                              />
                                            )}
                                            </div>
                                          </div>
                                          {memo.trim() && (
                                            <div className="px-3 pl-4 pr-3 py-0.5 pb-2 text-xs text-slate-600 break-words">
                                              {memo}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </Fragment>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                    </div>
                  )}
                </div>
                {!isEditMode && (
                  <div className="flex justify-end pt-4 pb-2 -mx-4 px-4 md:-mx-6 md:px-6">
                    <button
                      type="button"
                      onClick={() => setShowDeleteRecordConfirm(true)}
                      disabled={loading || (districtId !== "__all__" && !meetingId)}
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

      {showUnsavedConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-confirm-title"
          onClick={() => setShowUnsavedConfirm(false)}
        >
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="unsaved-confirm-title" className="text-sm font-medium text-slate-800 mb-2">保存していない変更があります</h2>
            <p className="text-sm text-slate-600 mb-4">変更を破棄するか、保存してから閲覧モードに切り替えますか？</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const snap = savedSnapshotRef.current;
                  if (snap) {
                    setAttendanceMap(new Map(snap.attendance));
                    setMemos(new Map(snap.memos));
                  }
                  savedSnapshotRef.current = null;
                  setIsEditMode(false);
                  setMessage("");
                  setShowUnsavedConfirm(false);
                }}
                className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 touch-target"
              >
                変更を破棄する
              </button>
              <button
                type="button"
                onClick={() => {
                  saveFromUnsavedDialogRef.current = true;
                  performSave();
                }}
                disabled={saving}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 touch-target disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存する"}
              </button>
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="w-full px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 touch-target"
              >
                記録画面に戻る
              </button>
            </div>
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
                      const { data: meetings } = await supabase
                        .from("lordsday_meeting_records")
                        .select("id")
                        .eq("event_date", sundayIso)
                        .eq("meeting_type", "main");
                      const ids = (meetings ?? []).map((m: { id: string }) => m.id);
                      if (ids.length > 0) {
                        await supabase.from("lordsday_meeting_attendance").delete().in("meeting_id", ids);
                      }
                    } else if (meetingId) {
                      await supabase.from("lordsday_meeting_attendance").delete().eq("meeting_id", meetingId);
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
