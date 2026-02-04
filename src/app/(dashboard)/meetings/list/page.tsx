import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { getListData } from "./actions";
import { MeetingsListFilters } from "./MeetingsListFilters";
import { MeetingsListTable } from "./MeetingsListTable";

export default async function MeetingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; locality?: string; localOnly?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Math.min(Math.max(Number(params.year) || currentYear, currentYear - 10), currentYear + 1);
  const localOnly = params.localOnly !== "0";

  const supabase = await createClient();
  const { data: localities } = await supabase
    .from("localities")
    .select("id, name")
    .order("name");

  // クエリに地方がなければアカウントのデフォルト地方を使う
  let defaultLocalityId: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("main_district_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.main_district_id) {
      const { data: district } = await supabase
        .from("districts")
        .select("locality_id")
        .eq("id", profile.main_district_id)
        .maybeSingle();
      if (district?.locality_id) defaultLocalityId = district.locality_id;
    }
  }
  const localityId =
    params.locality && params.locality !== "all" ? params.locality : defaultLocalityId;

  const { weeks, absenceAlertWeeks } = await getListData(year, localityId, localOnly);

  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800">週別集計</h1>
        <Link
          href={`/meetings/sunday?year=${year}`}
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg touch-target hover:bg-slate-700"
        >
          ← 出欠登録
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 w-48 rounded-lg bg-slate-100 animate-pulse" />}>
        <MeetingsListFilters
          year={year}
          localityId={localityId}
          localOnly={localOnly}
          years={years}
          localities={localities ?? []}
        />
      </Suspense>

      <p className="text-xs text-slate-500">
        欠席アラート: 過去{absenceAlertWeeks}週間の出席者で今週欠席した方を表示。派遣先にある名前は青、ない名前は赤。
      </p>

      <MeetingsListTable
        weeks={weeks}
        year={year}
        localityId={localityId}
        localOnly={localOnly}
        absenceAlertWeeks={absenceAlertWeeks}
      />
    </div>
  );
}
