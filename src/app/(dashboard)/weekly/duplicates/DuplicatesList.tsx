"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAttendanceRecord, type DuplicateMainAttendanceGroup } from "../actions";

export function DuplicatesList({ groups }: { groups: DuplicateMainAttendanceGroup[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (attendanceId: string) => {
    setError(null);
    setDeletingId(attendanceId);
    try {
      const result = await deleteAttendanceRecord(attendanceId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      <ul className="space-y-4">
        {groups.map((g) => (
          <li key={`${g.weekStart}-${g.memberId}`} className="border border-slate-200 rounded-lg p-4 bg-white">
            <p className="font-medium text-slate-800">
              {g.weekStart} 週 — {g.memberName}
            </p>
            <p className="text-sm text-slate-500 mb-2">同一週に {g.records.length} 件の主日出席があります。</p>
            <ul className="space-y-2">
              {g.records.map((r) => (
                <li
                  key={r.attendanceId}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-slate-50 text-sm"
                >
                  <span className="text-slate-700">
                    集会日: <span className="font-mono">{r.eventDate}</span>（ID: {r.attendanceId.slice(0, 8)}…）
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.attendanceId)}
                    disabled={deletingId !== null}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    {deletingId === r.attendanceId ? "削除中…" : "このレコードを削除"}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
