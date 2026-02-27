import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import type { DispatchType } from "@/types/database";
import { getLanguageLabel } from "@/lib/languages";
import { EnrollmentMemoHtml } from "@/components/EnrollmentMemoHtml";
import { MemberAttendanceMatrix } from "./MemberAttendanceMatrix";
import { MemberNameDropdown } from "./MemberNameDropdown";
import { MemberDispatchSection } from "./MemberDispatchSection";
import { EditPencilIcon } from "@/components/icons/EditPencilIcon";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { getSundayWeeksInYear, formatDateYmd } from "@/lib/weekUtils";

const BAPTISM_PRECISION_LABELS: Record<string, string> = {
  exact: "日付確定",
  unknown: "不明",
  approximate: "おおよそ",
};

function formatBaptismDate(m: {
  baptism_year?: number | null;
  baptism_month?: number | null;
  baptism_day?: number | null;
}): string {
  if (m.baptism_year != null && m.baptism_month != null && m.baptism_day != null) {
    return `${m.baptism_year}-${String(m.baptism_month).padStart(2, "0")}-${String(m.baptism_day).padStart(2, "0")}`;
  }
  if (m.baptism_year != null && m.baptism_month != null) return `${m.baptism_year}-${String(m.baptism_month).padStart(2, "0")}`;
  if (m.baptism_year != null) return String(m.baptism_year);
  return "—";
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [memberRes, allMembersRes] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).single(),
    supabase.from("members").select("id, name").order("name"),
  ]);
  const { data: member } = memberRes;
  const allMembers = (allMembersRes.data ?? []) as { id: string; name: string }[];
  if (!member) notFound();

  const [districtRes, groupRes, localityRes, followerRes, periodsRes, dispatchRes] = await Promise.all([
    member.district_id ? supabase.from("districts").select("id, name").eq("id", member.district_id).single() : Promise.resolve({ data: null }),
    member.group_id ? supabase.from("groups").select("id, name").eq("id", member.group_id).single() : Promise.resolve({ data: null }),
    (member as { locality_id?: string | null }).locality_id
      ? supabase.from("localities").select("id, name").eq("id", (member as { locality_id: string }).locality_id).single()
      : Promise.resolve({ data: null }),
    (member as { follower_id?: string | null }).follower_id
      ? supabase.from("members").select("id, name").eq("id", (member as { follower_id: string }).follower_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("member_local_enrollment_periods")
      .select("period_no, join_date, leave_date, is_uncertain, memo")
      .eq("member_id", id)
      .order("period_no"),
    supabase
      .from("organic_dispatch_records")
      .select("id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo, visitor_ids")
      .eq("member_id", id)
      .order("week_start", { ascending: true }),
  ]);

  const dispatchRecords = (dispatchRes.data ?? []) as {
    id: string;
    group_id: string;
    week_start: string;
    dispatch_type: DispatchType | null;
    dispatch_date: string | null;
    dispatch_memo: string | null;
    visitor_ids?: string[] | null;
  }[];
  const dispatchGroupIds = [...new Set(dispatchRecords.map((r) => r.group_id))];
  const visitorIds = [...new Set(dispatchRecords.flatMap((r) => r.visitor_ids ?? []))];
  const visitorIdToName = new Map(allMembers.map((m) => [m.id, m.name]));
  if (visitorIds.length > 0) {
    const missing = visitorIds.filter((vid) => !visitorIdToName.has(vid));
    if (missing.length > 0) {
      const { data: visitorNames } = await supabase.from("members").select("id, name").in("id", missing);
      (visitorNames ?? []).forEach((row: { id: string; name: string }) => visitorIdToName.set(row.id, row.name));
    }
  }
  let dispatchGroupMap = new Map<string, string>();
  if (dispatchGroupIds.length > 0) {
    const { data: groupsData } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", dispatchGroupIds);
    dispatchGroupMap = new Map(
      ((groupsData ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name])
    );
  }

  type DispatchRecord = {
    id: string;
    group_id: string;
    week_start: string;
    dispatch_type: DispatchType | null;
    dispatch_date: string | null;
    dispatch_memo: string | null;
    visitor_ids?: string[] | null;
  };
  const weekStartToNumber = new Map<string, number>();
  const yearsInDispatch = [...new Set(dispatchRecords.map((r) => r.week_start.slice(0, 4)))].map(
    (y) => Number(y)
  );
  yearsInDispatch.forEach((year) => {
    getSundayWeeksInYear(year).forEach((w) => {
      weekStartToNumber.set(formatDateYmd(w.weekStart), w.weekNumber);
    });
  });
  const recordsByWeek = new Map<string, DispatchRecord[]>();
  for (const r of dispatchRecords) {
    const list = recordsByWeek.get(r.week_start) ?? [];
    list.push(r);
    recordsByWeek.set(r.week_start, list);
  }
  for (const list of recordsByWeek.values()) {
    list.sort((a, b) => (a.dispatch_date ?? "").localeCompare(b.dispatch_date ?? ""));
  }
  const sortedWeekStarts = [...recordsByWeek.keys()].sort();

  // 派遣追加フォーム用: メンバーの地方に属する小組、または全小組
  const memberLocalityId = (member as { locality_id?: string | null }).locality_id ?? null;
  let dispatchFormGroups: { id: string; name: string }[] = [];
  if (memberLocalityId) {
    const { data: distRows } = await supabase
      .from("districts")
      .select("id")
      .eq("locality_id", memberLocalityId);
    const districtIds = (distRows ?? []).map((d: { id: string }) => d.id);
    if (districtIds.length > 0) {
      const { data: grpRows } = await supabase
        .from("groups")
        .select("id, name")
        .in("district_id", districtIds)
        .order("name");
      dispatchFormGroups = (grpRows ?? []) as { id: string; name: string }[];
    }
  }
  if (dispatchFormGroups.length === 0) {
    const { data: allGrp } = await supabase.from("groups").select("id, name").order("name");
    dispatchFormGroups = (allGrp ?? []) as { id: string; name: string }[];
  }

  // 週ドロップダウン用: 当年・前年の日曜週
  const currentYear = new Date().getFullYear();
  const yearsForWeeks = [currentYear - 1, currentYear];
  const weekOptions: { value: string; label: string }[] = [];
  yearsForWeeks.forEach((year) => {
    getSundayWeeksInYear(year).forEach((w) => {
      const iso = formatDateYmd(w.weekStart);
      weekStartToNumber.set(iso, w.weekNumber);
      weekOptions.push({
        value: iso,
        label: `W${w.weekNumber}（${format(w.weekStart, "yyyy/M/d", { locale: ja })} - ${format(w.weekEnd, "yyyy/M/d", { locale: ja })}）`,
      });
    });
  });
  weekOptions.sort((a, b) => a.value.localeCompare(b.value));

  const district = districtRes.data as { id: string; name: string } | null;
  const group = groupRes.data as { id: string; name: string } | null;
  const locality = localityRes.data as { id: string; name: string } | null;
  const follower = followerRes.data as { id: string; name: string } | null;
  const enrollmentPeriods = (periodsRes.data ?? []).map((p: { period_no: number; join_date?: string | null; leave_date?: string | null; is_uncertain?: boolean; memo?: string | null }) => ({
    period_no: p.period_no,
    join_date: p.join_date ?? null,
    leave_date: p.leave_date ?? null,
    is_uncertain: Boolean(p.is_uncertain),
    memo: p.memo ?? null,
  }));

  const m = member as Record<string, unknown>;
  const baptismDate = formatBaptismDate({
    baptism_year: m.baptism_year as number | null,
    baptism_month: m.baptism_month as number | null,
    baptism_day: m.baptism_day as number | null,
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <MemberNameDropdown currentId={id} members={allMembers} />
      </div>
      <Link href="/members" className="text-slate-600 hover:text-slate-800 text-sm">
        ← 名簿管理
      </Link>
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-slate-800">プロフィール</h2>
          <Link
            href={`/members/${id}/edit`}
            aria-label="プロフィールを編集"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-400 touch-target shrink-0"
          >
            <EditPencilIcon className="w-4 h-4" aria-hidden />
          </Link>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">フリガナ</dt>
          <dd className="text-slate-800">{member.furigana ?? "—"}</dd>
          <dt className="text-slate-500">性別</dt>
          <dd className="text-slate-800">{member.gender === "male" ? "男" : "女"}</dd>
          <dt className="text-slate-500">ローカル/ゲスト</dt>
          <dd className="text-slate-800">{member.is_local ? "ローカル" : "ゲスト"}</dd>
          <dt className="text-slate-500">地区</dt>
          <dd className="text-slate-800">{district?.name ?? "—"}</dd>
          <dt className="text-slate-500">小組</dt>
          <dd className="text-slate-800">{group?.name ?? (member.is_local ? "未所属" : "—")}</dd>
          <dt className="text-slate-500">区分</dt>
          <dd className="text-slate-800">{member.age_group ? CATEGORY_LABELS[member.age_group as Category] : "—"}</dd>
          <dt className="text-slate-500">聖徒/友人</dt>
          <dd className="text-slate-800">{member.is_baptized ? "聖徒" : "友人"}</dd>
          <dt className="text-slate-500">バプテスマ日</dt>
          <dd className="text-slate-800">{baptismDate}</dd>
          {m.baptism_date_precision && (
            <>
              <dt className="text-slate-500">バプテスマ日精度</dt>
              <dd className="text-slate-800">{BAPTISM_PRECISION_LABELS[String(m.baptism_date_precision)] ?? String(m.baptism_date_precision)}</dd>
            </>
          )}
          <dt className="text-slate-500">主言語</dt>
          <dd className="text-slate-800">{getLanguageLabel(m.language_main as string)}</dd>
          <dt className="text-slate-500">副言語</dt>
          <dd className="text-slate-800">{getLanguageLabel(m.language_sub as string)}</dd>
          {(m.locality_id != null && locality) && (
            <>
              <dt className="text-slate-500">地方</dt>
              <dd className="text-slate-800">{locality.name}</dd>
            </>
          )}
          {m.follower_id && (
            <>
              <dt className="text-slate-500">フォロー担当</dt>
              <dd className="text-slate-800">{follower?.name ?? (m.follower_id as string)}</dd>
            </>
          )}
          {member.is_local && enrollmentPeriods.length > 0 && (
            <>
              <dt className="text-slate-500">在籍期間</dt>
              <dd className="text-slate-800">
                {enrollmentPeriods.map((p, i) => (
                  <div key={p.period_no} className={i > 0 ? "mt-1" : ""}>
                    期間{i + 1}: 転入 {p.join_date ?? "—"} / 転出 {p.leave_date ?? "—"}
                    {p.is_uncertain && " (不確定)"}
                  </div>
                ))}
              </dd>
              {enrollmentPeriods.some((p) => p.memo) && (
                <>
                  <dt className="text-slate-500">在籍メモ</dt>
                  <dd className="text-slate-800">
                    {enrollmentPeriods.map((p, i) =>
                      p.memo ? (
                        <div key={p.period_no} className={i > 0 ? "mt-2" : ""}>
                          <span className="text-slate-500 font-medium">期間{i + 1}: </span>
                          <EnrollmentMemoHtml memo={p.memo} />
                        </div>
                      ) : null
                    )}
                  </dd>
                </>
              )}
            </>
          )}
        </dl>
      </div>

      <MemberDispatchSection
        memberId={id}
        memberName={member.name}
        defaultGroupId={member.group_id ?? null}
        dispatchRecords={dispatchRecords}
        dispatchGroupMap={dispatchGroupMap}
        visitorIdToName={visitorIdToName}
        groups={dispatchFormGroups}
        allMembers={allMembers}
        weekOptions={weekOptions}
        sortedWeekStarts={sortedWeekStarts}
        recordsByWeek={recordsByWeek}
        weekStartToNumber={weekStartToNumber}
      />

      <MemberAttendanceMatrix memberId={id} />
    </div>
  );
}
