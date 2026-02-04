import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ROLE_LABELS } from "@/types/database";
import type { Role } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;
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
  if (!user) {
    redirect("/");
  }

  let displayName: string | null = null;
  let roleLabel: string = "閲覧者";
  let localityName: string | null = null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, main_district_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    displayName = profile.full_name ?? null;
    roleLabel = ROLE_LABELS[(profile.role as Role) ?? "viewer"];
    if (profile.main_district_id) {
      const { data: district } = await supabase
        .from("districts")
        .select("locality_id")
        .eq("id", profile.main_district_id)
        .maybeSingle();
      if (district?.locality_id) {
        const { data: locality } = await supabase
          .from("localities")
          .select("name")
          .eq("id", district.locality_id)
          .maybeSingle();
        localityName = locality?.name ?? null;
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50" style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <Nav
        displayName={displayName}
        roleLabel={roleLabel}
        localityName={localityName}
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
    </div>
  );
}
