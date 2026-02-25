import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import { getLanguageLabel } from "@/lib/languages";
import { EnrollmentMemoHtml } from "@/components/EnrollmentMemoHtml";

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
  const { data: member } = await supabase.from("members").select("*").eq("id", id).single();
  if (!member) notFound();

  const [districtRes, groupRes, localityRes, followerRes, periodsRes] = await Promise.all([
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
  ]);

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
      <Link href="/members" className="text-slate-600 hover:text-slate-800 text-sm">
        ← 名簿管理
      </Link>
      <div className="bg-white rounded-lg border border-slate-200 p-2 space-y-2">
        <h1 className="text-xl font-bold text-slate-800">{member.name}</h1>
        {member.furigana && (
          <p className="text-sm text-slate-500">{member.furigana}</p>
        )}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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
      <div>
        <Link
          href={`/members/${id}/edit`}
          className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg touch-target"
        >
          編集
        </Link>
      </div>
    </div>
  );
}
