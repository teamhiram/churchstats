import { DebugTablesClient } from "./DebugTablesClient";

export const dynamic = "force-dynamic";

export default function DebugTablesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">デバッグ: 全テーブル表示</h1>
      <p className="text-sm text-slate-600">
        テーブルを選んでデータを表示します。列ごとにフィルターを入力し「フィルター適用」で絞り込みできます。
      </p>
      <DebugTablesClient />
    </div>
  );
}
