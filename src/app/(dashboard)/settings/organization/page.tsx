import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrganizationForm } from "./OrganizationForm";

export default async function OrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "viewer";
  if (role !== "admin" && role !== "co_admin") {
    redirect("/settings");
  }

  const { data: settings } = await supabase.from("system_settings").select("key, value");
  const settingsMap = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const absenceAlertWeeks = Number(settingsMap.get("absence_alert_weeks") ?? 4);

  const { data: localities } = await supabase.from("localities").select("id, name").order("name");
  const { data: districts } = await supabase.from("districts").select("id, locality_id, name").order("name");
  const { data: groups } = await supabase.from("groups").select("id, district_id, name").order("name");

  const { data: reporterDistricts } = await supabase
    .from("reporter_districts")
    .select("district_id")
    .eq("user_id", user.id);
  const districtIds = (reporterDistricts ?? []).map((r) => r.district_id);
  const localityIdsForUser =
    districtIds.length > 0
      ? (await supabase.from("districts").select("locality_id").in("id", districtIds))
          .data?.map((d) => d.locality_id) ?? []
      : [];
  const distinctLocalityIds = [...new Set(localityIdsForUser)];
  const userLocalities =
    distinctLocalityIds.length > 0
      ? (localities ?? []).filter((l) => distinctLocalityIds.includes(l.id))
      : (localities ?? []);

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="text-slate-500">読み込み中…</div>}>
        <OrganizationForm
          localities={localities ?? []}
          userLocalities={userLocalities}
          districts={districts ?? []}
          groups={groups ?? []}
          initialAbsenceWeeks={absenceAlertWeeks}
        />
      </Suspense>
    </div>
  );
}
