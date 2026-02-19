import Link from "next/link";
import { DebugTablesClient } from "./DebugTablesClient";

export const dynamic = "force-dynamic";

export default function DebugTablesPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        テーブルを選んでデータを表示します。列ごとにフィルターを入力し「フィルター適用」で絞り込みできます。
      </p>
      <p className="text-sm">
        <Link href="/debug/enrollment-uncertain" className="text-primary-600 hover:underline">
          在籍期間不確定リスト →
        </Link>
      </p>
      <p className="text-sm">
        <Link href="/debug/meeting-duplicates" className="text-primary-600 hover:underline">
          集会重複検知 →
        </Link>
      </p>
      <DebugTablesClient />
    </div>
  );
}
