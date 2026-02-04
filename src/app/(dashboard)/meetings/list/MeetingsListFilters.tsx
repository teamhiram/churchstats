"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Locality = { id: string; name: string };

type Props = {
  year: number;
  localityId: string | null;
  localOnly: boolean;
  years: number[];
  localities: Locality[];
};

export function MeetingsListFilters({ year, localityId, localOnly, years, localities }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = (updates: { year?: number; locality?: string; localOnly?: boolean }) => {
    const next = new URLSearchParams(searchParams.toString());
    if (updates.year !== undefined) next.set("year", String(updates.year));
    if (updates.locality !== undefined) {
      if (updates.locality === "all") next.delete("locality");
      else next.set("locality", updates.locality);
    }
    if (updates.localOnly !== undefined) {
      if (updates.localOnly) next.delete("localOnly");
      else next.set("localOnly", "0");
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label htmlFor="year" className="text-sm font-medium text-slate-700">
          年
        </label>
        <select
          id="year"
          value={year}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
          onChange={(e) => updateParams({ year: Number(e.target.value), locality: localityId ?? "all" })}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="locality" className="text-sm font-medium text-slate-700">
          地方
        </label>
        <select
          id="locality"
          value={localityId ?? "all"}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
          onChange={(e) => updateParams({ locality: e.target.value })}
        >
          <option value="all">全体</option>
          {localities.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={localOnly}
          onClick={() => updateParams({ localOnly: !localOnly })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
            localOnly ? "bg-primary-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
              localOnly ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <label className="text-sm font-medium text-slate-700 cursor-pointer touch-target" onClick={() => updateParams({ localOnly: !localOnly })}>
          ローカルのみ
        </label>
      </div>
    </div>
  );
}
