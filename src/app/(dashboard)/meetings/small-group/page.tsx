import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SmallGroupAttendance } from "./SmallGroupAttendance";
import { getMondayWeeksInYear, getDefaultMondayWeekStart, formatDateYmd } from "@/lib/weekUtils";

export default async function SmallGroupAttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("main_district_id, role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "viewer";
  const canSeeAllDistricts = role === "admin" || role === "co_admin" || role === "reporter";

  let districtIds: string[] = [];
  if (!canSeeAllDistricts) {
    const { data: reporterDistricts } = await supabase
      .from("reporter_districts")
      .select("district_id")
      .eq("user_id", user.id);
    districtIds = [
      ...(profile?.main_district_id ? [profile.main_district_id] : []),
      ...(reporterDistricts ?? []).map((r) => r.district_id),
    ].filter((id, i, arr) => arr.indexOf(id) === i);
  }

  const { data: districts } = canSeeAllDistricts
    ? await supabase.from("districts").select("id, name").order("name")
    : await supabase
        .from("districts")
        .select("id, name")
        .in("id", districtIds.length > 0 ? districtIds : ["__none__"])
        .order("name");

  const currentYear = new Date().getFullYear();
  const mondayWeeks = getMondayWeeksInYear(currentYear);
  const defaultWeekStart = getDefaultMondayWeekStart(currentYear);
  const defaultWeekStartIso = formatDateYmd(defaultWeekStart);
  const defaultWeekOption = mondayWeeks.find((w) => formatDateYmd(w.weekStart) === defaultWeekStartIso) ?? mondayWeeks[0];

  return (
    <div className="space-y-6">
      <SmallGroupAttendance
        districts={districts ?? []}
        defaultDistrictId={profile?.main_district_id ?? districts?.[0]?.id ?? ""}
        initialYear={currentYear}
        initialWeekStartIso={defaultWeekOption ? formatDateYmd(defaultWeekOption.weekStart) : defaultWeekStartIso}
        weekOptions={mondayWeeks.map((w) => ({
          value: formatDateYmd(w.weekStart),
          label: w.label,
        }))}
      />
    </div>
  );
}
