"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/meetings/list", label: "週別集計" },
  { href: "/meetings", label: "出欠登録" },
  { href: "/members", label: "名簿管理" },
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "システム設定" },
  { href: "/backup", label: "バックアップ" },
];

type NavProps = {
  displayName?: string | null;
  roleLabel?: string;
  localityName?: string | null;
};

export function Nav({ displayName, roleLabel, localityName }: NavProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <nav className="md:w-52 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex md:flex-col">
      <div className="flex md:flex-col flex-1 overflow-x-auto">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-3 touch-target whitespace-nowrap text-sm font-medium ${
              pathname === href
                ? "text-primary-600 bg-primary-50 border-b-2 md:border-b-0 md:border-l-2 border-primary-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="border-t border-slate-200 p-2 shrink-0 space-y-2">
        <div className="px-3 py-2 text-xs text-slate-600 space-y-0.5">
          <p className="font-medium text-slate-800 truncate" title={displayName ?? undefined}>
            {displayName && displayName !== "" ? displayName : "—"}
          </p>
          <p className="text-slate-500">ロール: {roleLabel ?? "—"}</p>
          <p className="text-slate-500">所属地方: {localityName && localityName !== "" ? localityName : "—"}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded touch-target"
        >
          ログアウト
        </button>
      </div>
    </nav>
  );
}
