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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = buildCopyText(weekLabel ?? "", main, group);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [weekLabel, main, group]);

  const undispatchedCount = main.filter((m) => !m.dispatched).length + group.filter((m) => !m.dispatched).length;

  return (
    <section className="bg-white rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-800 text-sm">派遣モニター</h2>
          {undispatchedCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-orange-500 rounded-full">
              {undispatchedCount}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="relative px-4 pb-4">
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
              <span>コピーしました</span>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                <span>コピー</span>
              </>
            )}
          </button>
        </div>
      )}
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
