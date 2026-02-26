"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getMemberAttendanceMatrixData, getMemberLifeOverview } from "@/app/(dashboard)/dashboard/attendanceMatrixActions";
import type { MemberAttendanceMatrixData } from "@/app/(dashboard)/dashboard/attendanceMatrixActions";
import { addDays, format, parseISO } from "date-fns";

const COL_LABELS = {
  prayer: "祈り",
  main: "主日",
  group: "小組",
  dispatch: "派遣",
} as const;

type ColKey = keyof typeof COL_LABELS;

const COL_COLORS: Record<ColKey, { square: string; border: string }> = {
  prayer: { square: "bg-primary-500", border: "border-primary-500" },
  main: { square: "bg-blue-500", border: "border-blue-500" },
  group: { square: "bg-amber-500", border: "border-amber-500" },
  dispatch: { square: "bg-violet-500", border: "border-violet-500" },
};

const SQUARE_SIZE = 20;
/** スクエア列の最小幅（週列を狭くしつつスクエアに余裕を持たせる） */
const SQUARE_COL_MIN = 32;
const TOOLTIP_MAX_WIDTH_PX = 256;
const TOOLTIP_MARGIN_PX = 8;

/** weekStart "yyyy-MM-dd" から "MM/dd - MM/dd" の日付範囲（年省略・日月二桁）を返す */
function formatWeekDateRange(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  return `${format(start, "MM/dd")} - ${format(end, "MM/dd")}`;
}

type Props = {
  memberId: string;
  initialYear?: number;
};

