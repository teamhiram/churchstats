"use client";

import { useState, useCallback } from "react";
import type { DispatchMonitorData } from "./actions";

type Props = DispatchMonitorData;

function buildCopyText(weekLabel: string, main: Props["mainAbsent"], group: Props["groupAbsent"]): string {
  const lines: string[] = [
    "派遣モニター",
    `今週（日曜〜土曜、${weekLabel ?? "—"}）の主日・小組欠席者。かっこ内は集計週内に派遣記録がある場合は「派遣済」、ない場合は「未派遣」。`,
    "",
    "主日欠席者",
    ...(main.length === 0 ? ["—"] : main.map((m) => `${m.name}（${m.dispatched ? "派遣済" : "未派遣"}）`)),
    "",
    "小組欠席者",
    ...(group.length === 0 ? ["—"] : group.map((m) => `${m.name}（${m.dispatched ? "派遣済" : "未派遣"}）`)),
  ];
  return lines.join("\n");
}

export function DispatchMonitor({ weekLabel, mainAbsent = [], groupAbsent = [] }: Props) {
  const main = mainAbsent ?? [];
  const group = groupAbsent ?? [];
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = buildCopyText(weekLabel ?? "", main, group);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [weekLabel, main, group]);

  return (
    <section className="relative bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-2">派遣モニター</h2>
      <p className="text-sm text-slate-500 mb-3">
        今週（日曜〜土曜、{weekLabel ?? "—"}）の主日・小組欠席者。かっこ内は集計週内に派遣記録がある場合は「派遣済」、ない場合は「未派遣」。
      </p>
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <p className="font-medium text-slate-700 mb-1">主日欠席者</p>
          <ul className="space-y-0.5">
            {main.length === 0 && <li className="text-slate-500">—</li>}
            {main.map((m) => (
              <li
                key={m.memberId}
                className={m.dispatched ? "text-green-600" : "text-orange-600"}
              >
                {m.name}（{m.dispatched ? "派遣済" : "未派遣"}）
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-slate-700 mb-1">小組欠席者</p>
          <ul className="space-y-0.5">
            {group.length === 0 && <li className="text-slate-500">—</li>}
            {group.map((m) => (
              <li
                key={m.memberId}
                className={m.dispatched ? "text-green-600" : "text-orange-600"}
              >
                {m.name}（{m.dispatched ? "派遣済" : "未派遣"}）
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        {copied ? (
          <>
            <span>コピーしました</span>
          </>
        ) : (
          <>
            <CopyIcon className="h-3.5 w-3.5" />
            <span>コピー</span>
          </>
        )}
      </button>
    </section>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  );
}
