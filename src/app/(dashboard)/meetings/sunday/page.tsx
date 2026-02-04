import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SundayAttendance } from "./SundayAttendance";
import { getSundaysInYear, getDefaultSunday, formatDateYmd } from "@/lib/weekUtils";

export default async function SundayAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const yearFromUrl = params.year != null ? Number(params.year) : NaN;
  const initialYear = Number.isFinite(yearFromUrl)
    ? Math.min(Math.max(yearFromUrl, currentYear - 10), currentYear + 1)
    : currentYear;
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

  const { data: groups } = await supabase.from("groups").select("id, name, district_id").order("name");

  const sundays = getSundaysInYear(initialYear);
  const defaultSunday = getDefaultSunday(initialYear);
  const defaultSundayIso = formatDateYmd(defaultSunday);
  const weekFromUrl = params.week; // optional: ISO date of Sunday (yyyy-MM-dd) to open that week
  const initialSundayIso =
    weekFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(weekFromUrl) && sundays.some((s) => formatDateYmd(s.date) === weekFromUrl)
      ? weekFromUrl
      : (sundays.find((s) => formatDateYmd(s.date) === defaultSundayIso) ? defaultSundayIso : formatDateYmd(sundays[0]?.date ?? defaultSunday));

  return (
    <div className="space-y-6">
      <SundayAttendance
        districts={districts ?? []}
        groups={groups ?? []}
        defaultDistrictId={profile?.main_district_id ?? districts?.[0]?.id ?? ""}
        initialYear={initialYear}
        initialSundayIso={initialSundayIso}
        sundayOptions={sundays.map((s) => ({ value: formatDateYmd(s.date), label: s.label }))}
      />
    </div>
  );
}