export function MemberAttendanceMatrix({ memberId, initialYear }: Props) {
  const [year, setYear] = useState(initialYear ?? new Date().getFullYear());
  const [data, setData] = useState<MemberAttendanceMatrixData | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getMemberLifeOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltipState, setTooltipState] = useState<{
    memo: string;
    anchorLeft: number;
    anchorTop: number;
    anchorWidth: number;
  } | null>(null);

  const handleCellPointerEnter = useCallback(
    (e: React.PointerEvent, memo: string) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltipState({
        memo,
        anchorLeft: rect.left,
        anchorTop: rect.top,
        anchorWidth: rect.width,
      });
    },
    []
  );
  const handleCellPointerLeave = useCallback(() => {
    setTooltipState(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMemberAttendanceMatrixData(memberId, year),
      getMemberLifeOverview(memberId, year),
    ]).then(([matrixResult, overviewResult]) => {
      setData(matrixResult);
      setOverview(overviewResult);
      setLoading(false);
    });
  }, [memberId, year]);

  if (loading || !data) {
    return (
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800 mb-3">個人出欠マトリクス</h2>
        <p className="text-sm text-slate-500">読み込み中…</p>
      </section>
    );
  }

  const columns: ColKey[] = ["prayer", "main", "group", "dispatch"];
  const squareStyle = {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    minWidth: SQUARE_SIZE,
    minHeight: SQUARE_SIZE,
  };

  const overviewSection = overview && (
    <div className="mb-6 pb-4 border-b border-slate-100">
      <p className="text-xs text-slate-500 mb-3">集計期間: {overview.periodLabel}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">祈り出席率</dt>
          <dd className="font-medium text-slate-800">
            {overview.weeksInScopeCount === 0
              ? "—"
              : `${overview.prayerAttended}/${overview.weeksInScopeCount} (${Math.round((overview.prayerAttended / overview.weeksInScopeCount) * 100)}%)`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">主日出席率</dt>
          <dd className="font-medium text-slate-800">
            {overview.weeksInScopeCount === 0
              ? "—"
              : `${overview.mainAttended}/${overview.weeksInScopeCount} (${Math.round((overview.mainAttended / overview.weeksInScopeCount) * 100)}%)`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">小組出席率</dt>
          <dd className="font-medium text-slate-800">
            {overview.weeksInScopeCount === 0
              ? "—"
              : `${overview.groupAttended}/${overview.weeksInScopeCount} (${Math.round((overview.groupAttended / overview.weeksInScopeCount) * 100)}%)`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">派遣回数</dt>
          <dd className="font-medium text-slate-800">{overview.dispatchCount}回</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-3">個人出欠マトリクス</h2>

      {overviewSection}

      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2 sm:gap-4 mb-4">
        <select
          id="member-matrix-year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
        >
          {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      {data.weeks.length === 0 ? (
        <p className="text-sm text-slate-500">表示する週がありません</p>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] border border-slate-200 rounded-lg">
          <table className="border-collapse w-full">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="border-b border-r border-slate-200 px-1.5 py-1.5 text-left text-xs font-medium text-slate-600 w-16">
                  週
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-slate-200 px-1 py-1.5 text-center text-xs font-medium text-slate-600"
                    style={{ ...squareStyle, minWidth: SQUARE_COL_MIN }}
                  >
                    {COL_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((week) => (
                <tr key={week.weekStart} className="hover:bg-slate-50/50">
                  <td className="border-b border-r border-slate-100 px-1.5 py-0.5 text-left text-xs font-medium text-slate-600 tabular-nums w-16">
                    <span className="inline-flex flex-wrap items-center justify-start gap-x-1 gap-y-0">
                      <span>W{week.weekNumber}</span>
                      <span className="text-slate-500 font-normal">({formatWeekDateRange(week.weekStart)})</span>
                    </span>
                  </td>
                  {columns.map((col) => {
                    const attended = data[col][week.weekStart] === true;
                    const memo =
                      col === "prayer"
                        ? (data.prayerMemos ?? {})[week.weekStart]
                        : col === "main"
                          ? (data.mainMemos ?? {})[week.weekStart]
                          : col === "group"
                            ? (data.groupMemos ?? {})[week.weekStart]
                            : col === "dispatch"
                              ? (data.dispatchMemos ?? {})[week.weekStart]
                              : undefined;
                    const colorClass = attended ? COL_COLORS[col].square : "bg-slate-200";
                    const borderClass = attended ? COL_COLORS[col].border : "border-slate-200";
                    const titleText = memo
                      ? `${week.weekNumber}週目 ${COL_LABELS[col]}: ${attended ? "出席" : "欠席"}\n${memo}`
                      : `${week.weekNumber}週目 ${COL_LABELS[col]}: ${attended ? "出席" : "欠席"}`;
                    return (
                      <td
                        key={col}
                        className="border-b border-slate-100 p-0.5 text-center align-middle relative group/cell"
                        style={{ minWidth: SQUARE_COL_MIN }}
                        title={memo ? undefined : titleText}
                        onPointerEnter={memo ? (e) => handleCellPointerEnter(e, memo) : undefined}
                        onPointerLeave={memo ? handleCellPointerLeave : undefined}
                      >
                        <div className="inline-flex flex-col items-center justify-center min-h-[20px]">
                          <div
                            className={`rounded-sm border ${borderClass} ${colorClass} mx-auto relative ${memo ? "ring-1 ring-offset-1 ring-slate-600 ring-offset-white" : ""}`}
                            style={squareStyle}
                          >
                            {memo && (
                              <span
                                className="absolute right-0.5 bottom-0.5 w-1 h-1 rounded-full bg-slate-700"
                                aria-hidden
                              />
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
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
        <span className="inline-flex items-center gap-1 text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm border-2 border-slate-600 ring-1 ring-offset-1 ring-slate-600 ring-offset-white" aria-hidden />
          メモあり（ホバーで表示）
        </span>
      </div>

      {typeof document !== "undefined" &&
        tooltipState &&
        createPortal(
          (() => {
            if (typeof window === "undefined") return null;
            const half = TOOLTIP_MAX_WIDTH_PX / 2 + TOOLTIP_MARGIN_PX;
            const centerX = tooltipState.anchorLeft + tooltipState.anchorWidth / 2;
            const viewWidth = window.innerWidth;
            const clampedLeft = Math.max(half, Math.min(viewWidth - half, centerX));
            const maxW = Math.min(TOOLTIP_MAX_WIDTH_PX, viewWidth - TOOLTIP_MARGIN_PX * 2);
            return (
              <div
                role="tooltip"
                className="pointer-events-none fixed z-[9999] px-2 py-1.5 text-left text-xs font-normal text-white bg-slate-800 rounded shadow-lg whitespace-pre-wrap break-words"
                style={{
                  left: clampedLeft,
                  top: tooltipState.anchorTop - TOOLTIP_MARGIN_PX,
                  transform: "translate(-50%, -100%)",
                  maxWidth: maxW,
                }}
              >
                {tooltipState.memo}
              </div>
            );
          })(),
          document.body
        )}
    </section>
  );
}
