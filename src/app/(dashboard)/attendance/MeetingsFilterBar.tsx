"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { addDays } from "date-fns";
import { getSundayWeeksInYear, getDefaultSundayWeekStart, formatDateYmd } from "@/lib/weekUtils";

type District = { id: string; name: string };

type Props = {
  districts: District[];
  defaultDistrictId: string;
  disabled?: boolean;
};

export function MeetingsFilterBar({ districts, defaultDistrictId, disabled = false }: Props) {
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
    districtIdParam && (districtIdParam === "__all__" || districts.some((d) => d.id === districtIdParam))
      ? districtIdParam
      : (defaultDistrictId || (districts[0]?.id ?? ""));

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

  const showFilter =
    pathname === "/attendance" ||
    pathname === "/attendance/lordsday" ||
    pathname === "/attendance/prayer" ||
    pathname === "/attendance/small-group" ||
    pathname === "/attendance/organic";
  if (!showFilter) return null;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const weekOptions = sundayWeeks.map((w) => ({
    value: formatDateYmd(w.weekStart),
    label: w.label,
  }));

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 md:px-6 m-0">
      <div className="grid grid-cols-2 gap-3 gap-y-3 sm:grid-cols-[minmax(0,0.4fr)_1.7fr_minmax(0,0.5fr)] sm:gap-4 max-w-3xl">
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
            disabled={disabled}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 order-3 sm:order-2 col-span-2 row-start-2 sm:col-span-1 sm:row-auto flex items-center gap-2 text-sm sm:text-base">
          <button
            type="button"
            onClick={goPrevWeek}
            disabled={disabled}
            className="shrink-0 px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 touch-target text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="先週"
          >
            先週
          </button>
          <select
            value={weekStartIso}
            onChange={(e) => updateParams({ week_start: e.target.value })}
            disabled={disabled}
            className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-lg touch-target disabled:opacity-60 disabled:cursor-not-allowed"
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
            disabled={disabled}
            className="shrink-0 px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 touch-target text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="翌週"
          >
            翌週
          </button>
        </div>
        <div className="min-w-0 order-2 sm:order-3">
          <select
            value={districtId}
            onChange={(e) => updateParams({ district_id: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target disabled:opacity-60 disabled:cursor-not-allowed"
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
