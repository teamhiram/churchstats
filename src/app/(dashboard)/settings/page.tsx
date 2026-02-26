import { redirect } from "next/navigation";
import Link from "next/link";
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
  const isGlobalAdmin = profile?.global_role === "admin";

  return (
    <div className="space-y-8">
      <DisplaySettingsSection />
      {isGlobalAdmin && (
        <section>
          <h2 className="font-semibold text-slate-800 mb-4">ユーザー・ロール管理</h2>
          <p className="text-sm text-slate-600 mb-2">
            招待、グローバル権限・地域・地方・ローカル権限をアプリ内で設定できます。
          </p>
          <Link
            href="/settings/roles"
            className="inline-flex items-center rounded-md bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
            ユーザー・ロール管理を開く
          </Link>
        </section>
      )}
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
