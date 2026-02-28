import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { getDebugJan4SundayAttendees, getDebugSundayAttendees } from "../actions";

/** デバッグページは管理者のみアクセス可能 */
export default async function DebugJan4Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; date?: string }>;
}) {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/weekly");

  const params = await searchParams;
  const data = params.date
    ? await getDebugSundayAttendees(params.date)
    : await getDebugJan4SundayAttendees(
        params.year && Number.isFinite(Number(params.year)) ? Number(params.year) : new Date().getFullYear()
      );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-slate-600">
          対象日: <span className="font-mono">{data.date}</span>
          {params.date && (
            <span className="ml-2 text-slate-500">
              （週別集計で人数差が出る週の日曜日を <code className="bg-slate-100 px-1">?date=yyyy-MM-dd</code> で指定）
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="border border-slate-200 rounded-lg bg-white p-4">
          <h2 className="font-medium text-slate-800 mb-2">
            ローカル（{data.local.length}）
          </h2>
          <p className="text-slate-800">
            {data.local.length === 0 ? "—" : data.local.map((m) => `${m.name}（${m.furigana}）`).join("、")}
          </p>
        </section>

        <section className="border border-slate-200 rounded-lg bg-white p-4">
          <h2 className="font-medium text-slate-800 mb-2">
            非ローカル（{data.nonLocal.length}）
          </h2>
          <p className="text-slate-800">
            {data.nonLocal.length === 0 ? "—" : data.nonLocal.map((m) => `${m.name}（${m.furigana}）`).join("、")}
          </p>
          {data.nonLocal.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              ↑ 週別集計で「ローカルのみ」オフ時に加算される出席者です。
            </p>
          )}
        </section>
      </div>
      {!params.date && (
        <p className="text-sm text-slate-500">
          週別集計で 37→39 のように差が出る週の日曜日が分かれば、{" "}
          <code className="bg-slate-100 px-1 rounded">/weekly/debug-jan4?date=yyyy-MM-dd</code>{" "}
          でその週の非ローカル出席者を確認できます。
        </p>
      )}
    </div>
  );
}

