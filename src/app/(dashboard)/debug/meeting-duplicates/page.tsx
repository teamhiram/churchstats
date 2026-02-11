import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteMeetingFromDebug } from "./actions";
import { DebugMeetingDuplicatesClient } from "./DebugMeetingDuplicatesClient";

export const dynamic = "force-dynamic";

type MeetingRow = {
  id: string;
  event_date: string;
  meeting_type: "main" | "group";
  name: string;
  district_id: string | null;
  locality_id: string | null;
  group_id: string | null;
  created_at: string | null;
};

export default async function DebugMeetingDuplicatesPage() {
  const supabase = await createClient();
  const postDebugLog = (payload: {
    runId: string;
    hypothesisId: string;
    location: string;
    message: string;
    data: Record<string, unknown>;
  }) => {
    fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, timestamp: Date.now() }),
    }).catch(() => {});
  };

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, event_date, meeting_type, name, district_id, locality_id, group_id, created_at")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: true });

  const meetingRows = (meetings ?? []) as MeetingRow[];
  const mainRows = meetingRows.filter((m) => m.meeting_type === "main");
  const groupRows = meetingRows.filter((m) => m.meeting_type === "group");

  const mainByDateDistrict = new Map<string, number>();
  for (const row of mainRows) {
    const key = `${row.event_date}|${row.district_id ?? ""}`;
    mainByDateDistrict.set(key, (mainByDateDistrict.get(key) ?? 0) + 1);
  }
  const mainDupKeys = [...mainByDateDistrict.entries()].filter(([, count]) => count > 1);

  const groupByDateGroup = new Map<string, number>();
  for (const row of groupRows) {
    const key = `${row.event_date}|${row.group_id ?? ""}`;
    groupByDateGroup.set(key, (groupByDateGroup.get(key) ?? 0) + 1);
  }
  const groupDupKeys = [...groupByDateGroup.entries()].filter(([, count]) => count > 1);

  // #region agent log H1
  postDebugLog({
    runId: "meeting-dup-debug-1",
    hypothesisId: "H1",
    location: "debug/meeting-duplicates/page.tsx:main-group-split",
    message: "split counts and duplicate key counts",
    data: {
      totalMeetings: meetingRows.length,
      mainMeetings: mainRows.length,
      groupMeetings: groupRows.length,
      mainDupKeyCountDateDistrict: mainDupKeys.length,
      groupDupKeyCountDateGroup: groupDupKeys.length,
      mainDupKeySample: mainDupKeys.slice(0, 10),
      groupDupKeySample: groupDupKeys.slice(0, 10),
    },
  });
  // #endregion

  const grouped = new Map<string, MeetingRow[]>();
  for (const row of meetingRows) {
    const key = [
      row.event_date,
      row.meeting_type,
      row.district_id ?? "",
      row.locality_id ?? "",
      row.group_id ?? "",
    ].join("|");
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const duplicateGroups = [...grouped.entries()]
    .map(([, rows]) => rows)
    .filter((rows) => rows.length > 1)
    .sort((a, b) => b[0].event_date.localeCompare(a[0].event_date));

  // #region agent log H2
  postDebugLog({
    runId: "meeting-dup-debug-1",
    hypothesisId: "H2",
    location: "debug/meeting-duplicates/page.tsx:current-grouping",
    message: "current strict grouping result",
    data: {
      currentGroupingDuplicateGroupCount: duplicateGroups.length,
      currentGroupingSample: duplicateGroups.slice(0, 5).map((rows) => ({
        event_date: rows[0].event_date,
        meeting_type: rows[0].meeting_type,
        district_id: rows[0].district_id,
        locality_id: rows[0].locality_id,
        group_id: rows[0].group_id,
        size: rows.length,
      })),
    },
  });
  // #endregion

  const alternativeMainGroups = new Map<string, MeetingRow[]>();
  for (const row of mainRows) {
    const key = `${row.event_date}|${row.district_id ?? ""}`;
    const list = alternativeMainGroups.get(key) ?? [];
    list.push(row);
    alternativeMainGroups.set(key, list);
  }
  const alternativeMainDuplicates = [...alternativeMainGroups.values()].filter((rows) => rows.length > 1);

  const alternativeGroupGroups = new Map<string, MeetingRow[]>();
  for (const row of groupRows) {
    const key = `${row.event_date}|${row.group_id ?? ""}`;
    const list = alternativeGroupGroups.get(key) ?? [];
    list.push(row);
    alternativeGroupGroups.set(key, list);
  }
  const alternativeGroupDuplicates = [...alternativeGroupGroups.values()].filter((rows) => rows.length > 1);

  // #region agent log H3
  postDebugLog({
    runId: "meeting-dup-debug-1",
    hypothesisId: "H3",
    location: "debug/meeting-duplicates/page.tsx:alternative-grouping",
    message: "alternative grouping result",
    data: {
      alternativeMainDuplicateGroupCount: alternativeMainDuplicates.length,
      alternativeGroupDuplicateGroupCount: alternativeGroupDuplicates.length,
      alternativeMainSample: alternativeMainDuplicates.slice(0, 5).map((rows) => ({
        event_date: rows[0].event_date,
        district_id: rows[0].district_id,
        size: rows.length,
      })),
      alternativeGroupSample: alternativeGroupDuplicates.slice(0, 5).map((rows) => ({
        event_date: rows[0].event_date,
        group_id: rows[0].group_id,
        size: rows.length,
      })),
    },
  });
  // #endregion

  const duplicateMeetingIds = duplicateGroups.flatMap((rows) => rows.map((r) => r.id));

  const { data: attendanceRows } = await supabase
    .from("attendance_records")
    .select("meeting_id")
    .in("meeting_id", duplicateMeetingIds.length > 0 ? duplicateMeetingIds : ["00000000-0000-0000-0000-000000000000"]);

  const attendanceCountMap = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    const meetingId = (row as { meeting_id: string }).meeting_id;
    attendanceCountMap.set(meetingId, (attendanceCountMap.get(meetingId) ?? 0) + 1);
  }

  const districtIds = [...new Set(duplicateGroups.map((rows) => rows[0].district_id).filter(Boolean))] as string[];
  const localityIds = [...new Set(duplicateGroups.map((rows) => rows[0].locality_id).filter(Boolean))] as string[];
  const groupIds = [...new Set(duplicateGroups.map((rows) => rows[0].group_id).filter(Boolean))] as string[];

  const [{ data: districts }, { data: localities }, { data: groups }] = await Promise.all([
    supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds.length > 0 ? districtIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("localities")
      .select("id, name")
      .in("id", localityIds.length > 0 ? localityIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("groups")
      .select("id, name")
      .in("id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const districtNameById = new Map((districts ?? []).map((d) => [d.id, d.name]));
  const localityNameById = new Map((localities ?? []).map((l) => [l.id, l.name]));
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">デバッグ: 集会重複検知</h1>
      <p className="text-sm text-slate-600">
        同一キー（event_date / meeting_type / district_id / locality_id / group_id）の重複集会を一覧表示します。削除すると関連する出席記録も同時に削除されます。
      </p>
      <p className="text-sm">
        <Link href="/debug/tables" className="text-primary-600 hover:underline">
          ← デバッグ: 全テーブル表示
        </Link>
      </p>

      <DebugMeetingDuplicatesClient />
    </div>
  );
}

