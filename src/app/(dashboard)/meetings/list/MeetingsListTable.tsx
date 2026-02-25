"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { getWeekDetail } from "./actions";
import type { WeekRow, WeekDetail } from "./types";

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}

type Props = {
  weeks: WeekRow[];
  year: number;
  localityId: string | null;
  localOnly: boolean;
  absenceAlertWeeks: number;
};

export function MeetingsListTable({
  weeks,
  year,
  localityId,
  localOnly,
  absenceAlertWeeks,
}: Props) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [detail, setDetail] = useState<WeekDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggleExpand = async (weekStart: string) => {
    if (expandedWeek === weekStart) {
      setExpandedWeek(null);
      setDetail(null);
      return;
    }
    setExpandedWeek(weekStart);
    setLoadingDetail(true);
    setDetail(null);
    try {
      const d = await getWeekDetail(weekStart, localityId, absenceAlertWeeks, localOnly);
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase w-12" />
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">週</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">主日</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">祈り</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">小組</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">派遣先</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {weeks.map((row) => {
            const isExpanded = expandedWeek === row.weekStart;
            return (
              <Fragment key={row.weekStart}>
                <tr
                  key={row.weekStart}
                  onClick={() => toggleExpand(row.weekStart)}
                  className="hover:bg-slate-50 cursor-pointer touch-target"
                >
                  <td className="px-4 py-2 text-slate-400">
                    {isExpanded ? "▼" : "▶"}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-800">{row.label}</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{row.mainCount}</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{row.prayerCount}</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{row.groupCount}</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{row.dispatchCount}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      {loadingDetail ? (
                        <p className="text-sm text-slate-500">読み込み中…</p>
                      ) : detail ? (
                        <div className="grid gap-4 sm:grid-cols-2 text-sm">
                          <div className="space-y-3">
                            <div>
                              <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                主日集会
                                <Link
                                  href={`/meetings/sunday?week_start=${row.weekStart}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-400 hover:text-primary-600 transition-colors"
                                  title="出欠を編集"
                                >
                                  <PencilIcon />
                                </Link>
                              </p>
                              <div className="space-y-1.5">
                                <p className="text-slate-800">
                                  <span className="text-xs text-slate-500 mr-1">出席({detail.mainAttendees.length})</span>
                                  {detail.mainAttendees.length === 0
                                    ? "—"
                                    : detail.mainAttendees.map((m) => m.name).join("、")}
                                </p>
                                {detail.mainAbsent.length > 0 && (
                                  <p>
                                    <span className="text-xs text-slate-500 mr-1">欠席({detail.mainAbsent.length})</span>
                                    {detail.mainAbsent.map((m, i) => (
                                      <span key={m.memberId}>
                                        {i > 0 && "、"}
                                        <span className="text-red-600">{m.name}</span>
                                        {m.memo && <span className="text-xs text-slate-500 ml-0.5">({m.memo})</span>}
                                      </span>
                                    ))}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                祈りの集会
                                <Link
                                  href={`/meetings/prayer?week_start=${row.weekStart}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-400 hover:text-primary-600 transition-colors"
                                  title="出欠を編集"
                                >
                                  <PencilIcon />
                                </Link>
                              </p>
                              <p className="text-slate-800">
                                {detail.prayerAttendees.length === 0
                                  ? "—"
                                  : detail.prayerAttendees.map((m) => m.name).join("、")}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                小組
                                <Link
                                  href={`/meetings/small-group?week_start=${row.weekStart}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-400 hover:text-primary-600 transition-colors"
                                  title="出欠を編集"
                                >
                                  <PencilIcon />
                                </Link>
                              </p>
                              <p className="text-slate-800">
                                {detail.groupAttendees.length === 0
                                  ? "—"
                                  : detail.groupAttendees.map((m) => m.name).join("、")}
                              </p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                派遣先
                                <Link
                                  href={`/meetings/organic?week_start=${row.weekStart}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-400 hover:text-primary-600 transition-colors"
                                  title="出欠を編集"
                                >
                                  <PencilIcon />
                                </Link>
                              </p>
                              <p className="text-slate-800">
                                {detail.dispatchNames.length === 0
                                  ? "—"
                                  : detail.dispatchNames.map((m) => m.name).join("、")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
