import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { BackupSection } from "@/app/(dashboard)/settings/BackupSection";

export default async function BackupRestorePage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  if (profile?.global_role !== "admin") redirect("/settings");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">バックアップ・リストア</h1>
        <p className="text-sm text-slate-600">
          グローバル管理者向けの機能です。エクスポート/インポートはデータを広範囲に上書きするため、取り扱いに注意してください。
        </p>
      </div>
      <BackupSection />
    </div>
  );
}

