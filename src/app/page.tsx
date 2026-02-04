import { createClient } from "@/lib/supabase/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "@/app/login/LoginForm";

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50"
        style={{ minHeight: "100vh", padding: 16, backgroundColor: "#f8fafc", color: "#0f172a" }}
      >
        <h1 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>召会生活統計</h1>
        <p className="text-center max-w-md mb-4" style={{ color: "#475569" }}>
          {msg.includes("環境変数") || msg.includes("URL") || msg.includes("Key")
            ? msg
            : `エラー: ${msg}`}
        </p>
        <p className="text-sm" style={{ color: "#64748b" }}>
          .env.local を設定し、サーバーを再起動（Ctrl+C のあと npm run dev）してください。
        </p>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50"
      style={{ minHeight: "100vh", padding: 16, backgroundColor: "#f8fafc", color: "#0f172a" }}
    >
      <Suspense fallback={<div style={{ color: "#64748b" }}>読み込み中…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
