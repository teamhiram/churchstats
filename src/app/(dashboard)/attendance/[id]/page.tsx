import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { AttendanceReport } from "./AttendanceReport";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("lordsday_meeting_records")
    .select("id, event_date, meeting_type, name, district_id, group_id, locality_id")
    .eq("id", id)
    .single();
  if (!meeting) notFound();

  const { data: attendance } = await supabase
    .from("lordsday_meeting_attendance")
    .select("id, member_id")
    .eq("meeting_id", id);
  const memberIds = attendance?.map((a) => a.member_id) ?? [];
  const { data: members } = await supabase
    .from("members")
    .select("id, name, age_group, is_baptized, district_id, group_id, locality_id")
    .in("id", memberIds.length > 0 ? memberIds : ["__none__"]);
  const meetingLocalityId = (meeting as { locality_id?: string | null }).locality_id ?? null;
  const localityIdResolved =
    meetingLocalityId != null
      ? meetingLocalityId
      : meeting.district_id
        ? (await supabase.from("districts").select("locality_id").eq("id", meeting.district_id).single()).data?.locality_id ?? null
        : null;
  const { data: regularList } = await supabase
    .from("lordsday_regular_list")
    .select("id, member_id, sort_order")
    .eq("meeting_id", id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/attendance" className="text-slate-600 hover:text-slate-800 text-sm">
          ← 週別集計
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-800">{meeting.name}</h1>
        <p className="text-slate-500 text-sm">
          {format(new Date(meeting.event_date), "yyyy年M月d日(E)", { locale: ja })} · {meeting.meeting_type === "main" ? "主日集会" : "小組集会"}
        </p>
      </div>
      <AttendanceReport
        meetingId={id}
        eventDate={meeting.event_date}
        meetingType={meeting.meeting_type}
        districtId={meeting.district_id}
        meetingLocalityId={localityIdResolved}
        initialAttendance={attendance ?? []}
        initialMembers={(members ?? []).map((m) => ({
          ...m,
          locality_id: (m as { locality_id?: string | null }).locality_id ?? null,
        }))}
        regularList={regularList ?? []}
      />
    </div>
  );
}
