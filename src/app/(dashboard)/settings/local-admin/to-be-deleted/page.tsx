import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedLocalities, getCurrentUserWithProfile, getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import type { LocalRole } from "@/types/database";
import { ToBeDeletedMembersClient } from "./ToBeDeletedMembersClient";

export const dynamic = "force-dynamic";

export default async function ToBeDeletedMembersPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");

  const currentLocalityId = await getEffectiveCurrentLocalityId();
  if (!currentLocalityId) redirect("/settings");

  // profile.role が viewer でも、local_roles による地方ロールがあればローカル設定は使える
  const localRole: LocalRole | null = await (async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("local_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("locality_id", currentLocalityId)
        .maybeSingle();
      const v = (data as { role?: string } | null)?.role ?? null;
      return v === "local_admin" || v === "local_reporter" || v === "local_viewer" ? (v as LocalRole) : null;
    } catch {
      return null;
    }
  })();

  const canUseLocalAdmin = (profile?.role ?? "viewer") !== "viewer" || profile?.global_role === "admin" || localRole != null;
  if (!canUseLocalAdmin) redirect("/settings/local-admin");

  const canDeleteMembers =
    profile?.global_role === "admin" ||
    profile?.role === "admin" ||
    profile?.role === "co_admin" ||
    localRole === "local_admin";

  const localities = await getCachedLocalities();
  const localityName = currentLocalityId ? (localities.find((l) => l.id === currentLocalityId)?.name ?? null) : null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, last_name, first_name, last_furigana, first_furigana, status")
    .eq("locality_id", currentLocalityId)
    .eq("status", "tobedeleted")
    .order("last_furigana")
    .limit(2000);

  const members = (data ?? []) as {
    id: string;
    last_name: string | null;
    first_name: string | null;
    last_furigana: string | null;
    first_furigana: string | null;
    status: string | null;
  }[];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">削除予定</h1>
        <p className="text-sm text-slate-600">
          統計・集計から除外されるメンバーの一覧です。
        </p>
      </div>

      <ToBeDeletedMembersClient
        initialMembers={members}
        localityName={localityName}
        canDeleteMembers={canDeleteMembers}
      />
    </div>
  );
}
