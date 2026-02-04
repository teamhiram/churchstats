"use client";

import { useEffect, useState } from "react";

/** ルート用: children をラップし、window の error / unhandledrejection 時にエラー表示。白画面防止のため children は必ずラップする。 */
export function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      setError(e.message || String(e.error));
      console.error(e);
    };
    const onUnhandled = (e: PromiseRejectionEvent) => {
      setError(e.reason?.message || String(e.reason));
      console.error(e);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-xl font-bold text-slate-800">召会生活統計</h1>
          <p className="text-lg font-medium text-slate-700">エラーが発生しました</p>
          <p className="text-sm text-slate-600 break-all bg-slate-100 p-3 rounded">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
