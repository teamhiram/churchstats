import { DebugTablesClient } from "./DebugTablesClient";

export const dynamic = "force-dynamic";

export default function DebugTablesPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        テーブルを選んでデータを表示します。列ごとにフィルターを入力し「フィルター適用」で絞り込みできます。
      </p>
      <DebugTablesClient />
    </div>
  );
}
