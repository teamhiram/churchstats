"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Toggle } from "@/components/Toggle";

type Props = {
  year: number;
  localOnly: boolean;
  years: number[];
};

export function MeetingsListFilters({ year, localOnly, years }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = (updates: { year?: number; localOnly?: boolean }) => {
    const next = new URLSearchParams(searchParams.toString());
    if (updates.year !== undefined) next.set("year", String(updates.year));
    if (updates.localOnly !== undefined) {
      if (updates.localOnly) next.delete("localOnly");
      else next.set("localOnly", "0");
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <select
          id="year"
          value={year}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target"
          onChange={(e) => updateParams({ year: Number(e.target.value) })}
          aria-label="年"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>
      <Toggle
        checked={localOnly}
        onChange={() => updateParams({ localOnly: !localOnly })}
        ariaLabel="ローカルのみ"
        label="ローカルのみ"
      />
    </div>
  );
}
