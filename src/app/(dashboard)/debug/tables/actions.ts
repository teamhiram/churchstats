"use server";

import { createClient } from "@/lib/supabase/server";
import { DEBUG_TABLE_NAMES, type DebugTableName } from "./constants";

const MAX_ROWS = 500;

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
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
  const filterEntries = Object.entries(columnFilters).filter(([, v]) => v !== "" && v != null);

  let query = supabase.from(tableName).select("*").limit(limit);

  for (const [column, value] of filterEntries) {
    const v = value.trim();
    if (!v) continue;
    query = query.ilike(column, `%${escapeLike(v)}%`);
  }

  let result = await query;

  if (result.error && filterEntries.length > 0) {
    // ilike が使えない列（UUID 等）の場合は完全一致で再試行
    let eqQuery = supabase.from(tableName).select("*").limit(limit);
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
  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).sort((a, b) => (a === "id" ? -1 : b === "id" ? 1 : a.localeCompare(b)))
      : [];

  return { data: rows, columns };
}
