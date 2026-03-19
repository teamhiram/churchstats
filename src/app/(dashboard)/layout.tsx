import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { SettingsShell } from "@/components/SettingsShell";
import { QueryProvider } from "@/components/QueryProvider";
import { DisplaySettingsProvider } from "@/contexts/DisplaySettingsContext";
import { LocalityProvider } from "@/contexts/LocalityContext";
import { RoleOverrideProvider } from "@/contexts/RoleOverrideContext";
import { LocalAdminProvider } from "@/contexts/LocalAdminContext";
import { getCurrentUserWithProfile, getCachedLocalities, getCachedAreas, getCachedPrefectures } from "@/lib/cachedData";
import { getCurrentLocalityId } from "@/lib/locality";
import { getMeetingDuplicateGroupCount } from "@/app/(dashboard)/debug/meeting-duplicates/actions";
import { getDuplicateAttendanceGroupCount } from "@/app/(dashboard)/weekly/actions";
import { getEnrollmentUncertainCount } from "@/app/(dashboard)/debug/enrollment-uncertain/actions";
import { getIncompleteNamesCount, getMembersCountByStatus } from "@/app/(dashboard)/settings/local-admin/incomplete-names/actions";
import { createClient } from "@/lib/supabase/server";
import type { LocalRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let data: Awaited<ReturnType<typeof getCurrentUserWithProfile>>;
  try {
    data = await getCurrentUserWithProfile();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <h1 className="text-xl font-bold mb-2 text-slate-900">召会生活統計</h1>
        <p className="text-center max-w-md mb-4 text-slate-600">{msg}</p>
        <p className="text-sm text-slate-500">.env.local を設定し、サーバーを再起動してください。</p>
      </div>
    );
  }
  if (!data.user) {
    redirect("/");
  }

  const [localities, areas, prefectures, cookieLocalityId, meetingDuplicateGroupCount, duplicateAttendanceGroupCount, enrollmentUncertainCount] = await Promise.all([
    getCachedLocalities(),
    getCachedAreas(),
    getCachedPrefectures(),
    getCurrentLocalityId(),
    data.profile?.global_role === "admin" ? getMeetingDuplicateGroupCount() : Promise.resolve(0),
    data.profile?.global_role === "admin" ? getDuplicateAttendanceGroupCount() : Promise.resolve(0),
    data.profile?.global_role === "admin" ? getEnrollmentUncertainCount() : Promise.resolve(0),
  ]);

  // ローカル管理者（local_admin）の場合、デフォルトの地方は「管理者の地方」に寄せる
  const defaultAdminLocalityId: string | null = await (async () => {
    if (!data.user || localities.length === 0) return null;
    try {
      const supabase = await createClient();
      const { data: rows } = await supabase
        .from("local_roles")
        .select("locality_id")
        .eq("user_id", data.user.id)
        .eq("role", "local_admin")
        .limit(50);
      const ids = (rows ?? []).map((r: { locality_id: string }) => r.locality_id);
      const accessible = new Set(localities.map((l) => l.id));
      return ids.find((id) => accessible.has(id)) ?? null;
    } catch {
      return null;
    }
  })();

  // Cookie は Server Component では変更できないため、無効 or 未設定時は effective だけ計算し、
  // クライアントで setCurrentLocalityIdAction を一度呼んで Cookie を同期する
  let effectiveLocalityId = cookieLocalityId && localities.some((l) => l.id === cookieLocalityId) ? cookieLocalityId : null;
  if (!effectiveLocalityId && localities.length > 0) {
    effectiveLocalityId =
      data.profile?.locality_id && localities.some((l) => l.id === data.profile!.locality_id!)
        ? data.profile.locality_id
        : (defaultAdminLocalityId ?? localities[0].id);
  }
  const syncCookieToLocalityId =
    effectiveLocalityId && effectiveLocalityId !== cookieLocalityId ? effectiveLocalityId : null;

  const localRole: LocalRole | null = await (async () => {
    if (!data.user || !effectiveLocalityId) return null;
    try {
      const supabase = await createClient();
      const { data: row } = await supabase
        .from("local_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("locality_id", effectiveLocalityId)
        .maybeSingle();
      const v = (row as { role?: string } | null)?.role ?? null;
      return v === "local_admin" || v === "local_reporter" || v === "local_viewer" ? (v as LocalRole) : null;
    } catch {
      return null;
    }
  })();

  const canUseLocalAdmin =
    (data.profile?.role ?? "viewer") !== "viewer" || data.profile?.global_role === "admin" || localRole != null;
  const incompleteNamesCount = canUseLocalAdmin ? await getIncompleteNamesCount(effectiveLocalityId) : 0;
  const inactiveMembersCount = canUseLocalAdmin ? await getMembersCountByStatus(effectiveLocalityId, "inactive") : 0;
  const toBeDeletedMembersCount = canUseLocalAdmin ? await getMembersCountByStatus(effectiveLocalityId, "tobedeleted") : 0;

  return (
    <QueryProvider>
      <DisplaySettingsProvider>
        <LocalityProvider
          initialCurrentLocalityId={effectiveLocalityId}
          syncCookieToLocalityId={syncCookieToLocalityId}
          initialAccessibleLocalities={localities}
          initialAreas={areas}
          initialPrefectures={prefectures}
        >
          <RoleOverrideProvider actualRole={data.profile?.role ?? "viewer"} actualGlobalRole={data.profile?.global_role ?? null}>
            <LocalAdminProvider localityId={effectiveLocalityId} localRole={localRole}>
              <div className="min-h-screen flex flex-col bg-slate-50">
                <Nav
                  displayName={data.displayName}
                  email={data.email}
                  roleLabel={data.roleLabel}
                  globalRoleLabel={data.globalRoleLabel}
                  localityName={data.localityName}
                />
                <main className="flex-1 flex flex-col min-h-0 pt-[var(--header-height)] px-0 pb-[calc(1.875rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden">
                  <MainContentWrapper>
                    <SettingsShell meetingDuplicateGroupCount={meetingDuplicateGroupCount} duplicateAttendanceGroupCount={duplicateAttendanceGroupCount} enrollmentUncertainCount={enrollmentUncertainCount} incompleteNamesCount={incompleteNamesCount} inactiveMembersCount={inactiveMembersCount} toBeDeletedMembersCount={toBeDeletedMembersCount}>
                      {children}
                    </SettingsShell>
                  </MainContentWrapper>
                </main>
              </div>
            </LocalAdminProvider>
          </RoleOverrideProvider>
        </LocalityProvider>
      </DisplaySettingsProvider>
    </QueryProvider>
  );
}
