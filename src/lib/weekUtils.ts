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

/**
 * 年の月曜始まり週（月曜日を week_start とする）。
 * 第1週＝その年の最初の日曜日を含む週（例: 2026年1週目 2025/12/29 - 2026/01/04）。
 * その週の日曜が翌年になる週は含めない（例: 2025/12/29-2026/01/04 は2025年の週には含めず、2026年1週目となる）。
 * 表示: n週目（yyyy/MM/dd - yyyy/MM/dd）
 */
export function getMondayWeeksInYear(year: number): { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] {
  const result: { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] = [];
  const startOfYear = new Date(year, 0, 1);
  let firstSunday = new Date(startOfYear);
  while (getDay(firstSunday) !== 0) {
    firstSunday = addDays(firstSunday, 1);
  }
  let d = addDays(firstSunday, -6);
  let n = 1;
  while (true) {
    const end = addDays(d, 6);
    if (end.getFullYear() > year) break;
    if (end.getFullYear() < year) {
      d = addDays(d, 7);
      continue;
    }
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

/** 週の月曜日（yyyy-MM-dd）から、その週の日曜日を yyyy/MM/dd で返す。主日表示用。 */
export function getSundayFromWeekStart(weekStartIso: string): string {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = addDays(monday, 6);
  return format(sunday, "yyyy/MM/dd");
}

/** 週の月曜日（yyyy-MM-dd）から、その週の日曜日を yyyy-MM-dd で返す。API用。 */
export function getSundayIsoFromWeekStart(weekStartIso: string): string {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = addDays(monday, 6);
  return format(sunday, "yyyy-MM-dd");
}

/** 週の月曜日（yyyy-MM-dd）から、その週の7日間の選択肢を返す。実施日ドロップダウン用。 */
export function getDaysInWeek(weekStartIso: string): { value: string; label: string }[] {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const weekDays: { value: string; label: string }[] = [];
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    weekDays.push({
      value: format(date, "yyyy-MM-dd"),
      label: `${format(date, "M/d", { locale: ja })} (${dayLabels[date.getDay()]})`,
    });
  }
  return weekDays;
}
