"use client";

import { useState, useMemo, Fragment } from "react";
import { Toggle } from "@/components/Toggle";
import { getAttendanceMatrixData } from "./attendanceMatrixActions";
import type { AttendanceMatrixData, AttendanceMatrixMember } from "./attendanceMatrixActions";

const ROW_LABELS = {
  prayer: "祈",
  main: "主",
  group: "小",
  dispatch: "派",
} as const;

/** 各行の色（トグル・スクエア・ボーダーで共通） */
const ROW_COLORS: Record<RowKey, { toggle: string; square: string; border: string; label: string }> = {
  prayer: { toggle: "bg-primary-600", square: "bg-primary-500", border: "border-primary-500", label: "緑" },
  main: { toggle: "bg-blue-600", square: "bg-blue-500", border: "border-blue-500", label: "青" },
  group: { toggle: "bg-amber-600", square: "bg-amber-500", border: "border-amber-500", label: "黄" },
  dispatch: { toggle: "bg-violet-600", square: "bg-violet-500", border: "border-violet-500", label: "紫" },
};

type RowKey = keyof typeof ROW_LABELS;

type SortOption = "furigana" | "name";
type GroupOption = "district" | "none";

type Props = AttendanceMatrixData & { initialYear?: number };

const MIN_SIZE = 8;
const MAX_SIZE = 24;
const DEFAULT_SIZE = 14;

