"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/meetings/list", label: "週別集計" },
  { href: "/meetings", label: "出欠登録" },
  { href: "/members", label: "名簿管理" },
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "システム設定" },
];

type NavProps = {
  displayName?: string | null;
  roleLabel?: string;
  localityName?: string | null;
};

function AccountBlock({
  displayName,
  roleLabel,
  localityName,
  onLinkClick,
}: {
  displayName?: string | null;
  roleLabel?: string;
  localityName?: string | null;
  onLinkClick?: () => void;
}) {
  const handleSignOut = async () => {
    onLinkClick?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
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
  );
}

function DrawerNavContent({
  pathname,
  onLinkClick,
  displayName,
  roleLabel,
  localityName,
}: {
  pathname: string;
  onLinkClick: () => void;
  displayName?: string | null;
  roleLabel?: string;
  localityName?: string | null;
}) {
  return (
    <>
      <div className="flex flex-col gap-1 py-2">
        {links.map(({ href, label }) => {
          const isActive =
            pathname === href ||
            (href === "/meetings" &&
              pathname.startsWith("/meetings") &&
              !pathname.startsWith("/meetings/list")) ||
            (href === "/settings" && pathname === "/settings");
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={`block px-4 py-3 touch-target text-sm font-medium rounded-lg ${
                isActive ? "bg-primary-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="mt-2">
        <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">アカウント</p>
        <AccountBlock
          displayName={displayName}
          roleLabel={roleLabel}
          localityName={localityName}
          onLinkClick={onLinkClick}
        />
      </div>
    </>
  );
}

export function Nav({ displayName, roleLabel, localityName }: NavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!accountOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [accountOpen]);

  return (
    <>
      {/* PC: トップ固定ナビゲーション */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-40 h-12 bg-white border-b border-slate-200">
        <div className="h-full flex items-center justify-between px-4">
          <nav className="flex h-full overflow-x-auto">
            {links.map(({ href, label }) => {
              const isActive =
                pathname === href ||
                (href === "/meetings" &&
                  pathname.startsWith("/meetings") &&
                  !pathname.startsWith("/meetings/list")) ||
                (href === "/settings" && pathname === "/settings");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center h-full px-4 text-sm font-medium whitespace-nowrap touch-target ${
                    isActive
                      ? "bg-primary-700 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="relative shrink-0" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 touch-target"
              aria-expanded={accountOpen}
              aria-haspopup="true"
              aria-label="アカウントメニュー"
            >
              <span>アカウント</span>
              <svg
                className={`w-4 h-4 transition-transform ${accountOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {accountOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg z-50"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">アカウント</p>
                </div>
                <div className="px-3 py-2 text-xs text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-800 truncate" title={displayName ?? undefined}>
                    氏名: {displayName && displayName !== "" ? displayName : "—"}
                  </p>
                  <p className="text-slate-500">ロール: {roleLabel ?? "—"}</p>
                  <p className="text-slate-500">所属地方: {localityName && localityName !== "" ? localityName : "—"}</p>
                </div>
                <div className="px-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setAccountOpen(false);
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      window.location.href = "/login";
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md touch-target"
                    role="menuitem"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* モバイル: 右下の丸いハンバーガーボタン（リキッドグラス風・クリックで開閉トグル） */}
      <button
        type="button"
        onClick={() => setDrawerOpen((o) => !o)}
        className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary-500/20 backdrop-blur-md border border-white/30 shadow-lg hover:bg-primary-500/35 active:scale-95 transition-all flex items-center justify-center touch-target text-primary-700"
        aria-label={drawerOpen ? "メニューを閉じる" : "メニューを開く"}
        aria-expanded={drawerOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* モバイル: ハンバーガー上に開くパネル（必要分の高さのみ） */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity"
            aria-hidden
            onClick={closeDrawer}
          />
          <aside
            className="md:hidden fixed right-6 bottom-[5.5rem] z-50 w-[min(320px,calc(100vw-3rem))] max-h-[calc(100dvh-6rem-4rem)] bg-white rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-y-auto"
            role="dialog"
            aria-label="ナビゲーション"
          >
            <div className="overflow-y-auto">
              <DrawerNavContent
                pathname={pathname}
                onLinkClick={closeDrawer}
                displayName={displayName}
                roleLabel={roleLabel}
                localityName={localityName}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
