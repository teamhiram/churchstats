"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateCache } from "./actions";

export function CacheSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRefresh = async () => {
    setLoading(true);
    setMessage("");
    try {
      await revalidateCache();
      router.refresh();
      setMessage("キャッシュをリフレッシュしました。データは再取得されます。");
    } catch {
      setMessage("キャッシュのリフレッシュに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 className="font-semibold text-slate-800 mb-4">キャッシュ</h2>
      <p className="text-slate-600 text-sm mb-3">
        ダッシュボードや集会一覧などは表示を速くするためキャッシュしています。「キャッシュをリフレッシュ」を押すとキャッシュをクリアし、次回表示時に最新のデータを再取得します。
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="rounded-md bg-primary-600 text-white px-3 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          {loading ? "処理中…" : "キャッシュをリフレッシュ"}
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </section>
  );
}
