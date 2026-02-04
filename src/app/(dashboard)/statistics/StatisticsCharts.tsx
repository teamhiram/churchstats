"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import { toPng } from "html-to-image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, subWeeks, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { getThisWeekByLastSunday } from "@/lib/weekUtils";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

type AttendanceRow = {
  id: string;
  meeting_id: string;
  member_id: string;
  recorded_category: string | null;
  recorded_is_baptized: boolean | null;
  district_id: string | null;
};

type MeetingRow = {
  id: string;
  event_date: string;
  meeting_type: string;
  district_id: string | null;
  name: string;
};

type MemberRow = {
  id: string;
  name: string;
  is_local: boolean;
  district_id: string | null;
  group_id: string | null;
  is_baptized?: boolean;
};

export type StatisticsChartsProps = {
  attendance: AttendanceRow[];
  meetings: MeetingRow[];
  members: MemberRow[];
  absenceAlertWeeks: number;
};

type ColorGroupBy = "none" | "faith" | "category";

/** recorded_is_baptized / is_baptized: Yes=聖徒, No=友人。APIが boolean / number / string で返す場合に対応 */
function isSaint(recorded: unknown): boolean {
  if (recorded === true || recorded === 1) return true;
  if (typeof recorded === "string" && (recorded.toLowerCase() === "true" || recorded === "1")) return true;
  return false;
}

const FAITH_KEYS = { saint: "聖徒", friend: "友人" } as const;
const FAITH_COLORS = { saint: "#0284c7", friend: "#0ea5e9" };
const CATEGORY_KEYS: Category[] = ["adult", "university", "high_school", "junior_high", "elementary", "preschool"];
const CATEGORY_COLORS: Record<string, string> = {
  adult: "#a5b4fc",
  university: "#fdba74",
  high_school: "#67e8f9",
  junior_high: "#fde047",
  elementary: "#86efac",
  preschool: "#f9a8d4",
};

