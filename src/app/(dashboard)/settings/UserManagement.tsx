"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { ROLE_LABELS } from "@/types/database";
import type { Role } from "@/types/database";

type ProfileRow = {
  id: string;
  email: string | null;
  role: Role;
  full_name: string | null;
};

export function UserManagement() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, email, role, full_name")
      .order("created_at")
      .then(({ data }) => {
        setProfiles(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-slate-500 text-sm">読み込み中…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">メール</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">ロール</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {profiles.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 text-sm text-slate-800">{p.email ?? "—"}</td>
              <td className="px-4 py-2 text-sm text-slate-800">{p.full_name ?? "—"}</td>
              <td className="px-4 py-2 text-sm text-slate-800">{ROLE_LABELS[p.role]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">
        ユーザーの追加・ロール変更は Supabase Dashboard の Authentication から行ってください。初回ログイン時に profiles にレコードが自動作成されます。
      </p>
    </div>
  );
}
