"use client";

import { useMemo, useState } from "react";
import {
  DisplaySettingsProvider,
  useDisplaySettings,
} from "@/contexts/DisplaySettingsContext";
import { useSundayAttendanceRecordActions } from "@/app/(dashboard)/attendance/lordsday/useSundayAttendanceRecordActions";
import { usePrayerAttendanceRecordActions } from "@/app/(dashboard)/attendance/prayer/usePrayerAttendanceRecordActions";
import type {
  AttendanceRow as SundayAttendanceRow,
  MemberRow as SundayMemberRow,
} from "@/app/(dashboard)/attendance/lordsday/sundayAttendanceTypes";
import type {
  AttendanceRow as PrayerAttendanceRow,
  MemberRow as PrayerMemberRow,
} from "@/app/(dashboard)/attendance/prayer/prayerAttendanceTypes";

function DisplaySettingsHarness() {
  const { settings, setSetting } = useDisplaySettings();

  return (
    <section style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 16 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>表示設定ハーネス</h2>
      <p>
        online: <span data-testid="display-online">{String(settings.showLordsDayOnlineColumn)}</span>
      </p>
      <p>
        away: <span data-testid="display-away">{String(settings.showLordsDayAwayColumn)}</span>
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          data-testid="display-toggle-online"
          onClick={() =>
            setSetting(
              "showLordsDayOnlineColumn",
              !settings.showLordsDayOnlineColumn
            )
          }
        >
          オンライン列切替
        </button>
        <button
          type="button"
          data-testid="display-toggle-away"
          onClick={() =>
            setSetting("showLordsDayAwayColumn", !settings.showLordsDayAwayColumn)
          }
        >
          他地方列切替
        </button>
      </div>
    </section>
  );
}

function SundayActionsHarness() {
  const member = useMemo<SundayMemberRow>(
    () => ({
      id: "sunday-member-1",
      name: "主日 太郎",
      furigana: "シュジツ タロウ",
      district_id: "district-1",
      group_id: "group-1",
      age_group: null,
      is_baptized: true,
      local_member_join_date: null,
      local_member_leave_date: null,
    }),
    []
  );

  const [attendanceMap, setAttendanceMap] = useState<Map<string, SundayAttendanceRow>>(
    new Map()
  );
  const [memos, setMemos] = useState<Map<string, string>>(new Map());
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [roster, setRoster] = useState<SundayMemberRow[]>([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("seed");
  const [searchResults, setSearchResults] = useState<SundayMemberRow[]>([member]);
  const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(
    null
  );

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

  const row = attendanceMap.get(member.id);
  const snapshot = {
    attendanceExists: attendanceMap.has(member.id),
    attended: row?.attended ?? null,
    online: row?.is_online ?? null,
    away: row?.is_away ?? null,
    guest: guestIds.has(member.id),
    rosterSize: roster.length,
    message,
    searchQuery,
    searchResultsCount: searchResults.length,
    blockedId: enrollmentBlockedMemberId,
  };

  return (
    <section style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 16 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>主日記録アクションハーネス</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          data-testid="sunday-add-from-search"
          onClick={() => actions.addFromSearch(member)}
        >
          検索追加
        </button>
        <button
          type="button"
          data-testid="sunday-mark-present"
          onClick={() => actions.setAttendanceChoice(member.id, member, "present")}
        >
          出席
        </button>
        <button
          type="button"
          data-testid="sunday-mark-absent"
          onClick={() => actions.setAttendanceChoice(member.id, member, "absent")}
        >
          欠席
        </button>
        <button
          type="button"
          data-testid="sunday-mark-unrecorded"
          onClick={() => actions.setAttendanceChoice(member.id, member, "unrecorded")}
        >
          記録なし
        </button>
        <button
          type="button"
          data-testid="sunday-toggle-online"
          onClick={() => actions.toggleOnline(member.id)}
        >
          オンライン切替
        </button>
        <button
          type="button"
          data-testid="sunday-toggle-away"
          onClick={() => actions.toggleIsAway(member.id)}
        >
          他地方切替
        </button>
      </div>
      <pre data-testid="sunday-state" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(snapshot)}
      </pre>
    </section>
  );
}

function PrayerActionsHarness() {
  const member = useMemo<PrayerMemberRow>(
    () => ({
      id: "prayer-member-1",
      name: "祈り 花子",
      furigana: "イノリ ハナコ",
      district_id: "district-1",
      group_id: "group-1",
      age_group: null,
      is_baptized: true,
      local_member_join_date: null,
      local_member_leave_date: null,
    }),
    []
  );

  const [attendanceMap, setAttendanceMap] = useState<Map<string, PrayerAttendanceRow>>(
    new Map()
  );
  const [memos, setMemos] = useState<Map<string, string>>(new Map());
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [roster, setRoster] = useState<PrayerMemberRow[]>([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("seed");
  const [searchResults, setSearchResults] = useState<PrayerMemberRow[]>([member]);
  const [enrollmentBlockedMemberId, setEnrollmentBlockedMemberId] = useState<string | null>(
    null
  );

  const actions = usePrayerAttendanceRecordActions({
    isEditMode: true,
    refDateForEnrollment: "2026-04-07",
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

  const row = attendanceMap.get(member.id);
  const snapshot = {
    attendanceExists: attendanceMap.has(member.id),
    attended: row?.attended ?? null,
    online: row?.is_online ?? null,
    guest: guestIds.has(member.id),
    rosterSize: roster.length,
    message,
    searchQuery,
    searchResultsCount: searchResults.length,
    blockedId: enrollmentBlockedMemberId,
  };

  return (
    <section style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 16 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>祈り記録アクションハーネス</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          data-testid="prayer-add-from-search"
          onClick={() => actions.addFromSearch(member)}
        >
          検索追加
        </button>
        <button
          type="button"
          data-testid="prayer-mark-present"
          onClick={() => actions.setAttendanceChoice(member.id, member, "present")}
        >
          出席
        </button>
        <button
          type="button"
          data-testid="prayer-mark-absent"
          onClick={() => actions.setAttendanceChoice(member.id, member, "absent")}
        >
          欠席
        </button>
        <button
          type="button"
          data-testid="prayer-mark-unrecorded"
          onClick={() => actions.setAttendanceChoice(member.id, member, "unrecorded")}
        >
          記録なし
        </button>
        <button
          type="button"
          data-testid="prayer-toggle-online"
          onClick={() => actions.toggleOnline(member.id)}
        >
          オンライン切替
        </button>
      </div>
      <pre data-testid="prayer-state" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(snapshot)}
      </pre>
    </section>
  );
}

/** 自動テスト・白画面切り分け用の公開ページ */
export default function TestPage() {
  return (
    <DisplaySettingsProvider>
      <div
        style={{
          minHeight: "100vh",
          padding: 24,
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily: "sans-serif",
          display: "grid",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>表示確認 / Test Harness</h1>
        <p>このページは E2E と手動デバッグのための検証用UIです。</p>
        <DisplaySettingsHarness />
        <SundayActionsHarness />
        <PrayerActionsHarness />
      </div>
    </DisplaySettingsProvider>
  );
}
