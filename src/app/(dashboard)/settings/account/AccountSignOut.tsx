"use client";

import { createClient } from "@/lib/supabase/client";

export function AccountSignOut() {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 touch-target"
    >
      ログアウト
    </button>
  );
}
