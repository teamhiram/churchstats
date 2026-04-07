import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useSundayAttendanceRecordActions } from "@/app/(dashboard)/attendance/lordsday/useSundayAttendanceRecordActions";
import type {
  AttendanceRow,
  MemberRow,
} from "@/app/(dashboard)/attendance/lordsday/sundayAttendanceTypes";

function createMember(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: "member-1",
    name: "山田 太郎",
    furigana: "ヤマダ タロウ",
    district_id: "district-1",
    group_id: "group-1",
    age_group: null,
    is_baptized: true,
    local_member_join_date: null,
    local_member_leave_date: null,
    ...overrides,
  };
}

describe("useSundayAttendanceRecordActions", () => {
  it("検索追加で出欠レコードを作成し、名簿・追加集合を更新する", () => {
    const member = createMember();

    const { result } = renderHook(() => {
      const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(
        new Map()
      );
      const [memos, setMemos] = useState<Map<string, string>>(new Map());
      const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
      const [roster, setRoster] = useState<MemberRow[]>([]);
      const [message, setMessage] = useState("");
      const [searchQuery, setSearchQuery] = useState("abc");
      const [searchResults, setSearchResults] = useState<MemberRow[]>([member]);
      const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);

      const actions = useSundayAttendanceRecordActions({
        isEditMode: true,
        sundayIso: "2026-04-07",
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

      return {
        actions,
        attendanceMap,
        memos,
        guestIds,
        roster,
        message,
        searchQuery,
        searchResults,
        enrollmentBlockedMemberId,
        setMemos,
      };
    });

    act(() => {
      result.current.actions.addFromSearch(member);
    });

    const record = result.current.attendanceMap.get(member.id);
    expect(record).toBeDefined();
    expect(record?.attended).toBe(true);
    expect(record?.is_online).toBe(false);
    expect(record?.is_away).toBe(false);
    expect(result.current.guestIds.has(member.id)).toBe(true);
    expect(result.current.roster.map((m) => m.id)).toContain(member.id);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.message).toBe("");
    expect(result.current.enrollmentBlockedMemberId).toBeNull();
  });

  it("欠席に変更するとオンライン/他地方が false に戻る", () => {
    const member = createMember();

    const { result } = renderHook(() => {
      const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
      const [memos, setMemos] = useState<Map<string, string>>(new Map());
      const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
      const [roster, setRoster] = useState<MemberRow[]>([]);
      const [message, setMessage] = useState("");
      const [searchQuery, setSearchQuery] = useState("");
      const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
      const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);

      const actions = useSundayAttendanceRecordActions({
        isEditMode: true,
        sundayIso: "2026-04-07",
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

      return { actions, attendanceMap };
    });

    act(() => {
      result.current.actions.addFromSearch(member);
    });
    act(() => {
      result.current.actions.toggleOnline(member.id);
      result.current.actions.toggleIsAway(member.id);
    });

    expect(result.current.attendanceMap.get(member.id)?.is_online).toBe(true);
    expect(result.current.attendanceMap.get(member.id)?.is_away).toBe(true);

    act(() => {
      result.current.actions.setAttendanceChoice(member.id, member, "absent");
    });

    expect(result.current.attendanceMap.get(member.id)?.attended).toBe(false);
    expect(result.current.attendanceMap.get(member.id)?.is_online).toBe(false);
    expect(result.current.attendanceMap.get(member.id)?.is_away).toBe(false);
  });

  it("記録なしを選ぶと出欠とメモを削除する", () => {
    const member = createMember();

    const { result } = renderHook(() => {
      const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
      const [memos, setMemos] = useState<Map<string, string>>(new Map());
      const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
      const [roster, setRoster] = useState<MemberRow[]>([]);
      const [message, setMessage] = useState("");
      const [searchQuery, setSearchQuery] = useState("");
      const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
      const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);

      const actions = useSundayAttendanceRecordActions({
        isEditMode: true,
        sundayIso: "2026-04-07",
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

      return { actions, attendanceMap, memos, setMemos };
    });

    act(() => {
      result.current.actions.addFromSearch(member);
    });

    act(() => {
      result.current.setMemos((prev) => new Map(prev).set(member.id, "メモ"));
    });

    expect(result.current.actions.hasAttendanceData(member.id)).toBe(true);

    act(() => {
      result.current.actions.setAttendanceChoice(member.id, member, "unrecorded");
    });

    expect(result.current.attendanceMap.has(member.id)).toBe(false);
    expect(result.current.memos.has(member.id)).toBe(false);
    expect(result.current.actions.hasAttendanceData(member.id)).toBe(false);
  });

  it("在籍期間外メンバーは追加せず blocked id を設定する", () => {
    const outOfRangeMember = createMember({
      id: "member-2",
      local_member_join_date: "2026-05-01",
    });

    const { result } = renderHook(() => {
      const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
      const [memos, setMemos] = useState<Map<string, string>>(new Map());
      const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
      const [roster, setRoster] = useState<MemberRow[]>([]);
      const [message, setMessage] = useState("");
      const [searchQuery, setSearchQuery] = useState("");
      const [searchResults, setSearchResults] = useState<MemberRow[]>([]);
      const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(null);

      const actions = useSundayAttendanceRecordActions({
        isEditMode: true,
        sundayIso: "2026-04-07",
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

      return { actions, attendanceMap, enrollmentBlockedMemberId };
    });

    act(() => {
      result.current.actions.addFromSearch(outOfRangeMember);
    });

    expect(result.current.attendanceMap.size).toBe(0);
    expect(result.current.enrollmentBlockedMemberId).toBe("member-2");
  });
});
