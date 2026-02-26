"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MeetingsListFilters } from "./MeetingsListFilters";
import { MeetingsListTable } from "./MeetingsListTable";
import type { WeekRow } from "./types";

type MeetingsListClientData = {
  year: number;
  localOnly: boolean;
  localityId: string | null;
  weeks: WeekRow[];
  absenceAlertWeeks: number;
  currentYear: number;
};

export function MeetingsListPageClient({
  searchParams,
  initialData,
}: {
  searchParams: { year?: string; localOnly?: string };
  initialData?: MeetingsListClientData;
}) {
  const currentYear = initialData?.currentYear ?? new Date().getFullYear();
  const year = Math.min(
    Math.max(Number(searchParams.year) || initialData?.year || currentYear, currentYear - 10),
    currentYear + 1
  );
  const localOnly = (searchParams.localOnly ?? (initialData?.localOnly ? "1" : "0")) !== "0";

  const localityId = initialData?.localityId ?? null;

  const { data, isPending, error } = useQuery({
    queryKey: ["meetingsList", year, localityId ?? "default", localOnly ? 1 : 0],
    queryFn: async (): Promise<MeetingsListClientData> => {
      const qs = new URLSearchParams({
        year: String(year),
        localOnly: localOnly ? "1" : "0",
      });
      const res = await fetch(`/api/meetings-list?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch meetings list");
      return res.json();
    },
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : 0,
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        データの取得に失敗しました。画面を更新してください。
      </div>
    );
  }

  const effective = data ?? initialData;
  if (isPending && !effective) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="h-10 w-48 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    );
  }

  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href={`/meetings/sunday?year=${year}`}
          className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg touch-target hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          ← 出欠登録
        </Link>
      </div>

      <MeetingsListFilters
        year={year}
        localOnly={localOnly}
        years={years}
      />

      <p className="text-xs text-slate-500">
        隔週をクリック/タップすると、各種集会の出席者が表示されます。
      </p>

      <MeetingsListTable
        weeks={effective!.weeks}
        year={year}
        localityId={localityId}
        localOnly={localOnly}
        absenceAlertWeeks={effective!.absenceAlertWeeks}
      />
    </div>
  );
}

