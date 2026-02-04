import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SundayAttendance } from "./SundayAttendance";
import { getMondayWeeksInYear, getDefaultMondayWeekStart, formatDateYmd, getSundayFromWeekStart, getSundayIsoFromWeekStart } from "@/lib/weekUtils";

export default async function SundayAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week_start?: string; district_id?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const yearFromUrl = params.year != null ? Number(params.year) : NaN;
  const initialYear = Number.isFinite(yearFromUrl)
    ? Math.min(Math.max(yearFromUrl, currentYear - 10), currentYear + 1)
    : currentYear;

  const mondayWeeks = getMondayWeeksInYear(initialYear);
  const defaultWeekStart = formatDateYmd(getDefaultMondayWeekStart(initialYear));
  const weekStartParam = params.week_start;
  const weekStartIso =
    weekStartParam && mondayWeeks.some((w) => formatDateYmd(w.weekStart) === weekStartParam)
      ? weekStartParam
      : (mondayWeeks.find((w) => formatDateYmd(w.weekStart) === defaultWeekStart)
          ? defaultWeekStart
          : formatDateYmd(mondayWeeks[0]?.weekStart ?? new Date(initialYear, 0, 1)));
  const sundayDisplay = getSundayFromWeekStart(weekStartIso);
  const initialSundayIso = getSundayIsoFromWeekStart(weekStartIso);

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

  const defaultDistrictId =
    params.district_id ?? (profile?.main_district_id ?? districts?.[0]?.id ?? "");

  return (
    <div className="space-y-6">
      <p className="text-lg font-medium text-slate-800">主日：{sundayDisplay}</p>
      <SundayAttendance
        districts={districts ?? []}
        groups={groups ?? []}
        defaultDistrictId={defaultDistrictId}
        initialSundayIso={initialSundayIso}
      />
    </div>
  );
}
