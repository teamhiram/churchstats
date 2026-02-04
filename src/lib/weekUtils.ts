import { addDays, getDay, nextSunday, startOfWeek, startOfYear, format } from "date-fns";
import { ja } from "date-fns/locale";

/** 年の全日曜日（1/1〜12/31）を返す。表示用: 1週目（yyyy/MM/dd） */
export function getSundaysInYear(year: number): { weekNumber: number; date: Date; label: string }[] {
  const result: { weekNumber: number; date: Date; label: string }[] = [];
  const start = startOfYear(new Date(year, 0, 1));
  let d = getDay(start) === 0 ? start : addDays(start, 7 - getDay(start));
  let n = 1;
  while (d.getFullYear() === year) {
    result.push({
      weekNumber: n,
      date: d,
      label: `${n}週目（${format(d, "yyyy/MM/dd")}）`,
    });
    d = addDays(d, 7);
    n++;
  }
  return result;
}

/** 今日までで一番近い過去の日曜日 */
export function getDefaultSunday(year: number): Date {
  const today = new Date();
  if (today.getFullYear() !== year) {
    const sundays = getSundaysInYear(year);
    return sundays.length > 0 ? sundays[sundays.length - 1].date : new Date(year, 11, 31);
  }
  const sun = nextSunday(today);
  const prevSun = addDays(sun, -7);
  return prevSun <= today ? prevSun : addDays(prevSun, -7);
}

/** 年の月曜始まり週（月曜日を week_start とする）。表示: n週目（yyyy/MM/dd - yyyy/MM/dd） */
export function getMondayWeeksInYear(year: number): { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] {
  const result: { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] = [];
  const jan1 = new Date(year, 0, 1);
  const daysUntilMonday = (8 - getDay(jan1)) % 7;
  let d = addDays(jan1, daysUntilMonday);
  let n = 1;
  while (d.getFullYear() === year) {
    const end = addDays(d, 6);
    result.push({
      weekNumber: n,
      weekStart: new Date(d),
      weekEnd: new Date(end),
      label: `${n}週目（${format(d, "yyyy/MM/dd", { locale: ja })} - ${format(end, "yyyy/MM/dd", { locale: ja })}）`,
    });
    n++;
    d = addDays(d, 7);
  }
  return result;
}

/**
 * 今週：本日を含む一番近い過去の日曜日までの1週間（月曜〜日曜）。
 * 欠席アラート等で「今週」の定義に使用する。
 */
export function getThisWeekByLastSunday(): { weekStart: Date; weekEnd: Date } {
  const today = new Date();
  const weekEnd = addDays(today, -getDay(today)); // 一番近い過去の日曜日（今日が日曜なら今日）
  const weekStart = addDays(weekEnd, -6);
  return { weekStart, weekEnd };
}

/** 今日に一番近い過去の月曜日（週の起点）。今週の月曜日を返す */
export function getDefaultMondayWeekStart(year: number): Date {
  const today = new Date();
  const mon = startOfWeek(today, { weekStartsOn: 1 });
  const weeks = getMondayWeeksInYear(year);
  const inYear = weeks.find((w) => w.weekStart.getTime() === mon.getTime() || (mon >= w.weekStart && mon <= w.weekEnd));
  if (inYear) return inYear.weekStart;
  if (weeks.length > 0) {
    if (mon < weeks[0].weekStart) return weeks[0].weekStart;
    return weeks[weeks.length - 1].weekStart;
  }
  return mon;
}

export function formatDateYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
