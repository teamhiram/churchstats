"use client";

import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseEnv()) {
      setMessage("環境変数が未設定です。.env.local を確認し、サーバーを再起動してください。");
      return;
    }
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-bold text-center text-slate-800">召会生活統計</h1>
      <p className="text-center text-slate-600 text-sm">ログイン</p>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          />
        </div>
        {message && <p className="text-sm text-red-600">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-lg touch-target disabled:opacity-50 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          {loading ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div className="text-slate-500">読み込み中…</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
