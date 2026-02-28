import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { SettingsShell } from "@/components/SettingsShell";
import { QueryProvider } from "@/components/QueryProvider";
import { DisplaySettingsProvider } from "@/contexts/DisplaySettingsContext";
import { LocalityProvider } from "@/contexts/LocalityContext";
import { getCurrentUserWithProfile, getCachedLocalities, getCachedAreas, getCachedPrefectures } from "@/lib/cachedData";
import { getCurrentLocalityId } from "@/lib/locality";
import { getMeetingDuplicateGroupCount } from "@/app/(dashboard)/debug/meeting-duplicates/actions";
import { getDuplicateAttendanceGroupCount } from "@/app/(dashboard)/weekly/actions";
import { getEnrollmentUncertainCount } from "@/app/(dashboard)/debug/enrollment-uncertain/actions";

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
  // Cookie は Server Component では変更できないため、無効 or 未設定時は effective だけ計算し、
  // クライアントで setCurrentLocalityIdAction を一度呼んで Cookie を同期する
  let effectiveLocalityId = cookieLocalityId && localities.some((l) => l.id === cookieLocalityId) ? cookieLocalityId : null;
  if (!effectiveLocalityId && localities.length > 0) {
    effectiveLocalityId =
      data.profile?.locality_id && localities.some((l) => l.id === data.profile!.locality_id!)
        ? data.profile.locality_id
        : localities[0].id;
  }
  const syncCookieToLocalityId =
    effectiveLocalityId && effectiveLocalityId !== cookieLocalityId ? effectiveLocalityId : null;

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
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Nav
              displayName={data.displayName}
              email={data.email}
              roleLabel={data.roleLabel}
              globalRoleLabel={data.globalRoleLabel}
              localityName={data.localityName}
              showDebug={data.profile?.global_role === "admin"}
              showRolesManagement={data.profile?.global_role === "admin"}
            />
            <main className="flex-1 flex flex-col min-h-0 pt-[var(--header-height)] px-0 pb-[calc(1.875rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden">
              <MainContentWrapper>
                <SettingsShell showDebug={data.profile?.global_role === "admin"} showRolesManagement={data.profile?.global_role === "admin"} meetingDuplicateGroupCount={meetingDuplicateGroupCount} duplicateAttendanceGroupCount={duplicateAttendanceGroupCount} enrollmentUncertainCount={enrollmentUncertainCount}>
                  {children}
                </SettingsShell>
              </MainContentWrapper>
            </main>
          </div>
        </LocalityProvider>
      </DisplaySettingsProvider>
    </QueryProvider>
  );
}
