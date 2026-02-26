"use client";

import { useCallback, useEffect, useState } from "react";
import { DEBUG_TABLE_NAMES } from "./constants";
import { getDebugTableData } from "./actions";

export function DebugTablesClient() {
  const [tableName, setTableName] = useState<string>(DEBUG_TABLE_NAMES[0]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [columnVisible, setColumnVisible] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleColumns = columns.filter((col) => columnVisible[col] !== false);

  const load = useCallback(async () => {
    if (!tableName) return;
    setLoading(true);
    setError(null);
    const result = await getDebugTableData(tableName, columnFilters);
    setData(result.data);
    setColumns(result.columns);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [tableName, columnFilters]);

  useEffect(() => {
    load();
  }, [tableName]);

  useEffect(() => {
    if (!tableName) return;
    setColumnFilters((prev) => {
      const next = { ...prev };
      columns.forEach((col) => {
        if (!(col in next)) next[col] = "";
      });
      return next;
    });
    setColumnVisible((prev) => {
      const next = { ...prev };
      columns.forEach((col) => {
        if (!(col in next)) next[col] = true;
      });
      return next;
    });
  }, [tableName, columns]);

  const setFilter = (column: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [column]: value }));
  };

  const setVisible = (column: string, visible: boolean) => {
    setColumnVisible((prev) => ({ ...prev, [column]: visible }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">テーブル</label>
        <select
          value={tableName}
          onChange={(e) => {
            setTableName(e.target.value);
            setColumnFilters({});
          }}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {DEBUG_TABLE_NAMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "読込中…" : "再読み込み"}
        </button>
      </div>

      {columns.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-800">列ごとのフィルター</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {columns.map((col) => (
              <div key={col} className="min-w-0">
                <label className="flex items-center gap-2 truncate text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={columnVisible[col] !== false}
                    onChange={(e) => setVisible(col, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    aria-label={`${col} を表示`}
                  />
                  {col}
                </label>
                <input
                  type="text"
                  value={columnFilters[col] ?? ""}
                  onChange={(e) => setFilter(col, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="絞り込み"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              フィルター適用
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-2 font-medium text-slate-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="px-3 py-4 text-center text-slate-500">
                  {visibleColumns.length ? "行がありません" : "テーブルを選んでください"}
                </td>
              </tr>
            )}
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {visibleColumns.map((col) => (
                  <td key={col} className="max-w-[200px] truncate px-3 py-2 text-slate-800">
                    {row[col] == null ? "—" : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 0 && (
          <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            {data.length} 件（最大 500 件）
          </p>
        )}
      </section>
    </div>
  );
}
