"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { addDays } from "date-fns";
import { getSundayWeeksInYear, getDefaultSundayWeekStart, formatDateYmd } from "@/lib/weekUtils";

type District = { id: string; name: string };

type Props = {
  districts: District[];
  defaultDistrictId: string;
};

export function MeetingsFilterBar({ districts, defaultDistrictId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentYear = new Date().getFullYear();
  const yearParam = searchParams.get("year");
  const year = yearParam ? Math.min(Math.max(Number(yearParam), currentYear - 10), currentYear + 1) : currentYear;
  const sundayWeeks = useMemo(() => getSundayWeeksInYear(year), [year]);
  const defaultWeekStart = formatDateYmd(getDefaultSundayWeekStart(year));
  const weekStartParam = searchParams.get("week_start");
  const weekStartIso =
    weekStartParam && sundayWeeks.some((w) => formatDateYmd(w.weekStart) === weekStartParam)
      ? weekStartParam
      : (sundayWeeks.find((w) => formatDateYmd(w.weekStart) === defaultWeekStart)
          ? defaultWeekStart
          : formatDateYmd(sundayWeeks[0]?.weekStart ?? new Date(year, 0, 1)));
  const districtIdParam = searchParams.get("district_id");
  const districtId =
    districtIdParam ?? (defaultDistrictId || (districts[0]?.id ?? ""));

  const updateParams = useCallback(
    (updates: { year?: number; week_start?: string; district_id?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.year != null) next.set("year", String(updates.year));
      if (updates.week_start != null) next.set("week_start", updates.week_start);
      if (updates.district_id != null) next.set("district_id", updates.district_id);
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const showFilter =
    pathname === "/meetings" ||
    pathname === "/meetings/sunday" ||
    pathname === "/meetings/prayer" ||
    pathname === "/meetings/small-group" ||
    pathname === "/meetings/organic";
  if (!showFilter) return null;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const weekOptions = sundayWeeks.map((w) => ({
    value: formatDateYmd(w.weekStart),
    label: w.label,
  }));

  const [y, m, d] = weekStartIso.split("-").map(Number);
  const currentWeekStart = new Date(y, m - 1, d);
  const prevWeekStart = addDays(currentWeekStart, -7);
  const nextWeekStart = addDays(currentWeekStart, 7);
  const prevWeekIso = formatDateYmd(prevWeekStart);
  const nextWeekIso = formatDateYmd(nextWeekStart);

  const goPrevWeek = useCallback(() => {
    const newYear = prevWeekStart.getFullYear();
    updateParams({ year: newYear, week_start: prevWeekIso });
  }, [prevWeekIso, prevWeekStart, updateParams]);
  const goNextWeek = useCallback(() => {
    const newYear = nextWeekStart.getFullYear();
    updateParams({ year: newYear, week_start: nextWeekIso });
  }, [nextWeekIso, nextWeekStart, updateParams]);

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 md:px-6 m-0">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.4fr)_1.7fr_minmax(0,0.5fr)] max-w-3xl">
        <div className="min-w-0">
          <select
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              const weeks = getSundayWeeksInYear(y);
              const def = formatDateYmd(getDefaultSundayWeekStart(y));
              const ws = weeks.find((w) => formatDateYmd(w.weekStart) === def)
                ? def
                : formatDateYmd(weeks[0]?.weekStart ?? new Date(y, 0, 1));
              updateParams({ year: y, week_start: ws });
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevWeek}
            className="shrink-0 px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 touch-target text-sm text-slate-700"
            aria-label="先週"
          >
            先週
          </button>
          <select
            value={weekStartIso}
            onChange={(e) => updateParams({ week_start: e.target.value })}
            className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            {weekOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={goNextWeek}
            className="shrink-0 px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 touch-target text-sm text-slate-700"
            aria-label="翌週"
          >
            翌週
          </button>
        </div>
        <div className="min-w-0">
          <select
            value={districtId}
            onChange={(e) => updateParams({ district_id: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            <option value="">選択</option>
            <option value="__all__">全ての地区</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