export function StatisticsCharts({
  attendance,
  meetings,
  members,
  absenceAlertWeeks,
}: StatisticsChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [localOnly, setLocalOnly] = useState(true);
  const [colorGroupBy, setColorGroupBy] = useState<ColorGroupBy>("faith");

  const downloadPng = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { quality: 1, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `churchstats-${format(new Date(), "yyyy-MM-dd-HHmm")}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const mainMeetings = useMemo(() => meetings.filter((m) => m.meeting_type === "main"), [meetings]);
  const localMemberIds = useMemo(() => new Set(members.filter((m) => m.is_local).map((m) => m.id)), [members]);
  const memberIsBaptized = useMemo(() => {
    const map = new Map<string, boolean>();
    members.forEach((m) => map.set(m.id, isSaint(m.is_baptized)));
    return map;
  }, [members]);

  const weeklyData = useMemo(() => {
    const last12Weeks = 12;
    const base: { week: string; date: string; count: number; saint: number; friend: number; [key: string]: string | number }[] = [];
    for (let i = last12Weeks - 1; i >= 0; i--) {
      const end = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const start = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekLabel = format(end, "M/d", { locale: ja });

      const countByFaith = { saint: 0, friend: 0 };
      const countByCategory: Record<string, number> = {};
      CATEGORY_KEYS.forEach((k) => (countByCategory[k] = 0));
      let total = 0;

      const meetingIdsInWeek = new Set<string>();
      mainMeetings.forEach((m) => {
        const d = new Date(m.event_date);
        if (d >= start && d <= end) meetingIdsInWeek.add(m.id);
      });
      meetingIdsInWeek.forEach((mid) => {
        attendance
          .filter((a) => a.meeting_id === mid)
          .filter((a) => !localOnly || localMemberIds.has(a.member_id))
          .forEach((a) => {
            total += 1;
            const baptized = a.recorded_is_baptized ?? memberIsBaptized.get(a.member_id);
            const saint = isSaint(baptized);
            countByFaith[saint ? "saint" : "friend"] += 1;
            const cat = a.recorded_category && CATEGORY_KEYS.includes(a.recorded_category as Category) ? a.recorded_category : "adult";
            countByCategory[cat] = (countByCategory[cat] ?? 0) + 1;
          });
      });

      const row: { week: string; date: string; count: number; saint: number; friend: number; [key: string]: string | number } = {
        week: weekLabel,
        date: format(end, "yyyy-MM-dd"),
        count: total,
        saint: countByFaith.saint,
        friend: countByFaith.friend,
      };
      CATEGORY_KEYS.forEach((k) => (row[CATEGORY_LABELS[k as Category]] = countByCategory[k] ?? 0));
      base.push(row);
    }
    return base;
  }, [attendance, mainMeetings, localMemberIds, localOnly, memberIsBaptized]);

  // 今週 = 本日を含む一番近い過去の日曜日までの1週間（月曜〜日曜）
  const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = getThisWeekByLastSunday();
  const thisWeekMeetingIds = useMemo(
    () =>
      new Set(
        meetings
          .filter((m) => {
            const d = new Date(m.event_date);
            return d >= thisWeekStart && d <= thisWeekEnd;
          })
          .flatMap((m) => [m.id])
      ),
    [meetings, thisWeekStart, thisWeekEnd]
  );
  const attendedThisWeek = new Set(
    attendance.filter((a) => thisWeekMeetingIds.has(a.meeting_id)).map((a) => a.member_id)
  );
  const pastWeeksStart = addDays(thisWeekStart, -7 * absenceAlertWeeks);
  const attendedInPastWeeks = new Map<string, number>();
  attendance.forEach((a) => {
    const meeting = meetings.find((m) => m.id === a.meeting_id);
    if (!meeting) return;
    const d = new Date(meeting.event_date);
    if (d >= pastWeeksStart && d < thisWeekStart) {
      attendedInPastWeeks.set(a.member_id, (attendedInPastWeeks.get(a.member_id) ?? 0) + 1);
    }
  });
  const absentThisWeek = Array.from(localMemberIds).filter(
    (id) => attendedInPastWeeks.has(id) && !attendedThisWeek.has(id)
  );
  const absentNames = absentThisWeek
    .map((id) => members.find((m) => m.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div ref={chartRef} className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">週別主日出席（過去12週間）</h2>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">棒グラフの色分け</span>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(
                [
                  { value: "none" as const, label: "集計のみ" },
                  { value: "faith" as const, label: "信仰別" },
                  { value: "category" as const, label: "年代別" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColorGroupBy(value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md touch-target ${
                    colorGroupBy === value
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localOnly}
              onChange={(e) => setLocalOnly(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700">ローカルのみ</span>
          </label>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {colorGroupBy === "none" ? (
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0284c7" name="出席者数" />
              </BarChart>
            ) : colorGroupBy === "faith" ? (
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="saint" stackId="a" fill={FAITH_COLORS.saint} name={FAITH_KEYS.saint} />
                <Bar dataKey="friend" stackId="a" fill={FAITH_COLORS.friend} name={FAITH_KEYS.friend} />
              </BarChart>
            ) : (
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {CATEGORY_KEYS.map((k) => (
                  <Bar
                    key={k}
                    dataKey={CATEGORY_LABELS[k]}
                    stackId="a"
                    fill={CATEGORY_COLORS[k]}
                    name={CATEGORY_LABELS[k]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={downloadPng}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg touch-target"
        >
          グラフをPNGでダウンロード
        </button>
      </div>
      {absentNames.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="font-semibold text-amber-800 mb-1">
            欠席アラート（過去{absenceAlertWeeks}週出席していたローカルメンバー・今週欠席）
          </h2>
          <p className="text-xs text-amber-700 mb-2">
            今週＝本日を含む一番近い過去の日曜日までの1週間
          </p>
          <ul className="list-disc list-inside text-sm text-amber-800">
            {absentNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
