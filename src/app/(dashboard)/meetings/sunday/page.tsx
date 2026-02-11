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
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "sunday/page.tsx:weekResolution",
      message: "resolved week params",
      data: {
        yearFromUrl: params.year ?? null,
        weekStartFromUrl: params.week_start ?? null,
        districtFromUrl: params.district_id ?? null,
        initialYear,
        weekStartIso,
        initialSundayIso,
      },
      timestamp: Date.now(),
      hypothesisId: "H9,H10",
    }),
  }).catch(() => {});
  // #endregion

  const { user, profile, districts } = await getMeetingsLayoutData();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // #region agent log
  if (initialSundayIso === "2026-02-08") {
    try {
      const { data: meetingsOnTarget } = await supabase
        .from("meetings")
        .select("id, event_date, meeting_type, district_id, locality_id, name")
        .eq("event_date", "2026-02-08")
        .eq("meeting_type", "main");

      const targetMeetings = (meetingsOnTarget ?? []) as {
        id: string;
        event_date: string;
        meeting_type: string;
        district_id: string | null;
        locality_id: string | null;
        name: string | null;
      }[];
      const targetMeetingIds = targetMeetings.map((m) => m.id);

      let attendanceRows: {
        id: string;
        meeting_id: string;
        member_id: string;
        district_id: string | null;
        attended: boolean | null;
      }[] = [];
      if (targetMeetingIds.length > 0) {
        const { data: attData } = await supabase
          .from("attendance_records")
          .select("id, meeting_id, member_id, district_id, attended")
          .in("meeting_id", targetMeetingIds);
        attendanceRows = (attData ?? []) as {
          id: string;
          meeting_id: string;
          member_id: string;
          district_id: string | null;
          attended: boolean | null;
        }[];
      }

      const attendanceCountByMeeting: Record<string, number> = {};
      attendanceRows.forEach((r) => {
        attendanceCountByMeeting[r.meeting_id] = (attendanceCountByMeeting[r.meeting_id] ?? 0) + 1;
      });

      const { data: nearbyMeetings } = await supabase
        .from("meetings")
        .select("id, event_date, meeting_type, district_id, locality_id, name")
        .gte("event_date", "2026-01-25")
        .lte("event_date", "2026-02-15")
        .eq("meeting_type", "main")
        .or("district_id.eq.33333333-3333-3333-3333-333333333333,locality_id.eq.11111111-1111-1111-1111-111111111111")
        .order("event_date", { ascending: true });

      const nearby = (nearbyMeetings ?? []) as {
        id: string;
        event_date: string;
        meeting_type: string;
        district_id: string | null;
        locality_id: string | null;
        name: string | null;
      }[];
      const nearbyIds = nearby.map((m) => m.id);
      let nearbyAttendance: { meeting_id: string }[] = [];
      if (nearbyIds.length > 0) {
        const { data: nearAtt } = await supabase
          .from("attendance_records")
          .select("meeting_id")
          .in("meeting_id", nearbyIds);
        nearbyAttendance = (nearAtt ?? []) as { meeting_id: string }[];
      }
      const nearbyAttendanceCountByMeeting: Record<string, number> = {};
      nearbyAttendance.forEach((r) => {
        nearbyAttendanceCountByMeeting[r.meeting_id] = (nearbyAttendanceCountByMeeting[r.meeting_id] ?? 0) + 1;
      });

      fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "sunday/page.tsx:targetDateDump",
          message: "2026-02-08 meetings + attendance dump",
          data: {
            targetDate: "2026-02-08",
            meetingsCount: targetMeetings.length,
            meetings: targetMeetings,
            attendanceCount: attendanceRows.length,
            attendanceCountByMeeting,
            sampleAttendance: attendanceRows.slice(0, 30),
            nearbyMeetings: nearby,
            nearbyAttendanceCountByMeeting,
          },
          timestamp: Date.now(),
          hypothesisId: "H11",
        }),
      }).catch(() => {});
    } catch (_) {}
  }
  // #endregion
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