export function AttendanceMatrix({ weeks, members, districts, initialYear }: Props) {
  const [data, setData] = useState<AttendanceMatrixData>({ weeks, members, districts });
  const [selectedYear, setSelectedYear] = useState(initialYear ?? new Date().getFullYear());
  const [isLoadingYear, setIsLoadingYear] = useState(false);

  const effectiveData = data.members.length > 0 ? data : { weeks, members, districts };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setIsLoadingYear(true);
    try {
      const result = await getAttendanceMatrixData(year);
      setData(result);
    } finally {
      setIsLoadingYear(false);
    }
  };

  const [showPrayer, setShowPrayer] = useState(true);
  const [showMain, setShowMain] = useState(true);
  const [showGroup, setShowGroup] = useState(true);
  const [showDispatch, setShowDispatch] = useState(true);
  const [squareSize, setSquareSize] = useState(DEFAULT_SIZE);
  const [sortBy, setSortBy] = useState<SortOption>("furigana");
  const [groupBy, setGroupBy] = useState<GroupOption>("district");
  /** 閉じている地区の key（デフォルトは全開） */
  const [closedGroupKeys, setClosedGroupKeys] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setClosedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleRows = useMemo((): RowKey[] => {
    const arr: RowKey[] = [];
    if (showPrayer) arr.push("prayer");
    if (showMain) arr.push("main");
    if (showGroup) arr.push("group");
    if (showDispatch) arr.push("dispatch");
    return arr;
  }, [showPrayer, showMain, showGroup, showDispatch]);

  const sortedAndGroupedMembers = useMemo(() => {
    const list = effectiveData.members;
    const distList = effectiveData.districts;
    const sorted = [...list].sort((a, b) => {
      if (sortBy === "furigana") {
        return (a.furigana || a.name).localeCompare(b.furigana || b.name, "ja");
      }
      return a.name.localeCompare(b.name, "ja");
    });

    if (groupBy === "none") {
      return [{ key: "_all", label: null, members: sorted }];
    }

    const byDistrict = new Map<string | null, AttendanceMatrixMember[]>();
    sorted.forEach((m) => {
      const key = m.districtId ?? "__none__";
      if (!byDistrict.has(key)) byDistrict.set(key, []);
      byDistrict.get(key)!.push(m);
    });

    const districtOrder = distList.map((d) => d.id);
    const result: { key: string; label: string | null; members: AttendanceMatrixMember[] }[] = [];

    districtOrder.forEach((districtId) => {
      const districtMembers = byDistrict.get(districtId);
      if (districtMembers && districtMembers.length > 0) {
        result.push({
          key: districtId,
          label: distList.find((d) => d.id === districtId)?.name ?? null,
          members: districtMembers,
        });
      }
    });

    const noneList = byDistrict.get("__none__");
    if (noneList && noneList.length > 0) {
      result.push({ key: "__none__", label: "未設定", members: noneList });
    }

    return result;
  }, [effectiveData.members, effectiveData.districts, sortBy, groupBy]);

  const squareStyle = {
    width: squareSize,
    height: squareSize,
    minWidth: squareSize,
    minHeight: squareSize,
  };

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-3">出欠マトリクス</h2>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">表示行:</span>
          <Toggle checked={showPrayer} onChange={() => setShowPrayer((v) => !v)} label="祈り" checkedClassName={ROW_COLORS.prayer.toggle} />
          <Toggle checked={showMain} onChange={() => setShowMain((v) => !v)} label="主日" checkedClassName={ROW_COLORS.main.toggle} />
          <Toggle checked={showGroup} onChange={() => setShowGroup((v) => !v)} label="小組" checkedClassName={ROW_COLORS.group.toggle} />
          <Toggle checked={showDispatch} onChange={() => setShowDispatch((v) => !v)} label="派遣" checkedClassName={ROW_COLORS.dispatch.toggle} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">スクエア:</span>
          <button
            type="button"
            onClick={() => setSquareSize((s) => Math.max(MIN_SIZE, s - 2))}
            disabled={squareSize <= MIN_SIZE}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>
          <span className="text-sm text-slate-600 w-8 text-center tabular-nums">{squareSize}</span>
          <button
            type="button"
            onClick={() => setSquareSize((s) => Math.min(MAX_SIZE, s + 2))}
            disabled={squareSize >= MAX_SIZE}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ＋
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">並び順:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            <option value="furigana">フリガナ順</option>
            <option value="name">名前順</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">年:</span>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            disabled={isLoadingYear}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 disabled:opacity-60"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">グルーピング:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupOption)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            <option value="district">地区別</option>
            <option value="none">なし</option>
          </select>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-slate-500">表示する行を選択してください</p>
      ) : effectiveData.members.length === 0 ? (
        <p className="text-sm text-slate-500">表示期間内に出席データがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 p-0 text-left">
                  <div className="w-24 min-w-[6rem] p-2" />
                </th>
                <th className="sticky left-[6rem] z-20 bg-white border-b border-r border-slate-200 p-0">
                  <div className="w-6 min-w-6 p-1" />
                </th>
                {effectiveData.weeks.map((week) => (
                  <th
                    key={week.weekStart}
                    className="border-b border-slate-200 p-0 text-center text-xs font-medium text-slate-600 tabular-nums"
                    style={squareStyle}
                  >
                    {week.weekNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAndGroupedMembers.map((group) => (
                <Fragment key={group.key}>
                  {group.label != null ? (
                    <>
                      <tr>
                        <td
                          colSpan={2 + effectiveData.weeks.length}
                          className="border-b border-slate-100 p-0"
                        >
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            className="flex w-full items-center gap-2 py-1.5 pl-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <span
                              className="inline-block shrink-0 text-slate-400 transition-transform"
                              aria-hidden
                              style={{ transform: closedGroupKeys.has(group.key) ? "rotate(-90deg)" : "none" }}
                            >
                              ▼
                            </span>
                            <span className="border-l-2 border-primary-500 pl-2">{group.label}</span>
                            <span className="text-slate-400">({group.members.length}名)</span>
                          </button>
                        </td>
                      </tr>
                      {!closedGroupKeys.has(group.key) &&
                        group.members.flatMap((member) =>
                          visibleRows.map((row, rowIdx) => (
                            <tr key={`${member.memberId}-${row}`}>
                              {rowIdx === 0 && (
                                <td
                                  rowSpan={visibleRows.length}
                                  className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white align-top p-1"
                                >
                                  <span
                                    className="text-sm text-slate-800 block truncate max-w-[6rem]"
                                    title={member.name}
                                  >
                                    {member.name}
                                  </span>
                                </td>
                              )}
                              <td className="sticky left-[6rem] z-10 border-b border-r border-slate-100 bg-white p-0 align-middle">
                                <span
                                  className="inline-block text-xs font-medium text-slate-600"
                                  style={{ fontSize: squareSize * 0.7, width: 24 }}
                                >
                                  {ROW_LABELS[row]}
                                </span>
                              </td>
                              {effectiveData.weeks.map((week) => {
                                const attended = member[row][week.weekStart] === true;
                                const colorClass = attended ? ROW_COLORS[row].square : "bg-slate-200";
                                const borderClass = attended ? ROW_COLORS[row].border : "border-slate-200";
                                return (
                                  <td
                                    key={week.weekStart}
                                    className="border-b border-slate-100 p-0.5"
                                    title={`${week.weekNumber}週目: ${attended ? "出席" : "欠席"}`}
                                  >
                                    <div
                                      className={`rounded-sm border ${borderClass} ${colorClass}`}
                                      style={squareStyle}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                    </>
                  ) : (
                    group.members.flatMap((member) =>
                      visibleRows.map((row, rowIdx) => (
                        <tr key={`${member.memberId}-${row}`}>
                          {rowIdx === 0 && (
                            <td
                              rowSpan={visibleRows.length}
                              className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white align-top p-1"
                            >
                              <span
                                className="text-sm text-slate-800 block truncate max-w-[6rem]"
                                title={member.name}
                              >
                                {member.name}
                              </span>
                            </td>
                          )}
                          <td className="sticky left-[6rem] z-10 border-b border-r border-slate-100 bg-white p-0 align-middle">
                            <span
                              className="inline-block text-xs font-medium text-slate-600"
                              style={{ fontSize: squareSize * 0.7, width: 24 }}
                            >
                              {ROW_LABELS[row]}
                            </span>
                          </td>
                          {effectiveData.weeks.map((week) => {
                            const attended = member[row][week.weekStart] === true;
                            const colorClass = attended ? ROW_COLORS[row].square : "bg-slate-200";
                            const borderClass = attended ? ROW_COLORS[row].border : "border-slate-200";
                            return (
                              <td
                                key={week.weekStart}
                                className="border-b border-slate-100 p-0.5"
                                title={`${week.weekNumber}週目: ${attended ? "出席" : "欠席"}`}
                              >
                                <div
                                  className={`rounded-sm border ${borderClass} ${colorClass}`}
                                  style={squareStyle}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary-500" aria-hidden />
          祈り
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" aria-hidden />
          主日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" aria-hidden />
          小組
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-violet-500" aria-hidden />
          派遣
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200" aria-hidden />
          欠席
        </span>
      </div>
    </section>
  );
}
