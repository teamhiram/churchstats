import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { QueryProvider } from "@/components/QueryProvider";
import { DisplaySettingsProvider } from "@/contexts/DisplaySettingsContext";
import { getCurrentUserWithProfile } from "@/lib/cachedData";

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

  return (
    <QueryProvider>
      <DisplaySettingsProvider>
        <div className="min-h-screen flex flex-col bg-slate-50">
          <Nav
            displayName={data.displayName}
            roleLabel={data.roleLabel}
            localityName={data.localityName}
          />
          <main className="flex-1 pt-[calc(1rem+0.5em)] md:pt-[calc(3.5rem+0.5em)] p-4 md:p-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-auto">
            <MainContentWrapper>{children}</MainContentWrapper>
          </main>
        </div>
      </DisplaySettingsProvider>
    </QueryProvider>
  );
}
