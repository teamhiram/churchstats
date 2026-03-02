import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrayerMeetingAttendance } from "./PrayerMeetingAttendance";
import { getSundayWeeksInYear, getDefaultSundayWeekStart, formatDateYmd } from "@/lib/weekUtils";
import { getMeetingsLayoutData, effectiveDistrictIdForCurrentLocality } from "@/lib/cachedData";

export default async function PrayerMeetingPage({
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

  const supabase = await createClient();
  const { data: groups } = await supabase.from("groups").select("id, name, district_id").order("name");

  const layoutDefault = (profile?.main_district_id && districts.some((d) => d.id === profile.main_district_id) ? profile.main_district_id : null) ?? districts[0]?.id ?? "";
  const defaultDistrictId = effectiveDistrictIdForCurrentLocality(params.district_id, { districts, defaultDistrictId: layoutDefault }, { allowAllDistricts: true });

  return (
    <div className="space-y-6">
      <PrayerMeetingAttendance
        districts={districts}
        groups={groups ?? []}
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
