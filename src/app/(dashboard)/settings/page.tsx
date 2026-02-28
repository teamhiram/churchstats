import { redirect } from "next/navigation";
import { BackupSection } from "./BackupSection";
import { CacheSection } from "./CacheSection";
import { DisplaySettingsSection } from "./DisplaySettingsSection";
import { getCurrentUserWithProfile } from "@/lib/cachedData";

export default async function SettingsPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  const role = profile?.role ?? "viewer";
  const canManageSettings = role === "admin" || role === "co_admin";

  return (
    <div className="space-y-8">
      <DisplaySettingsSection />
      <CacheSection />
      <BackupSection />
      {!canManageSettings && (
        <p className="text-slate-500 text-sm">システム設定の変更権限がありません。</p>
      )}
    </div>
  );
}
