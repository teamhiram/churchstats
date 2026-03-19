import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedLocalities, getCurrentUserWithProfile, getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import { IncompleteNamesClient, type IncompleteNameMemberRow } from "./IncompleteNamesClient";
import type { LocalRole } from "@/types/database";

export const dynamic = "force-dynamic";

function isBlank(v: string | null | undefined) {
  return v == null || v.trim() === "";
}

export default async function IncompleteNamesPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");

  const currentLocalityId = await getEffectiveCurrentLocalityId();
  if (!currentLocalityId) redirect("/settings");

  // profile.role が viewer でも、local_roles による地方ロールがあればローカル設定は使える
  const canUseLocalAdmin: boolean = await (async () => {
    if ((profile?.role ?? "viewer") !== "viewer") return true;
    if (profile?.global_role === "admin") return true;
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("local_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("locality_id", currentLocalityId)
        .maybeSingle();
      const v = (data as { role?: string } | null)?.role ?? null;
      const localRole = v === "local_admin" || v === "local_reporter" || v === "local_viewer" ? (v as LocalRole) : null;
      return localRole != null;
    } catch {
      return false;
    }
  })();
  if (!canUseLocalAdmin) redirect("/settings/local-admin");

  const localities = await getCachedLocalities();
  const localityName = currentLocalityId ? (localities.find((l) => l.id === currentLocalityId)?.name ?? null) : null;

  const supabase = await createClient();
  const { data: membersRaw, error } = await supabase
    .from("members")
    .select("id, last_name, first_name, last_furigana, first_furigana, locality_id")
    .eq("locality_id", currentLocalityId)
    .or("last_name.is.null,first_name.is.null,last_furigana.is.null,first_furigana.is.null,last_name.eq.,first_name.eq.,last_furigana.eq.,first_furigana.eq.")
    .order("last_furigana")
    .limit(2000);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        取得に失敗しました: {error.message}
      </div>
    );
  }

  const members = ((membersRaw ?? []) as {
    id: string;
    last_name: string | null;
    first_name: string | null;
    last_furigana: string | null;
    first_furigana: string | null;
  }[]).filter((m) => isBlank(m.last_name) || isBlank(m.first_name) || isBlank(m.last_furigana) || isBlank(m.first_furigana));

  const initialMembers: IncompleteNameMemberRow[] = members.map((m) => ({
    id: m.id,
    last_name: m.last_name,
    first_name: m.first_name,
    last_furigana: m.last_furigana,
    first_furigana: m.first_furigana,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">氏名不完全</h1>
        <p className="text-sm text-slate-600">
          現在選択中の地方の名簿から、姓・名・ふりがな（姓/名）のいずれかが空欄のメンバーを表示します。
        </p>
      </div>
      <IncompleteNamesClient initialMembers={initialMembers} localityName={localityName} />
    </div>
  );
}

