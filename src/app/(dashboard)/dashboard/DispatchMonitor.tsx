import type { DispatchMonitorData } from "./actions";

type Props = DispatchMonitorData;

export function DispatchMonitor({ weekLabel, mainAbsent = [], groupAbsent = [] }: Props) {
  const main = mainAbsent ?? [];
  const group = groupAbsent ?? [];
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
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
    </section>
  );
}
