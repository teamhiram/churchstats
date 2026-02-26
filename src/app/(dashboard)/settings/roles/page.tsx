import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { getCachedAreas } from "@/lib/cachedData";
import { getCachedLocalities } from "@/lib/cachedData";
import { createClient } from "@/lib/supabase/server";
import { RoleManagementClient } from "./RoleManagementClient";

export default async function RolesPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  if (profile?.global_role !== "admin") redirect("/settings");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, global_role")
    .order("created_at", { ascending: true });

  const [areas, localities] = await Promise.all([getCachedAreas(), getCachedLocalities()]);

  const userIds = (profiles ?? []).map((p) => p.id);
  const [userLocalitiesRes, userAreasRes, localRolesRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("user_localities").select("user_id, locality_id").in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0 ? supabase.from("user_areas").select("user_id, area_id").in("user_id", userIds) : Promise.resolve({ data: [] }),
    userIds.length > 0 ? supabase.from("local_roles").select("user_id, locality_id, role").in("user_id", userIds) : Promise.resolve({ data: [] }),
  ]);

  const userLocalities = (userLocalitiesRes.data ?? []) as { user_id: string; locality_id: string }[];
  const userAreas = (userAreasRes.data ?? []) as { user_id: string; area_id: string }[];
  const localRoles = (localRolesRes.data ?? []) as { user_id: string; locality_id: string; role: string }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-slate-600 hover:text-slate-900 text-sm">
          ← 設定
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-slate-800">ユーザー・ロール管理</h1>
      <p className="text-sm text-slate-600">
        ユーザーの追加（招待）、グローバル権限・地域・アクセス可能な地方・ローカル権限をアプリ内で設定できます。Supabase ダッシュボードは不要です。
      </p>
      <RoleManagementClient
        profiles={profiles ?? []}
        areas={areas}
        localities={localities}
        userLocalities={userLocalities}
        userAreas={userAreas}
        localRoles={localRoles}
      />
    </div>
  );
}
