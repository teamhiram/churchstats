import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedLocalities, getCurrentUserWithProfile, getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import { formatMemberName, formatMemberFurigana } from "@/lib/memberName";
import type { LocalRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function InactiveMembersPage() {
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
  const { data } = await supabase
    .from("members")
    .select("id, last_name, first_name, last_furigana, first_furigana, status")
    .eq("locality_id", currentLocalityId)
    .eq("status", "inactive")
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
        <h1 className="text-lg font-semibold text-slate-900">非表示リスト</h1>
        <p className="text-sm text-slate-600">
          出欠登録画面から隠れているメンバーの一覧です（統計には反映されます）。
        </p>
        <p className="text-sm text-slate-700">
          対象地方: <span className="font-medium">{localityName ?? "—"}</span>
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {members.length === 0 ? (
          <p className="text-sm text-slate-500">該当なし</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="text-sm text-slate-900 font-medium">{formatMemberName(m) || "—"}</span>
                  {formatMemberFurigana(m) && (
                    <span className="text-xs text-slate-500 ml-2">({formatMemberFurigana(m)})</span>
                  )}
                </span>
                <span className="shrink-0 text-sm">
                  <Link href={`/members/${m.id}/edit`} className="text-primary-600 hover:underline touch-target">
                    編集
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

