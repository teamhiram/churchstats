"use client";

import { useEffect } from "react";

function getRedirectUrl(error: Error & { digest?: string }): string | null {
  if (error?.digest && String(error.digest).startsWith("NEXT_REDIRECT")) {
    const parts = String(error.digest).split(";");
    if (parts[2]) return parts[2];
    return "/";
  }
  if (error?.message === "NEXT_REDIRECT") {
    return "/";
  }
  return null;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const redirectUrl = getRedirectUrl(error);

  useEffect(() => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }
    console.error(error);
  }, [error, redirectUrl]);

  if (redirectUrl) {
    if (typeof window !== "undefined") {
      window.location.href = redirectUrl;
    }
    return null;
  }

  return (
    <html lang="ja">
      <body
        className="antialiased bg-slate-50 min-h-screen flex flex-col items-center justify-center p-4"
        style={{ minHeight: "100vh", backgroundColor: "#f8fafc", color: "#0f172a", margin: 0 }}
      >
        <div className="max-w-md w-full space-y-4 text-center" style={{ padding: 16 }}>
          <h1 className="text-xl font-bold" style={{ color: "#0f172a" }}>召会生活統計</h1>
          <p className="text-lg font-medium" style={{ color: "#334155" }}>エラーが発生しました</p>
          <p className="text-sm break-all" style={{ color: "#475569" }}>{error.message}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
          >
            再試行
          </button>
          <p className="text-xs text-slate-500">
            .env.local の設定を確認し、サーバーを再起動（Ctrl+C のあと npm run dev）してから、ブラウザを再読み込みしてください。
          </p>
        </div>
      </body>
    </html>
  );
}
