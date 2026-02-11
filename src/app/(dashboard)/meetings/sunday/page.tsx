import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SundayAttendance } from "./SundayAttendance";
import { getSundayWeeksInYear, getDefaultSundayWeekStart, formatDateYmd, getSundayFromWeekStart, getSundayIsoFromWeekStart } from "@/lib/weekUtils";
import { getMeetingsLayoutData } from "@/lib/cachedData";

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

  const sundayWeeks = getSundayWeeksInYear(initialYear);
  const defaultWeekStart = formatDateYmd(getDefaultSundayWeekStart(initialYear));
  const weekStartParam = params.week_start;
  const weekStartIso =
    weekStartParam && sundayWeeks.some((w) => formatDateYmd(w.weekStart) === weekStartParam)
      ? weekStartParam
      : (sundayWeeks.find((w) => formatDateYmd(w.weekStart) === defaultWeekStart)
          ? defaultWeekStart
          : formatDateYmd(sundayWeeks[0]?.weekStart ?? new Date(initialYear, 0, 1)));
  const sundayDisplay = getSundayFromWeekStart(weekStartIso);
  const initialSundayIso = getSundayIsoFromWeekStart(weekStartIso);

  const { user, profile, districts } = await getMeetingsLayoutData();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: groups } = await supabase.from("groups").select("id, name, district_id").order("name");

  const defaultDistrictId =
    params.district_id ?? (profile?.main_district_id ?? districts[0]?.id ?? "");

  return (
    <div className="space-y-6">
      <SundayAttendance
        districts={districts}
        groups={groups ?? []}
        defaultDistrictId={defaultDistrictId}
        initialSundayIso={initialSundayIso}
        sundayDisplay={sundayDisplay}
      />
    </div>
  );
}
