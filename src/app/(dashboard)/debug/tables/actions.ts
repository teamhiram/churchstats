"use server";

import { createClient } from "@/lib/supabase/server";
import { DEBUG_TABLE_NAMES, type DebugTableName } from "./constants";

const MAX_ROWS = 500;

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type QueryChain = {
  select: (s: string) => QueryChain;
  limit: (n: number) => QueryChain;
  ilike: (col: string, pattern: string) => QueryChain;
  eq: (col: string, val: string | number | boolean) => QueryChain;
  order: (col: string, opts?: { ascending: boolean }) => QueryChain;
  then: (onFulfilled: (value: { data: unknown[] | null; error: unknown }) => unknown) => Promise<unknown>;
};

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
  const from = (supabase as { from: (t: string) => QueryChain }).from.bind(supabase);
  let query: QueryChain = from(tableName).select("*").limit(limit);

  const filterEntries = Object.entries(columnFilters).filter(([, v]) => v !== "" && v != null);
  for (const [column, value] of filterEntries) {
    const v = value.trim();
    if (!v) continue;
    query = query.ilike(column, `%${escapeLike(v)}%`);
  }

  let result = (await query) as { data: Record<string, unknown>[] | null; error: { message?: string } | null };
  if (result.error && filterEntries.length > 0) {
    // ilike が使えない列（UUID 等）の場合は完全一致で再試行
    query = from(tableName).select("*").limit(limit);
    for (const [column, value] of filterEntries) {
      const v = value.trim();
      if (!v) continue;
      query = query.eq(column, v);
    }
    result = (await query) as { data: Record<string, unknown>[] | null; error: { message?: string } | null };
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
