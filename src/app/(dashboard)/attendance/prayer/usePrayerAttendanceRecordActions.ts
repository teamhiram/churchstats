"use client";

import { useCallback } from "react";
import { isInEnrollmentPeriod } from "@/lib/enrollmentPeriod";
import type {
  AttendanceChoice,
  AttendanceRow,
  MemberRow,
} from "./prayerAttendanceTypes";

type Params = {
  isEditMode: boolean;
  refDateForEnrollment: string;
  attendanceMap: Map<string, AttendanceRow>;
  memos: Map<string, string>;
  setAttendanceMap: React.Dispatch<React.SetStateAction<Map<string, AttendanceRow>>>;
  setMemos: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setGuestIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRoster: React.Dispatch<React.SetStateAction<MemberRow[]>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchResults: React.Dispatch<React.SetStateAction<MemberRow[]>>;
  setEnrollmentBlockedMemberId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function usePrayerAttendanceRecordActions({
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
}: Params) {
  const setAttendanceChoice = useCallback(
    (memberId: string, member: MemberRow, choice: AttendanceChoice) => {
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
    },
    [isEditMode, memos, attendanceMap, setMessage, setAttendanceMap, setMemos, setGuestIds, setRoster]
  );

  const saveMemo = useCallback((_memberId: string) => {
    if (!isEditMode) return;
    // In edit mode, memo is kept in memos state; persisted on 保存する
  }, [isEditMode]);

  const toggleOnline = useCallback(
    (memberId: string) => {
      if (!isEditMode) return;
      const rec = attendanceMap.get(memberId);
      if (!rec) return;
      const next = !(rec.is_online ?? false);
      setAttendanceMap((prev) => {
        const nextMap = new Map(prev);
        const row = nextMap.get(memberId);
        if (row) nextMap.set(memberId, { ...row, is_online: next });
        return nextMap;
      });
    },
    [isEditMode, attendanceMap, setAttendanceMap]
  );

  const addFromSearch = useCallback(
    (member: MemberRow) => {
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
    },
    [
      isEditMode,
      attendanceMap,
      setMessage,
      refDateForEnrollment,
      setEnrollmentBlockedMemberId,
      setAttendanceMap,
      setMemos,
      setGuestIds,
      setRoster,
      setSearchQuery,
      setSearchResults,
    ]
  );

  return {
    setAttendanceChoice,
    saveMemo,
    toggleOnline,
    addFromSearch,
  };
}

