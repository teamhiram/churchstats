import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getEffectiveCurrentLocalityId } from "@/lib/cachedData";
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

  const currentLocalityId = await getEffectiveCurrentLocalityId();

  const { data: settings } = await supabase.from("system_settings").select("key, value");
  const settingsMap = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const absenceAlertWeeks = Number(settingsMap.get("absence_alert_weeks") ?? 4);

  const { data: localities } = await supabase.from("localities").select("id, name").order("name");
  const { data: allDistricts } = await supabase.from("districts").select("id, locality_id, name").order("name");
  const { data: allGroups } = await supabase.from("groups").select("id, district_id, name").order("name");

  const districts =
    currentLocalityId != null && allDistricts != null
      ? allDistricts.filter((d) => d.locality_id === currentLocalityId)
      : allDistricts ?? [];
  const districtIds = districts.map((d) => d.id);
  const groups =
    districtIds.length > 0 && allGroups != null
      ? allGroups.filter((g) => districtIds.includes(g.district_id))
      : allGroups ?? [];

  const { data: reporterDistricts } = await supabase
    .from("reporter_districts")
    .select("district_id")
    .eq("user_id", user.id);
  const reporterDistrictIds = (reporterDistricts ?? []).map((r) => r.district_id);
  const localityIdsForUser =
    reporterDistrictIds.length > 0 && allDistricts != null
      ? (allDistricts.filter((d) => reporterDistrictIds.includes(d.id)).map((d) => d.locality_id) ?? [])
      : [];
  const distinctLocalityIds = [...new Set(localityIdsForUser)];
  const userLocalities =
    role === "admin" || role === "co_admin"
      ? (localities ?? [])
      : (localities ?? []).filter((l) => distinctLocalityIds.includes(l.id));

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="text-slate-500">読み込み中…</div>}>
        <OrganizationForm
          localities={localities ?? []}
          userLocalities={userLocalities}
          districts={districts}
          groups={groups}
          initialAbsenceWeeks={absenceAlertWeeks}
          currentLocalityId={currentLocalityId}
        />
      </Suspense>
    </div>
  );
}
