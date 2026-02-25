"use client";

import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { format, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { CATEGORY_LABELS } from "@/types/database";
import { Toggle } from "@/components/Toggle";
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

type DistrictRow = { id: string; name: string };

export type StatisticsChartsProps = {
  attendance: AttendanceRow[];
  meetings: MeetingRow[];
  members: MemberRow[];
  districts?: DistrictRow[];
  localityName?: string | null;
};

type ColorGroupBy = "none" | "faith" | "category" | "district";

/** recorded_is_baptized / is_baptized: Yes=聖徒, No=友人。APIが boolean / number / string で返す場合に対応 */
function isSaint(recorded: unknown): boolean {
  if (recorded === true || recorded === 1) return true;
  if (typeof recorded === "string" && (recorded.toLowerCase() === "true" || recorded === "1")) return true;
  return false;
}

const FAITH_KEYS = { saint: "聖徒", friend: "友人" } as const;
const FAITH_COLORS = { saint: "#0284c7", friend: "#0ea5e9" };

/** 週別棒グラフ用：週のラベルと人数＋名前を表示（信仰別 or 年代別 or 地区別で出し分け） */
function WeeklyBarTooltip({
  active,
  payload,
  colorGroupBy,
  districtKeys,
  districtNameMap,
}: {
  active?: boolean;
  payload?: { payload?: Record<string, string | number | string[]> }[];
  colorGroupBy?: ColorGroupBy;
  districtKeys?: string[];
  districtNameMap?: Map<string, string>;
}) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const data = payload[0].payload as Record<string, string | number | string[]>;
  const isCategory = colorGroupBy === "category";
  const isDistrict = colorGroupBy === "district";
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
      ) : isDistrict && districtKeys && districtNameMap ? (
        districtKeys.map((districtId) => {
          const label = districtId === "__none__" ? "未設定" : (districtNameMap.get(districtId) ?? districtId);
          const count = (data[`district_${districtId}`] as number) ?? 0;
          const names = (data[`district_${districtId}_names`] as string[] | undefined) ?? [];
          return (
            <div key={districtId} className="mb-2 last:mb-0">
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
/** 地区別の色パレット（地区数が多い場合はインデックスで循環） */
const DISTRICT_PALETTE = ["#0284c7", "#0ea5e9", "#a5b4fc", "#fdba74", "#67e8f9", "#fde047", "#86efac", "#f9a8d4", "#c084fc", "#f472b6", "#94a3b8", "#22d3ee"];

export function StatisticsCharts({
  attendance,
  meetings,
  members,
  districts = [],
  localityName,
}: StatisticsChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [includeGuests, setIncludeGuests] = useState(false);
  const localOnly = !includeGuests;
  const [colorGroupBy, setColorGroupBy] = useState<ColorGroupBy>("faith");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [sideBySide, setSideBySide] = useState(false);
  useEffect(() => { setHiddenSeries(new Set()); }, [colorGroupBy]);

  const meetingIdToDistrictId = useMemo(() => {
    const map = new Map<string, string>();
    meetings.filter((m) => m.meeting_type === "main").forEach((m) => {
      if (m.district_id) map.set(m.id, m.district_id);
    });
    return map;
  }, [meetings]);
  const districtNameMap = useMemo(() => new Map(districts.map((d) => [d.id, d.name])), [districts]);
  const districtKeys = useMemo(() => {
    const ids = new Set<string>();
    meetingIdToDistrictId.forEach((did) => ids.add(did));
    const fromDistricts = districts
      .filter((d) => ids.has(d.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .map((d) => d.id);
    if (ids.has("__none__")) return [...fromDistricts, "__none__"];
    return fromDistricts;
  }, [districts, meetingIdToDistrictId]);
  const districtColors = useMemo(() => {
    const map = new Map<string, string>();
    districtKeys.forEach((id, idx) => map.set(id, DISTRICT_PALETTE[idx % DISTRICT_PALETTE.length]));
    return map;
  }, [districtKeys]);

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
  const meetingIdToDate = useMemo(() => {
    const map = new Map<string, string>();
    meetings.forEach((m) => map.set(m.id, m.event_date));
    return map;
  }, [meetings]);

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
      const countByDistrict: Record<string, number> = {};
      const districtMemberIds: Record<string, Set<string>> = {};
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
      meetingIdsInWeek.forEach((mid) => {
        const districtId = meetingIdToDistrictId.get(mid) ?? "__none__";
        if (!countByDistrict[districtId]) {
          countByDistrict[districtId] = 0;
          districtMemberIds[districtId] = new Set();
        }
        attendance
          .filter((a) => a.meeting_id === mid && a.attended !== false)
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
            countByDistrict[districtId] += 1;
            districtMemberIds[districtId].add(a.member_id);
          });
      });

      const saintNames = Array.from(saintMemberIds)
        .map((id) => memberIdToName.get(id) ?? "(不明)")
        .sort((a, b) => a.localeCompare(b, "ja"));
      const friendNames = Array.from(friendMemberIds)
        .map((id) => memberIdToName.get(id) ?? "(不明)")
        .sort((a, b) => a.localeCompare(b, "ja"));

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
      Object.keys(countByDistrict).forEach((districtId) => {
        row[`district_${districtId}`] = countByDistrict[districtId];
        row[`district_${districtId}_names`] = Array.from(districtMemberIds[districtId] ?? [])
          .map((id) => memberIdToName.get(id) ?? "(不明)")
          .sort((a, b) => a.localeCompare(b, "ja"));
      });
      base.push(row);
    }
    return base;
  }, [attendance, mainMeetings, localMemberIds, localOnly, memberIsBaptized, memberIdToName, meetingIdToDistrictId, meetingIdToDate]);

  const legendItems = useMemo(() => {
    if (colorGroupBy === "none") {
      return [
        {
          key: "count",
          label: localityName && localityName !== "" ? localityName : "全体",
          color: "#0284c7",
          dataKey: "count" as const,
        },
      ];
    }
    if (colorGroupBy === "faith") {
      return [
        { key: "saint", label: FAITH_KEYS.saint, color: FAITH_COLORS.saint, dataKey: "saint" as const },
        { key: "friend", label: FAITH_KEYS.friend, color: FAITH_COLORS.friend, dataKey: "friend" as const },
      ];
    }
    if (colorGroupBy === "category") {
      return CATEGORY_KEYS.map((k) => ({
        key: k,
        label: CATEGORY_LABELS[k],
        color: CATEGORY_COLORS[k],
        dataKey: CATEGORY_LABELS[k as Category] as string,
      }));
    }
    if (colorGroupBy === "district" && districtKeys.length > 0) {
      return districtKeys.map((k) => ({
        key: k,
        label: k === "__none__" ? "未設定" : (districtNameMap.get(k) ?? k),
        color: districtColors.get(k) ?? "#94a3b8",
        dataKey: `district_${k}` as string,
      }));
    }
    return [];
  }, [colorGroupBy, districtKeys, districtNameMap, districtColors, localityName]);

  const legendAverages = useMemo(() => {
    const map = new Map<string, number>();
    if (weeklyData.length === 0) return map;
    legendItems.forEach((item) => {
      const sum = weeklyData.reduce((acc, row) => {
        const v = row[item.dataKey];
        return acc + (typeof v === "number" ? v : 0);
      }, 0);
      map.set(item.key, Math.round((sum / weeklyData.length) * 10) / 10);
    });
    return map;
  }, [weeklyData, legendItems]);

  const toggleSeries = useCallback((key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const chartData = useMemo(() => {
    return weeklyData.map((row) => {
      let visibleCount = 0;
      if (colorGroupBy === "faith") {
        if (!hiddenSeries.has("saint")) visibleCount += (row.saint as number) ?? 0;
        if (!hiddenSeries.has("friend")) visibleCount += (row.friend as number) ?? 0;
      } else if (colorGroupBy === "category") {
        CATEGORY_KEYS.forEach((k) => {
          if (!hiddenSeries.has(k)) visibleCount += (row[CATEGORY_LABELS[k]] as number) ?? 0;
        });
      } else if (colorGroupBy === "district") {
        districtKeys.forEach((k) => {
          if (!hiddenSeries.has(k)) visibleCount += (row[`district_${k}`] as number) ?? 0;
        });
      } else {
        visibleCount = row.count;
      }
      return { ...row, visibleCount };
    });
  }, [weeklyData, hiddenSeries, colorGroupBy, districtKeys]);

  return (
    <div className="space-y-6">
      <div ref={chartRef} className="bg-white rounded-lg border border-slate-200 pt-4 pr-4 pb-4 pl-2 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-semibold text-slate-800">週別主日出席（過去12週間）</h2>
          {localityName && (
            <span className="text-sm font-medium text-slate-500 shrink-0">{localityName}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden">
              {(
                [
                  { value: "none" as const, label: "集計のみ" },
                  { value: "faith" as const, label: "信仰別" },
                  { value: "category" as const, label: "年代別" },
                  { value: "district" as const, label: "地区別" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColorGroupBy(value)}
                  className={`px-3 py-px text-sm font-medium touch-target -mr-px transition-colors duration-100 first:rounded-l last:rounded-r ${
                    colorGroupBy === value
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={includeGuests}
            onChange={() => setIncludeGuests((v) => !v)}
            label="ゲストを含む"
          />
          {colorGroupBy !== "none" && (
            <Toggle
              checked={sideBySide}
              onChange={() => setSideBySide((v) => !v)}
              label="横並び"
            />
          )}
        </div>

        {legendItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {legendItems.map((item) => {
              const hidden = colorGroupBy !== "none" && hiddenSeries.has(item.key);
              const avg = legendAverages.get(item.key);
              const avgText = avg !== undefined ? `(${avg})` : "";
              const isAggregateOnly = colorGroupBy === "none";
              return isAggregateOnly ? (
                <div
                  key={item.key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm"
                >
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                  {avgText ? <span className="text-slate-500 font-normal">{avgText}</span> : null}
                </div>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleSeries(item.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-150 ${
                    hidden
                      ? "bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-white text-slate-700 border-slate-300 shadow-sm"
                  }`}
                >
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: hidden ? "#cbd5e1" : item.color }}
                  />
                  {item.label}
                  {avg !== undefined ? <span className="text-slate-500 font-normal">({avg})</span> : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {colorGroupBy === "none" ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
                <Tooltip
                  content={(props) => (
                    <WeeklyBarTooltip
                      {...(props as { active?: boolean; payload?: { payload?: Record<string, string | number | string[]> }[] })}
                      colorGroupBy={colorGroupBy}
                      districtKeys={districtKeys}
                      districtNameMap={districtNameMap}
                    />
                  )}
                />
                <Bar dataKey="count" fill="#0284c7" name="出席者数">
                  <LabelList dataKey="visibleCount" position="top" fill="#475569" fontSize={12} />
                </Bar>
              </BarChart>
            ) : colorGroupBy === "faith" ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
                <Tooltip
                  content={(props) => (
                    <WeeklyBarTooltip
                      {...(props as { active?: boolean; payload?: { payload?: Record<string, string | number | string[]> }[] })}
                      colorGroupBy={colorGroupBy}
                      districtKeys={districtKeys}
                      districtNameMap={districtNameMap}
                    />
                  )}
                />
                {(["saint", "friend"] as const)
                  .filter((k) => !hiddenSeries.has(k))
                  .map((k, idx, arr) => (
                    <Bar key={k} dataKey={k} stackId={sideBySide ? undefined : "a"} fill={FAITH_COLORS[k]} name={FAITH_KEYS[k]}>
                      {(!sideBySide && idx === arr.length - 1) || sideBySide ? (
                        <LabelList dataKey={sideBySide ? k : "visibleCount"} position="top" fill="#475569" fontSize={12} />
                      ) : null}
                    </Bar>
                  ))}
              </BarChart>
            ) : colorGroupBy === "district" && districtKeys.length > 0 ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
                <Tooltip
                  content={(props) => (
                    <WeeklyBarTooltip
                      {...(props as { active?: boolean; payload?: { payload?: Record<string, string | number | string[]> }[] })}
                      colorGroupBy={colorGroupBy}
                      districtKeys={districtKeys}
                      districtNameMap={districtNameMap}
                    />
                  )}
                />
                {districtKeys
                  .filter((k) => !hiddenSeries.has(k))
                  .map((districtId, idx, arr) => (
                    <Bar
                      key={districtId}
                      dataKey={`district_${districtId}`}
                      stackId={sideBySide ? undefined : "a"}
                      fill={districtColors.get(districtId) ?? "#94a3b8"}
                      name={districtId === "__none__" ? "未設定" : (districtNameMap.get(districtId) ?? districtId)}
                    >
                      {(!sideBySide && idx === arr.length - 1) || sideBySide ? (
                        <LabelList dataKey={sideBySide ? `district_${districtId}` : "visibleCount"} position="top" fill="#475569" fontSize={12} />
                      ) : null}
                    </Bar>
                  ))}
              </BarChart>
            ) : colorGroupBy === "district" && districtKeys.length === 0 ? (
              // 地区別選択時、地区データがない場合は集計のみを表示
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
                <Tooltip
                  content={(props) => (
                    <WeeklyBarTooltip
                      {...(props as { active?: boolean; payload?: { payload?: Record<string, string | number | string[]> }[] })}
                      colorGroupBy="none"
                      districtKeys={districtKeys}
                      districtNameMap={districtNameMap}
                    />
                  )}
                />
                <Bar dataKey="count" fill="#0284c7" name="出席者数">
                  <LabelList dataKey="visibleCount" position="top" fill="#475569" fontSize={12} />
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
                <Tooltip
                  content={(props) => (
                    <WeeklyBarTooltip
                      {...(props as { active?: boolean; payload?: { payload?: Record<string, string | number | string[]> }[] })}
                      colorGroupBy={colorGroupBy}
                      districtKeys={districtKeys}
                      districtNameMap={districtNameMap}
                    />
                  )}
                />
                {CATEGORY_KEYS
                  .filter((k) => !hiddenSeries.has(k))
                  .map((k, idx, arr) => (
                    <Bar
                      key={k}
                      dataKey={CATEGORY_LABELS[k]}
                      stackId={sideBySide ? undefined : "a"}
                      fill={CATEGORY_COLORS[k]}
                      name={CATEGORY_LABELS[k]}
                    >
                      {(!sideBySide && idx === arr.length - 1) || sideBySide ? (
                        <LabelList dataKey={sideBySide ? CATEGORY_LABELS[k] : "visibleCount"} position="top" fill="#475569" fontSize={12} />
                      ) : null}
                    </Bar>
                  ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={downloadPng}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg touch-target"
        >
          <DownloadIcon className="h-4 w-4 shrink-0" />
          グラフをPNGでダウンロード
        </button>
      </div>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
