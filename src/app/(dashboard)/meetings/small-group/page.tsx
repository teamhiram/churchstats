import { redirect } from "next/navigation";
import { SmallGroupAttendance } from "./SmallGroupAttendance";
import { getMondayWeeksInYear, getDefaultMondayWeekStart, formatDateYmd } from "@/lib/weekUtils";
import { getMeetingsLayoutData } from "@/lib/cachedData";

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

  const mondayWeeks = getMondayWeeksInYear(initialYear);
  const defaultWeekStart = formatDateYmd(getDefaultMondayWeekStart(initialYear));
  const weekStartParam = params.week_start;
  const weekStartIso =
    weekStartParam && mondayWeeks.some((w) => formatDateYmd(w.weekStart) === weekStartParam)
      ? weekStartParam
      : (mondayWeeks.find((w) => formatDateYmd(w.weekStart) === defaultWeekStart)
          ? defaultWeekStart
          : formatDateYmd(mondayWeeks[0]?.weekStart ?? new Date(initialYear, 0, 1)));

  const { user, profile, districts } = await getMeetingsLayoutData();
  if (!user) redirect("/login");

  const role = profile?.role ?? "viewer";
  const canSeeAllDistricts = role === "admin" || role === "co_admin" || role === "reporter";
  const defaultDistrictId =
    params.district_id ?? (canSeeAllDistricts ? "__all__" : (profile?.main_district_id ?? districts[0]?.id ?? ""));

  if (canSeeAllDistricts && params.district_id == null) {
    const q = new URLSearchParams();
    q.set("district_id", "__all__");
    if (params.year != null) q.set("year", params.year);
    if (params.week_start != null) q.set("week_start", params.week_start);
    redirect(`/meetings/small-group?${q.toString()}`);
  }

  return (
    <div className="space-y-6">
      <SmallGroupAttendance
        districts={districts}
        defaultDistrictId={defaultDistrictId}
        initialYear={initialYear}
        initialWeekStartIso={weekStartIso}
        weekOptions={mondayWeeks.map((w) => ({
          value: formatDateYmd(w.weekStart),
          label: w.label,
        }))}
      />
    </div>
  );
}
