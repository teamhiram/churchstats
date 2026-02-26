"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMeetingFromDebug } from "./actions";

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

type DuplicateGroup = {
  kind: "main" | "group";
  key: string;
  rows: MeetingRow[];
};

export function DebugMeetingDuplicatesClient() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [districtNameById, setDistrictNameById] = useState<Map<string, string>>(new Map());
  const [localityNameById, setLocalityNameById] = useState<Map<string, string>>(new Map());
  const [groupNameById, setGroupNameById] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const supabase = createClient();
      const [{ data: meetingsData, error: meetingsError }, { data: authData }] = await Promise.all([
        supabase
          .from("lordsday_meeting_records")
          .select("id, event_date, meeting_type, name, district_id, locality_id, group_id, created_at")
          .order("event_date", { ascending: false })
          .order("created_at", { ascending: true }),
        supabase.auth.getUser(),
      ]);

      // #region agent log H4
      fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "meeting-dup-debug-2",
          hypothesisId: "H4",
          location: "debug/meeting-duplicates/DebugMeetingDuplicatesClient.tsx:load-meetings",
          message: "client-side meetings load result",
          data: {
            userId: authData.user?.id ?? null,
            meetingsError: meetingsError?.message ?? null,
            loadedCount: (meetingsData ?? []).length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      const rows = (meetingsData ?? []) as MeetingRow[];
      const districtIds = [...new Set(rows.map((r) => r.district_id).filter(Boolean))] as string[];
      const localityIds = [...new Set(rows.map((r) => r.locality_id).filter(Boolean))] as string[];
      const groupIds = [...new Set(rows.map((r) => r.group_id).filter(Boolean))] as string[];

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

      if (!alive) return;
      setMeetings(rows);
      setDistrictNameById(new Map((districts ?? []).map((d) => [d.id, d.name])));
      setLocalityNameById(new Map((localities ?? []).map((l) => [l.id, l.name])));
      setGroupNameById(new Map((groups ?? []).map((g) => [g.id, g.name])));
      setIsLoading(false);
    };
    run().catch(() => {
      if (!alive) return;
      setIsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const duplicateGroups = useMemo(() => {
    const mainGroups = new Map<string, MeetingRow[]>();
    const groupGroups = new Map<string, MeetingRow[]>();

    for (const row of meetings) {
      if (row.meeting_type === "main") {
        const districtOrLocality = row.district_id ? `D:${row.district_id}` : `L:${row.locality_id ?? "none"}`;
        const key = `${row.event_date}|${districtOrLocality}`;
        const list = mainGroups.get(key) ?? [];
        list.push(row);
        mainGroups.set(key, list);
      } else if (row.meeting_type === "group") {
        const key = `${row.event_date}|${row.group_id ?? "none"}`;
        const list = groupGroups.get(key) ?? [];
        list.push(row);
        groupGroups.set(key, list);
      }
    }

    const mainDuplicates: DuplicateGroup[] = [...mainGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => ({ kind: "main", key, rows }));

    const groupDuplicates: DuplicateGroup[] = [...groupGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => ({ kind: "group", key, rows }));

    const merged = [...mainDuplicates, ...groupDuplicates].sort((a, b) =>
      b.rows[0].event_date.localeCompare(a.rows[0].event_date)
    );

    // #region agent log H5
    fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "meeting-dup-debug-2",
        hypothesisId: "H5",
        location: "debug/meeting-duplicates/DebugMeetingDuplicatesClient.tsx:grouping",
        message: "separated duplicate grouping result",
        data: {
          totalMeetings: meetings.length,
          mainDuplicates: mainDuplicates.length,
          groupDuplicates: groupDuplicates.length,
          sample: merged.slice(0, 6).map((g) => ({
            kind: g.kind,
            key: g.key,
            size: g.rows.length,
          })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return merged;
  }, [meetings]);

  const duplicateMeetingIds = useMemo(
    () => duplicateGroups.flatMap((g) => g.rows.map((r) => r.id)),
    [duplicateGroups]
  );

  const attendanceCountMap = useMemo(() => new Map<string, number>(), []);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      attendanceCountMap.clear();
      if (duplicateMeetingIds.length === 0) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("lordsday_meeting_attendance")
        .select("meeting_id")
        .in("meeting_id", duplicateMeetingIds);
      for (const row of data ?? []) {
        const mid = (row as { meeting_id: string }).meeting_id;
        attendanceCountMap.set(mid, (attendanceCountMap.get(mid) ?? 0) + 1);
      }
      if (alive) {
        setMeetings((prev) => [...prev]);
      }
    };
    run().catch(() => {});
    return () => {
      alive = false;
    };
  }, [attendanceCountMap, duplicateMeetingIds]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  if (duplicateGroups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        重複は検出されませんでした。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {duplicateGroups.map((group) => {
        const first = group.rows[0];
        const districtName = first.district_id ? districtNameById.get(first.district_id) ?? "(地区名不明)" : "-";
        const localityName = first.locality_id ? localityNameById.get(first.locality_id) ?? "(地方名不明)" : "-";
        const groupName = first.group_id ? groupNameById.get(first.group_id) ?? "(グループ名不明)" : "-";
        return (
          <section key={`${group.kind}-${group.key}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-sm text-slate-700">
              <span className="font-semibold">{first.event_date}</span>
              <span className="ml-3">種別: {group.kind}</span>
              <span className="ml-3">地区: {districtName}</span>
              <span className="ml-3">地方: {localityName}</span>
              <span className="ml-3">グループ: {groupName}</span>
              <span className="ml-3 text-rose-600 font-semibold">重複数: {group.rows.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-2 py-2 text-left font-medium">meeting_id</th>
                    <th className="px-2 py-2 text-left font-medium">name</th>
                    <th className="px-2 py-2 text-right font-medium">attendance</th>
                    <th className="px-2 py-2 text-left font-medium">created_at</th>
                    <th className="px-2 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    const attendanceCount = attendanceCountMap.get(row.id) ?? 0;
                    return (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{row.id}</td>
                        <td className="px-2 py-2 text-slate-700">{row.name}</td>
                        <td className="px-2 py-2 text-right text-slate-700">{attendanceCount}</td>
                        <td className="px-2 py-2 text-slate-700">
                          {row.created_at ? new Date(row.created_at).toLocaleString("ja-JP") : "-"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <form action={deleteMeetingFromDebug}>
                            <input type="hidden" name="meeting_id" value={row.id} />
                            <button
                              type="submit"
                              className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              削除
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

