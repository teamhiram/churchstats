"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Toggle } from "@/components/Toggle";

type Locality = { id: string; name: string };

type Props = {
  year: number;
  localityId: string | null;
  localOnly: boolean;
  years: number[];
  localities: Locality[];
  showLocalityFilter?: boolean;
};

export function MeetingsListFilters({ year, localityId, localOnly, years, localities, showLocalityFilter = false }: Props) {
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
      {showLocalityFilter && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50/50">
          <span className="text-xs font-medium text-amber-800/80">管理者</span>
          <label htmlFor="locality" className="text-sm font-medium text-slate-700">
            地方
          </label>
          <select
            id="locality"
            value={localityId ?? "all"}
            className="px-3 py-2 border border-amber-300 rounded-lg text-sm touch-target bg-white"
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
      )}
      <Toggle
        checked={localOnly}
        onChange={() => updateParams({ localOnly: !localOnly })}
        ariaLabel="ローカルのみ"
        label="ローカルのみ"
      />
    </div>
  );
}
