import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { getDuplicateMainAttendance } from "../actions";
import { DuplicatesList } from "./DuplicatesList";

/** 重複出席ページは管理者のみアクセス可能 */
export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/weekly");

  const params = await searchParams;
  const year = params.year && Number.isFinite(Number(params.year)) ? Number(params.year) : new Date().getFullYear();
  const weekStart = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : undefined;
  const list = await getDuplicateMainAttendance(year, weekStart);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600 mt-1">
          同じ週に同一人物が複数の主日で出席登録されているレコードです。不要な方を削除してください。
        </p>
        <p className="text-sm text-slate-500 mt-1">
          {year}年
          {weekStart ? `・週 ${weekStart}` : "・全週"}
        </p>
        <p className="text-sm text-slate-500 mt-0.5">
          特定の週だけ見る: <code className="bg-slate-100 px-1 rounded">?week=2026-01-04</code>（その週の日曜日）
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-slate-600">重複はありません。</p>
      ) : (
        <DuplicatesList groups={list} />
      )}
    </div>
  );
}
