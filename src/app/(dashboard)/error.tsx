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

export default function DashboardError({
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-xl font-bold text-slate-800">エラーが発生しました</h1>
        <p className="text-sm text-slate-600 break-all">{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          再試行
        </button>
        <p className="text-xs text-slate-500">
          解決しない場合は .env.local の設定を確認し、ブラウザを再読み込みしてください。
        </p>
      </div>
    </div>
  );
}
