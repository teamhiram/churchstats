"use client";

import dynamic from "next/dynamic";
import type { StatisticsChartsProps } from "./StatisticsCharts";

const StatisticsCharts = dynamic<StatisticsChartsProps>(
  () => import("./StatisticsCharts").then((m) => ({ default: m.StatisticsCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg bg-slate-200 h-64 flex items-center justify-center text-slate-500 text-sm">
        読み込み中…
      </div>
    ),
  }
);

export function StatisticsChartsDynamic(props: StatisticsChartsProps) {
  return <StatisticsCharts {...props} />;
}
