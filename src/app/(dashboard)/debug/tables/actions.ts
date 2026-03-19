"use server";

import { createClient } from "@/lib/supabase/server";
import { DEBUG_TABLE_NAMES, type DebugTableName } from "./constants";

const MAX_ROWS = 500;

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function getLocalitiesForDebug(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("localities").select("id, name").order("name");
  if (error) return [];
  return (data ?? []) as { id: string; name: string }[];
}

export async function getDebugTableData(
  tableName: string,
  columnFilters: Record<string, string>,
  limit: number = MAX_ROWS
): Promise<{
  data: Record<string, unknown>[];
  columns: string[];
  error?: string;
}> {
  if (!DEBUG_TABLE_NAMES.includes(tableName as DebugTableName)) {
    return { data: [], columns: [], error: "不正なテーブル名です" };
  }

  const supabase = await createClient();
  const localityFilter = (columnFilters.locality ?? "").trim();
  const filterEntries = Object.entries(columnFilters)
    .filter(([k, v]) => k !== "locality" && v !== "" && v != null);

  let query = supabase.from(tableName).select("*").limit(limit);

  if (localityFilter) {
    // UI の locality（地方名）フィルターは locality_id に対する絞り込みとして扱う
    query = query.eq("locality_id", localityFilter);
  }

  for (const [column, value] of filterEntries) {
    const v = value.trim();
    if (!v) continue;
    query = query.ilike(column, `%${escapeLike(v)}%`);
  }

  let result = await query;

  if (result.error && filterEntries.length > 0) {
    // ilike が使えない列（UUID 等）の場合は完全一致で再試行
    let eqQuery = supabase.from(tableName).select("*").limit(limit);
    if (localityFilter) {
      eqQuery = eqQuery.eq("locality_id", localityFilter);
    }
    for (const [column, value] of filterEntries) {
      const v = value.trim();
      if (!v) continue;
      eqQuery = eqQuery.eq(column, v);
    }
    result = await eqQuery;
  }

  const { data, error } = result;
  if (error) {
    const errMsg = error?.message ?? String(error);
    return { data: [], columns: [], error: errMsg };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  let columns =
    rows.length > 0
      ? Object.keys(rows[0]).sort((a, b) => (a === "id" ? -1 : b === "id" ? 1 : a.localeCompare(b)))
      : [];

  // locality_id があるテーブルは locality（地方名）を補助列として付与し、UI から locality_id は隠す
  if (rows.length > 0 && columns.includes("locality_id")) {
    const localityIds = [...new Set(rows.map((r) => r.locality_id).filter((v) => typeof v === "string" && v !== ""))] as string[];
    if (localityIds.length > 0) {
      const { data: locRows } = await supabase.from("localities").select("id, name").in("id", localityIds);
      const idToName = new Map(((locRows ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));
      for (const r of rows) {
        const lid = typeof r.locality_id === "string" ? r.locality_id : null;
        r.locality = lid ? (idToName.get(lid) ?? null) : null;
      }
      if (!columns.includes("locality")) {
        const idx = columns.indexOf("locality_id");
        if (idx >= 0) columns.splice(idx + 1, 0, "locality");
        else columns.push("locality");
      }
      // UI では locality_id を出さない（ただし rows には残す）
      columns = columns.filter((c) => c !== "locality_id");
    }
  }

  return { data: rows, columns };
}
