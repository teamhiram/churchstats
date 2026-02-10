import { redirect } from "next/navigation";
import { BackupSection } from "./BackupSection";
import { CacheSection } from "./CacheSection";
import { DisplaySettingsSection } from "./DisplaySettingsSection";
import { UserManagement } from "./UserManagement";
import { getCurrentUserWithProfile } from "@/lib/cachedData";

export default async function SettingsPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  const role = profile?.role ?? "viewer";
  const canManageUsers = role === "admin" || role === "co_admin";

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-slate-800">システム設定</h1>
      <DisplaySettingsSection />
      {canManageUsers && (
        <section>
          <h2 className="font-semibold text-slate-800 mb-4">ユーザー管理</h2>
          <UserManagement />
        </section>
      )}
      <CacheSection />
      <BackupSection />
      {!canManageUsers && (
        <p className="text-slate-500 text-sm">システム設定の変更権限がありません。</p>
      )}
    </div>
  );
}
