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
import { format, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

type AttendanceRow = {
  id: string;
  meeting_id: string;
  member_id: string;
  recorded_category: string | null;
  recorded_is_baptized: boolean | null;
  district_id: string | null;
  attended?: boolean;
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

/** 週別棒グラフ用：週のラベルと人数＋名前を表示（信仰別 or 年代別で出し分け） */
function WeeklyBarTooltip({
  active,
  payload,
  colorGroupBy,
}: {
  active?: boolean;
  payload?: { payload: Record<string, string | number | string[]> }[];
  colorGroupBy?: ColorGroupBy;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as Record<string, string | number | string[]>;
  const isCategory = colorGroupBy === "category";
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-[320px] text-left max-h-[70vh] overflow-y-auto">
      <p className="font-semibold text-slate-800 mb-2">
        {data.week}（週の開始日）
      </p>
      {isCategory ? (
        CATEGORY_KEYS.map((k) => {
          const label = CATEGORY_LABELS[k];
          const count = (data[label] as number) ?? 0;
          const names = (data[`${label}_names`] as string[] | undefined) ?? [];
          return (
            <div key={k} className="mb-2 last:mb-0">
              <p className="text-xs text-slate-600 mb-0.5">
                {label}: {count}名
              </p>
              <ul className="text-xs text-slate-700 list-disc list-inside pl-0.5">
                {names.length ? names.map((n) => <li key={n}>{n}</li>) : <li>—</li>}
              </ul>
            </div>
          );
        })
      ) : (
        <>
          <p className="text-xs text-slate-600 mb-1">
            {FAITH_KEYS.saint}: {data.saint}名
          </p>
          <ul className="text-xs text-slate-700 list-disc list-inside mb-2 pl-0.5">
            {((data.saintNames ?? []) as string[]).length
              ? ((data.saintNames ?? []) as string[]).map((n) => <li key={n}>{n}</li>)
              : <li>—</li>}
          </ul>
          <p className="text-xs text-slate-600 mb-1">
            {FAITH_KEYS.friend}: {data.friend}名
          </p>
          <ul className="text-xs text-slate-700 list-disc list-inside pl-0.5">
            {((data.friendNames ?? []) as string[]).length
              ? ((data.friendNames ?? []) as string[]).map((n) => <li key={n}>{n}</li>)
              : <li>—</li>}
          </ul>
        </>
      )}
    </div>
  );
}
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
}: StatisticsChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [localOnly, setLocalOnly] = useState(false);
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
  const memberIdToName = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.name ?? "—"));
    return map;
  }, [members]);

  type WeeklyRow = {
    week: string;
    date: string;
    count: number;
    saint: number;
    friend: number;
    saintNames: string[];
    friendNames: string[];
    [key: string]: string | number | string[];
  };

  const weeklyData = useMemo(() => {
    const last12Weeks = 12;
    const base: WeeklyRow[] = [];
    for (let i = last12Weeks - 1; i >= 0; i--) {
      const end = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 });
      const start = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 });
      const weekLabel = format(start, "M/d", { locale: ja });

      const countByFaith = { saint: 0, friend: 0 };
      const saintMemberIds = new Set<string>();
      const friendMemberIds = new Set<string>();
      const countByCategory: Record<string, number> = {};
      const categoryMemberIds: Record<string, Set<string>> = {};
      CATEGORY_KEYS.forEach((k) => {
        countByCategory[k] = 0;
        categoryMemberIds[k] = new Set();
      });
      let total = 0;

      const meetingIdsInWeek = new Set<string>();
      const startIso = format(start, "yyyy-MM-dd");
      const endIso = format(end, "yyyy-MM-dd");
      mainMeetings.forEach((m) => {
        const eventIso = m.event_date;
        if (eventIso >= startIso && eventIso <= endIso) meetingIdsInWeek.add(m.id);
      });
      let countAttendedOnly = 0;
      let saintAttendedOnly = 0;
      let friendAttendedOnly = 0;
      meetingIdsInWeek.forEach((mid) => {
        attendance
          .filter((a) => a.meeting_id === mid)
          .filter((a) => !localOnly || localMemberIds.has(a.member_id))
          .forEach((a) => {
            total += 1;
            const baptized = a.recorded_is_baptized ?? memberIsBaptized.get(a.member_id);
            const saint = isSaint(baptized);
            countByFaith[saint ? "saint" : "friend"] += 1;
            if (saint) saintMemberIds.add(a.member_id);
            else friendMemberIds.add(a.member_id);
            const cat = a.recorded_category && CATEGORY_KEYS.includes(a.recorded_category as Category) ? a.recorded_category : "adult";
            countByCategory[cat] = (countByCategory[cat] ?? 0) + 1;
            categoryMemberIds[cat].add(a.member_id);
            if (a.attended !== false) {
              countAttendedOnly += 1;
              if (saint) saintAttendedOnly += 1;
              else friendAttendedOnly += 1;
            }
          });
      });

      const saintNames = Array.from(saintMemberIds)
        .map((id) => memberIdToName.get(id) ?? "(不明)")
        .sort((a, b) => a.localeCompare(b, "ja"));
      const friendNames = Array.from(friendMemberIds)
        .map((id) => memberIdToName.get(id) ?? "(不明)")
        .sort((a, b) => a.localeCompare(b, "ja"));

      // #region agent log — 2/1 信仰別不整合
      const rowDate = format(start, "yyyy-MM-dd");
      if (rowDate === "2026-02-01" || rowDate === "2025-02-01") {
        fetch("http://127.0.0.1:7242/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "StatisticsCharts.tsx:weeklyData",
            message: "week faith breakdown (chart)",
            data: {
              weekLabel: format(start, "M/d", { locale: ja }),
              date: rowDate,
              meetingIdsInWeek: meetingIdsInWeek.size,
              total,
              saint: countByFaith.saint,
              friend: countByFaith.friend,
              totalAttendedOnly: countAttendedOnly,
              saintAttendedOnly,
              friendAttendedOnly,
              localOnly,
            },
            timestamp: Date.now(),
            hypothesisId: "A,B,E",
          }),
        }).catch(() => {});
      }
      // #endregion

      const row: WeeklyRow = {
        week: weekLabel,
        date: format(start, "yyyy-MM-dd"),
        count: total,
        saint: countByFaith.saint,
        friend: countByFaith.friend,
        saintNames,
        friendNames,
      };
      CATEGORY_KEYS.forEach((k) => (row[CATEGORY_LABELS[k as Category]] = countByCategory[k] ?? 0));
      CATEGORY_KEYS.forEach((k) => {
        const names = Array.from(categoryMemberIds[k])
          .map((id) => memberIdToName.get(id) ?? "(不明)")
          .sort((a, b) => a.localeCompare(b, "ja"));
        row[`${CATEGORY_LABELS[k as Category]}_names`] = names;
      });
      base.push(row);
    }
    return base;
  }, [attendance, mainMeetings, localMemberIds, localOnly, memberIsBaptized, memberIdToName]);

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
                <Tooltip content={(props) => <WeeklyBarTooltip {...props} colorGroupBy={colorGroupBy} />} />
                <Bar dataKey="count" fill="#0284c7" name="出席者数" />
              </BarChart>
            ) : colorGroupBy === "faith" ? (
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={(props) => <WeeklyBarTooltip {...props} colorGroupBy={colorGroupBy} />} />
                <Legend />
                <Bar dataKey="saint" stackId="a" fill={FAITH_COLORS.saint} name={FAITH_KEYS.saint} />
                <Bar dataKey="friend" stackId="a" fill={FAITH_COLORS.friend} name={FAITH_KEYS.friend} />
              </BarChart>
            ) : (
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={(props) => <WeeklyBarTooltip {...props} colorGroupBy={colorGroupBy} />} />
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
    </div>
  );
}
