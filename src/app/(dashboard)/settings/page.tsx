import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserManagement } from "./UserManagement";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "viewer";
  const canManageUsers = role === "admin" || role === "co_admin";

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-slate-800">システム設定</h1>
      {canManageUsers && (
        <section>
          <h2 className="font-semibold text-slate-800 mb-4">ユーザー管理</h2>
          <UserManagement />
        </section>
      )}
      {!canManageUsers && (
        <p className="text-slate-500 text-sm">システム設定の変更権限がありません。</p>
      )}
    </div>
  );
}
