"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { Toggle } from "@/components/Toggle";
import { getAttendanceMatrixData } from "./attendanceMatrixActions";
import type { AttendanceMatrixData, AttendanceMatrixMember } from "./attendanceMatrixActions";

const ROW_LABELS = {
  prayer: "祈",
  main: "主",
  group: "小",
  dispatch: "派",
} as const;

/** 各行の色（ボタン・スクエア・ボーダーで共通） */
const ROW_COLORS: Record<RowKey, { btn: string; square: string; border: string; label: string }> = {
  prayer: { btn: "bg-primary-600", square: "bg-primary-500", border: "border-primary-500", label: "緑" },
  main: { btn: "bg-blue-600", square: "bg-blue-500", border: "border-blue-500", label: "青" },
  group: { btn: "bg-amber-600", square: "bg-amber-500", border: "border-amber-500", label: "黄" },
  dispatch: { btn: "bg-violet-600", square: "bg-violet-500", border: "border-violet-500", label: "紫" },
};

type RowKey = keyof typeof ROW_LABELS;

type SortOption = "furigana";
type GroupOption = "district" | "none" | "list";

type Props = AttendanceMatrixData & { initialYear?: number; localityId?: string | null };

const MIN_SIZE = 8;
const MAX_SIZE = 24;
const DEFAULT_SIZE = 14;

export function AttendanceMatrix({ weeks, members, districts, initialYear, localityId }: Props) {
  const [data, setData] = useState<AttendanceMatrixData>({ weeks, members, districts });
  const [selectedYear, setSelectedYear] = useState(initialYear ?? new Date().getFullYear());
  const [isLoadingYear, setIsLoadingYear] = useState(false);

  const effectiveData = data.members.length > 0 ? data : { weeks, members, districts };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setIsLoadingYear(true);
    try {
      const result = await getAttendanceMatrixData(year, localityId ?? null);
      setData(result);
    } finally {
      setIsLoadingYear(false);
    }
  };

  const [showPrayer, setShowPrayer] = useState(true);
  const [showMain, setShowMain] = useState(true);
  const [showGroup, setShowGroup] = useState(true);
  const [showDispatch, setShowDispatch] = useState(true);
  const [includeGuests, setIncludeGuests] = useState(false);
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

  const filteredMembers = useMemo(() => {
    const list = effectiveData.members;
    return includeGuests ? list : list.filter((m) => m.isLocal);
  }, [effectiveData.members, includeGuests]);

  const sortedAndGroupedMembers = useMemo(() => {
    const list = filteredMembers;
    const distList = effectiveData.districts;
    const sorted = [...list].sort((a, b) =>
      (a.furigana || a.name).localeCompare(b.furigana || b.name, "ja")
    );

    if (groupBy === "list") {
      const order: { key: "regular" | "semi" | "pool"; label: string }[] = [
        { key: "regular", label: "レギュラー" },
        { key: "semi", label: "準レギュラー" },
        { key: "pool", label: "プール" },
      ];
      return order.map(({ key, label }) => ({
        key: `tier-${key}`,
        label,
        members: sorted.filter((m) => m.tier === key),
      }));
    }

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
  }, [filteredMembers, effectiveData.districts, groupBy]);

  const squareStyle = {
    width: squareSize,
    height: squareSize,
    minWidth: squareSize,
    minHeight: squareSize,
  };

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-3">出欠マトリクス</h2>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-4 mb-4">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-sm text-slate-600 shrink-0">表示行:</span>
          {(["prayer", "main", "group", "dispatch"] as const).map((key) => {
            const checked = key === "prayer" ? showPrayer : key === "main" ? showMain : key === "group" ? showGroup : showDispatch;
            const setChecked = key === "prayer" ? setShowPrayer : key === "main" ? setShowMain : key === "group" ? setShowGroup : setShowDispatch;
            const label = key === "prayer" ? "祈り" : key === "main" ? "主日" : key === "group" ? "小組" : "派遣";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setChecked((v) => !v)}
                className={`px-2 py-1 text-sm font-medium rounded border transition-colors ${
                  checked
                    ? `${ROW_COLORS[key].btn} text-white border-transparent`
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value={squareSize}
            onChange={(e) => setSquareSize(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            {Array.from({ length: (MAX_SIZE - MIN_SIZE) / 2 + 1 }, (_, i) => MIN_SIZE + i * 2).map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
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
        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupOption)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            <option value="district">地区別</option>
            <option value="list">リスト別</option>
            <option value="none">なし</option>
          </select>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            <option value="furigana">フリガナ順</option>
          </select>
        </div>
        <Toggle
          checked={includeGuests}
          onChange={() => setIncludeGuests((v) => !v)}
          label="ゲストを含む"
        />
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-slate-500">表示する行を選択してください</p>
      ) : filteredMembers.length === 0 ? (
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
                          visibleRows.map((row, rowIdx) => {
                            const rowBgClass =
                              member.tier === "semi"
                                ? "bg-amber-50 hover:bg-amber-100"
                                : member.tier === "pool"
                                  ? "bg-sky-50 hover:bg-sky-100"
                                  : "hover:bg-slate-50";
                            return (
                            <tr key={`${member.memberId}-${row}`} className={rowBgClass}>
                              {rowIdx === 0 && (
                                <td
                                  rowSpan={visibleRows.length}
                                  className={`sticky left-0 z-10 border-b border-r border-slate-100 align-top p-1 ${member.tier === "semi" ? "bg-amber-50" : member.tier === "pool" ? "bg-sky-50" : "bg-white"}`}
                                >
                                  <Link
                                    href={`/members/${member.memberId}`}
                                    className="text-sm text-slate-800 block truncate max-w-[6rem] text-primary-600 hover:underline"
                                    title={member.name}
                                  >
                                    {member.name}
                                  </Link>
                                </td>
                              )}
                              <td className={`sticky left-[6rem] z-10 border-b border-r border-slate-100 p-0 align-middle ${member.tier === "semi" ? "bg-amber-50" : member.tier === "pool" ? "bg-sky-50" : "bg-white"}`}>
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
                            );
                          })
                        )}
                    </>
                  ) : (
                    group.members.flatMap((member) =>
                      visibleRows.map((row, rowIdx) => {
                        const rowBgClass =
                          member.tier === "semi"
                            ? "bg-amber-50 hover:bg-amber-100"
                            : member.tier === "pool"
                              ? "bg-sky-50 hover:bg-sky-100"
                              : "hover:bg-slate-50";
                        return (
                        <tr key={`${member.memberId}-${row}`} className={rowBgClass}>
                          {rowIdx === 0 && (
                            <td
                              rowSpan={visibleRows.length}
                              className={`sticky left-0 z-10 border-b border-r border-slate-100 align-top p-1 ${member.tier === "semi" ? "bg-amber-50" : member.tier === "pool" ? "bg-sky-50" : "bg-white"}`}
                            >
                              <Link
                                href={`/members/${member.memberId}`}
                                className="text-sm text-slate-800 block truncate max-w-[6rem] text-primary-600 hover:underline"
                                title={member.name}
                              >
                                {member.name}
                              </Link>
                            </td>
                          )}
                          <td className={`sticky left-[6rem] z-10 border-b border-r border-slate-100 p-0 align-middle ${member.tier === "semi" ? "bg-amber-50" : member.tier === "pool" ? "bg-sky-50" : "bg-white"}`}>
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
                        );
                      })
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
