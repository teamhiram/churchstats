"use client";

import { Fragment, useState } from "react";
import { getWeekDetail, type WeekRow, type WeekDetail } from "./actions";

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
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">主日人数</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">小組人数</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">派遣先人数</th>
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
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{row.groupCount}</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{row.dispatchCount}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      {loadingDetail ? (
                        <p className="text-sm text-slate-500">読み込み中…</p>
                      ) : detail ? (
                        <div className="grid gap-4 sm:grid-cols-2 text-sm">
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium text-slate-700 mb-1">主日欠席者</p>
                              <ul className="space-y-0.5">
                                {detail.mainAbsent.length === 0 && (
                                  <li className="text-slate-500">—</li>
                                )}
                                {detail.mainAbsent.map((m) => (
                                  <li
                                    key={m.memberId}
                                    className={m.inDispatch ? "text-blue-600" : "text-red-600"}
                                  >
                                    {m.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium text-slate-700 mb-1">小組欠席者</p>
                              <ul className="space-y-0.5">
                                {detail.groupAbsent.length === 0 && (
                                  <li className="text-slate-500">—</li>
                                )}
                                {detail.groupAbsent.map((m) => (
                                  <li
                                    key={m.memberId}
                                    className={m.inDispatch ? "text-blue-600" : "text-red-600"}
                                  >
                                    {m.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-slate-700 mb-1">派遣先</p>
                            <ul className="space-y-0.5">
                              {detail.dispatchNames.length === 0 && (
                                <li className="text-slate-500">—</li>
                              )}
                              {detail.dispatchNames.map((m) => (
                                <li key={m.memberId} className="text-slate-800">
                                  {m.name}
                                </li>
                              ))}
                            </ul>
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
