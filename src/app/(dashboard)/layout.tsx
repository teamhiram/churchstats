import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { SettingsShell } from "@/components/SettingsShell";
import { QueryProvider } from "@/components/QueryProvider";
import { DisplaySettingsProvider } from "@/contexts/DisplaySettingsContext";
import { LocalityProvider } from "@/contexts/LocalityContext";
import { getCurrentUserWithProfile, getCachedLocalities, getCachedAreas, getCachedPrefectures } from "@/lib/cachedData";
import { getCurrentLocalityId } from "@/lib/locality";
import { CURRENT_LOCALITY_COOKIE_NAME } from "@/lib/localityConstants";
import { cookies } from "next/headers";

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

  const [localities, areas, prefectures, cookieLocalityId] = await Promise.all([
    getCachedLocalities(),
    getCachedAreas(),
    getCachedPrefectures(),
    getCurrentLocalityId(),
  ]);
  const cookieStore = await cookies();
  let effectiveLocalityId = cookieLocalityId;
  if (localities.length === 1 && !effectiveLocalityId) {
    effectiveLocalityId = localities[0].id;
    cookieStore.set(CURRENT_LOCALITY_COOKIE_NAME, effectiveLocalityId, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else if (!effectiveLocalityId && localities.length > 0) {
    effectiveLocalityId = localities[0].id;
  }

  return (
    <QueryProvider>
      <DisplaySettingsProvider>
        <LocalityProvider
          initialCurrentLocalityId={effectiveLocalityId}
          initialAccessibleLocalities={localities}
          initialAreas={areas}
          initialPrefectures={prefectures}
        >
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Nav
              displayName={data.displayName}
              roleLabel={data.roleLabel}
              localityName={data.localityName}
              showDebug={data.profile?.role === "admin"}
            />
            <main className="flex-1 pt-[calc(2rem+0.5em)] md:pt-[calc(3.5rem+0.5em)] p-4 md:p-6 pb-[calc(1.875rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-auto">
              <MainContentWrapper>
                <SettingsShell showDebug={data.profile?.role === "admin"} showRolesManagement={data.profile?.global_role === "admin"}>
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
