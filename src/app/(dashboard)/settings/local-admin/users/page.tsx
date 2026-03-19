import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserWithProfile, getEffectiveCurrentLocalityId, getCachedLocalities } from "@/lib/cachedData";
import { createClient } from "@/lib/supabase/server";
import { LocalUsersClient } from "./LocalUsersClient";

export default async function LocalUsersPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");

  const localityId = await getEffectiveCurrentLocalityId();
  if (!localityId) redirect("/settings");

  const isSystemAdmin = profile?.global_role === "admin";

  const supabase = await createClient();
  const { data } = await supabase
    .from("local_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("locality_id", localityId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role ?? null;
  if (!isSystemAdmin && role !== "local_admin") redirect("/settings/local-admin");

  const localities = await getCachedLocalities();
  const localityName = localities.find((l) => l.id === localityId)?.name ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-slate-600 hover:text-slate-900 text-sm">
          ← 設定
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-slate-800">ユーザ・ロール管理（地方）</h1>
      <p className="text-sm text-slate-600">
        対象地方: <span className="font-medium text-slate-800">{localityName ?? "—"}</span>
      </p>
      <LocalUsersClient />
    </div>
  );
}

