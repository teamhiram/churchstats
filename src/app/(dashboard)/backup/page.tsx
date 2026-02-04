"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { format } from "date-fns";

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const [localities, districts, groups, members, meetings, attendance, regularList] = await Promise.all([
      supabase.from("localities").select("*"),
      supabase.from("districts").select("*"),
      supabase.from("groups").select("*"),
      supabase.from("members").select("*"),
      supabase.from("meetings").select("*"),
      supabase.from("attendance_records").select("*"),
      supabase.from("regular_member_list_items").select("*"),
    ]);
    const backup = {
      exported_at: new Date().toISOString(),
      localities: localities.data ?? [],
      districts: districts.data ?? [],
      groups: groups.data ?? [],
      members: members.data ?? [],
      meetings: meetings.data ?? [],
      attendance_records: attendance.data ?? [],
      regular_member_list_items: regularList.data ?? [],
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `churchstats-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("エクスポートしました");
    setLoading(false);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setMessage("ファイルを選択してください");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const text = await importFile.text();
      const backup = JSON.parse(text) as {
        localities?: unknown[];
        districts?: unknown[];
        groups?: unknown[];
        members?: unknown[];
        meetings?: unknown[];
        attendance_records?: unknown[];
        regular_member_list_items?: unknown[];
      };
      const supabase = createClient();
      if (backup.localities?.length) {
        await supabase.from("localities").upsert(backup.localities as never[], { onConflict: "id" });
      }
      if (backup.districts?.length) {
        await supabase.from("districts").upsert(backup.districts as never[], { onConflict: "id" });
      }
      if (backup.groups?.length) {
        await supabase.from("groups").upsert(backup.groups as never[], { onConflict: "id" });
      }
      if (backup.members?.length) {
        await supabase.from("members").upsert(backup.members as never[], { onConflict: "id" });
      }
      if (backup.meetings?.length) {
        await supabase.from("meetings").upsert(backup.meetings as never[], { onConflict: "id" });
      }
      if (backup.attendance_records?.length) {
        await supabase.from("attendance_records").upsert(backup.attendance_records as never[], { onConflict: "id" });
      }
      if (backup.regular_member_list_items?.length) {
        await supabase.from("regular_member_list_items").upsert(backup.regular_member_list_items as never[], { onConflict: "id" });
      }
      setMessage("インポートしました。ページを再読み込みしてください。");
      setImportFile(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "インポートに失敗しました");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">バックアップ・リストア</h1>
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">エクスポート</h2>
        <p className="text-sm text-slate-600">
          データをJSON形式でダウンロードします。地方・地区・小組・メンバー・集会・出席・レギュラーメンバーリストを含みます。
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={loading}
          className="px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg touch-target disabled:opacity-50 hover:bg-slate-700"
        >
          {loading ? "処理中…" : "エクスポート"}
        </button>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">インポート</h2>
        <p className="text-sm text-slate-600">
          エクスポートしたJSONをアップロードしてデータを復元します。既存の同じIDは上書きされます。
        </p>
        <form onSubmit={handleImport} className="flex flex-wrap items-end gap-2">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="submit"
            disabled={loading || !importFile}
            className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg touch-target disabled:opacity-50"
          >
            {loading ? "処理中…" : "インポート"}
          </button>
        </form>
      </div>
      {message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  );
}
