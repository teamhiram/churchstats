import { addDays, getDay, nextSunday, format } from "date-fns";
import { ja } from "date-fns/locale";

/**
 * アメリカ式週: 1/1を含む週を第1週、週は日曜始まり（日曜〜土曜）。
 * 年の「週」はその週に含まれる日がその年に1日でもあるものを列挙する。
 */

/** 年の全日曜日（1/1〜12/31）を返す。表示用: 1週目（yyyy/MM/dd）。アメリカ式: 週1＝1/1を含む週の日曜。 */
export function getSundaysInYear(year: number): { weekNumber: number; date: Date; label: string }[] {
  const weeks = getSundayWeeksInYear(year);
  return weeks.map((w) => ({
    weekNumber: w.weekNumber,
    date: w.weekStart,
    label: `${w.weekNumber}週目（${format(w.weekStart, "yyyy/MM/dd")}）`,
  }));
}

/** 今日までで一番近い過去の日曜日 */
export function getDefaultSunday(year: number): Date {
  const today = new Date();
  if (today.getFullYear() !== year) {
    const weeks = getSundayWeeksInYear(year);
    return weeks.length > 0 ? weeks[weeks.length - 1].weekStart : new Date(year, 11, 31);
  }
  const sun = nextSunday(today);
  const prevSun = addDays(sun, -7);
  return prevSun <= today ? prevSun : addDays(prevSun, -7);
}

/**
 * 年の日曜始まり週（日曜日を week_start とする、アメリカ式）。
 * 第1週＝1/1を含む週（日曜〜土曜）。週番号は1/1を含む週を1とする。
 */
export function getSundayWeeksInYear(
  year: number
): { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] {
  const result: { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] = [];
  const jan1 = new Date(year, 0, 1);
  // 1/1を含む週の日曜日（1/1の曜日だけ戻す）
  const firstWeekStart = addDays(jan1, -getDay(jan1));
  const yearEnd = new Date(year, 11, 31);
  let d = new Date(firstWeekStart);
  let n = 1;
  while (d <= yearEnd) {
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

/** @deprecated アメリカ式のため getSundayWeeksInYear を使用 */
export function getMondayWeeksInYear(
  year: number
): { weekNumber: number; weekStart: Date; weekEnd: Date; label: string }[] {
  return getSundayWeeksInYear(year);
}

/**
 * 今週：日曜始まり（アメリカ式）。本日を含む週の日曜〜土曜。
 * 欠席アラート等で「今週」の定義に使用する。
 */
export function getThisWeekByLastSunday(): { weekStart: Date; weekEnd: Date } {
  const today = new Date();
  const weekStart = addDays(today, -getDay(today)); // この週の日曜
  const weekEnd = addDays(weekStart, 6); // 土曜
  return { weekStart, weekEnd };
}

/** 今週の日曜（週の起点）。アメリカ式。 */
export function getDefaultSundayWeekStart(year: number): Date {
  const today = new Date();
  const thisSunday = addDays(today, -getDay(today));
  const weeks = getSundayWeeksInYear(year);
  const inYear = weeks.find(
    (w) =>
      w.weekStart.getTime() === thisSunday.getTime() ||
      (thisSunday >= w.weekStart && thisSunday <= w.weekEnd)
  );
  if (inYear) return inYear.weekStart;
  if (weeks.length > 0) {
    if (thisSunday < weeks[0].weekStart) return weeks[0].weekStart;
    return weeks[weeks.length - 1].weekStart;
  }
  return thisSunday;
}

/** @deprecated アメリカ式のため getDefaultSundayWeekStart を使用 */
export function getDefaultMondayWeekStart(year: number): Date {
  return getDefaultSundayWeekStart(year);
}

export function formatDateYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** 日付文字列（yyyy-MM-dd）から、その日が含まれる週の日曜日を yyyy-MM-dd で返す。派遣記録の week_start 算出に使用。 */
export function getWeekStartForDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sunday = addDays(date, -getDay(date));
  return format(sunday, "yyyy-MM-dd");
}

/** 週の日曜（yyyy-MM-dd, week_start）から、その週の日曜日を yyyy/MM/dd で返す。主日表示用。 */
export function getSundayFromWeekStart(weekStartIso: string): string {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const sunday = new Date(y, m - 1, d);
  return format(sunday, "yyyy/MM/dd");
}

/** 週の日曜（yyyy-MM-dd）から、その週の日曜日を yyyy-MM-dd で返す。API用。（そのまま返す） */
export function getSundayIsoFromWeekStart(weekStartIso: string): string {
  return weekStartIso;
}

/** 週の日曜（yyyy-MM-dd）から、その週の7日間（日〜土）の選択肢を返す。実施日ドロップダウン用。 */
export function getDaysInWeek(weekStartIso: string): { value: string; label: string }[] {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const sunday = new Date(y, m - 1, d);
  const weekDays: { value: string; label: string }[] = [];
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  for (let i = 0; i < 7; i++) {
    const date = addDays(sunday, i);
    weekDays.push({
      value: format(date, "yyyy-MM-dd"),
      label: `${format(date, "M/d", { locale: ja })} (${dayLabels[date.getDay()]})`,
    });
  }
  return weekDays;
}
