import { redirect } from "next/navigation";
import { SmallGroupAttendance } from "./SmallGroupAttendance";
import { getSundayWeeksInYear, getDefaultSundayWeekStart, formatDateYmd } from "@/lib/weekUtils";
import { getMeetingsLayoutData, effectiveDistrictIdForCurrentLocality } from "@/lib/cachedData";

export default async function SmallGroupAttendancePage({
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

  const sundayWeeks = getSundayWeeksInYear(initialYear);
  const defaultWeekStart = formatDateYmd(getDefaultSundayWeekStart(initialYear));
  const weekStartParam = params.week_start;
  const weekStartIso =
    weekStartParam && sundayWeeks.some((w) => formatDateYmd(w.weekStart) === weekStartParam)
      ? weekStartParam
      : (sundayWeeks.find((w) => formatDateYmd(w.weekStart) === defaultWeekStart)
          ? defaultWeekStart
          : formatDateYmd(sundayWeeks[0]?.weekStart ?? new Date(initialYear, 0, 1)));

  const { user, profile, districts } = await getMeetingsLayoutData();
  if (!user) redirect("/login");

  const role = profile?.role ?? "viewer";
  const canSeeAllDistricts = role === "admin" || role === "co_admin" || role === "reporter";
  const layoutDefault = canSeeAllDistricts ? "__all__" : ((profile?.main_district_id && districts.some((d) => d.id === profile.main_district_id) ? profile.main_district_id : null) ?? districts[0]?.id ?? "");
  const defaultDistrictId = effectiveDistrictIdForCurrentLocality(params.district_id, { districts, defaultDistrictId: layoutDefault }, { allowAllDistricts: true });

  if (canSeeAllDistricts && params.district_id == null) {
    const q = new URLSearchParams();
    q.set("district_id", "__all__");
    if (params.year != null) q.set("year", params.year);
    if (params.week_start != null) q.set("week_start", params.week_start);
    redirect(`/attendance/small-group?${q.toString()}`);
  }

  return (
    <div className="space-y-6">
      <SmallGroupAttendance
        districts={districts}
        defaultDistrictId={defaultDistrictId}
        initialYear={initialYear}
        initialWeekStartIso={weekStartIso}
        weekOptions={sundayWeeks.map((w) => ({
          value: formatDateYmd(w.weekStart),
          label: w.label,
        }))}
      />
    </div>
  );
}
