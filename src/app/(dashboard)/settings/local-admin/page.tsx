import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { createClient } from "@/lib/supabase/server";
import type { LocalRole } from "@/types/database";

export default async function LocalAdminPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");

  // profile.role が viewer でも、local_roles による地方ロールがあればローカル設定は使える
  const canUseLocalAdmin: boolean = await (async () => {
    if ((profile?.role ?? "viewer") !== "viewer") return true;
    if (profile?.global_role === "admin") return true;
    try {
      const supabase = await createClient();
      const { data: rows } = await supabase
        .from("local_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1);
      const v = (rows?.[0] as { role?: string } | undefined)?.role ?? null;
      const localRole = v === "local_admin" || v === "local_reporter" || v === "local_viewer" ? (v as LocalRole) : null;
      return localRole != null;
    } catch {
      return false;
    }
  })();
  if (canUseLocalAdmin) {
    redirect("/settings/local-admin/incomplete-names");
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">ローカル設定を利用する権限がありません。</p>
    </div>
  );
}

