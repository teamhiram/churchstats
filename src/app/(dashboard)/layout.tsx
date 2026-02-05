import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
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
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50"
        style={{ minHeight: "100vh", padding: 16, backgroundColor: "#f8fafc", color: "#0f172a" }}
      >
        <h1 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>召会生活統計</h1>
        <p className="text-center max-w-md mb-4" style={{ color: "#475569" }}>{msg}</p>
        <p className="text-sm" style={{ color: "#64748b" }}>.env.local を設定し、サーバーを再起動してください。</p>
      </div>
    );
  }
  if (!data.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <Nav
        displayName={data.displayName}
        roleLabel={data.roleLabel}
        localityName={data.localityName}
      />
      <main className="flex-1 pt-0 md:pt-12 p-4 md:p-6 overflow-auto">{children}</main>
    </div>
  );
}
