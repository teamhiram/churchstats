"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useState, useRef, useEffect, useLayoutEffect, type RefObject } from "react";

const baseLinks: { href?: string; label: string; type?: "dropdown"; children?: { href: string; label: string }[] }[] = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/meetings/list", label: "週別集計" },
  { href: "/meetings", label: "出欠登録" },
  { href: "/members", label: "名簿管理" },
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "システム設定" },
  { href: "/settings/account", label: "アカウント詳細" },
  { type: "dropdown", label: "デバッグ", children: [{ href: "/debug/tables", label: "全テーブル" }, { href: "/meetings/list/duplicates", label: "重複出席" }] },
];

/** モバイルフッター用: 速報｜週別｜出欠｜名簿｜設定（設定はサブメニュー） */
const footerMainItems = [
  { href: "/dashboard", label: "速報" },
  { href: "/meetings/list", label: "週別" },
  { href: "/meetings", label: "出欠" },
  { href: "/members", label: "名簿" },
] as const;

const settingsSubItems = [
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "システム設定" },
  { href: "/settings/account", label: "アカウント詳細" },
] as const;

const debugSubItems = [{ href: "/debug/tables", label: "全テーブル" }, { href: "/meetings/list/duplicates", label: "重複出席" }] as const;

type NavProps = {
  displayName?: string | null;
  roleLabel?: string;
  localityName?: string | null;
  /** 管理者のみデバッグメニューを表示。共同管理者以下は false */
  showDebug?: boolean;
};

function isSettingsPath(pathname: string) {
  return pathname.startsWith("/settings");
}

const contentWidthClass = (fullWidth: boolean) =>
  fullWidth ? "w-full" : "w-full max-w-7xl mx-auto";

function DebugDropdownPc({
  children,
  pathname,
  onClose,
  anchorRef,
}: {
  children: { href: string; label: string }[];
  pathname: string;
  onClose: () => void;
  anchorRef: RefObject<HTMLDivElement | null>;
}) {
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom, left: r.left });
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [anchorRef]);
  if (rect === null) return null;
  return (
    <div
      className="fixed w-40 rounded-b-lg border border-t-0 border-amber-200 bg-amber-50/95 py-1 shadow-lg z-[100]"
      style={{ top: rect.top, left: rect.left }}
      role="menu"
    >
      {children.map(({ href, label }) => {
        const childActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`block px-4 py-2 text-sm touch-target ${
              childActive ? "bg-primary-50 text-primary-700 font-medium" : "text-slate-700 hover:bg-slate-50"
            }`}
            role="menuitem"
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function Nav({ displayName, roleLabel, localityName, showDebug = false }: NavProps) {
  const pathname = usePathname();
  const { fullWidth } = useDisplaySettings();
  const [settingsSubOpen, setSettingsSubOpen] = useState(false);
  const [debugSubOpen, setDebugSubOpen] = useState(false);
  const links = showDebug ? baseLinks : baseLinks.filter((item) => item.type !== "dropdown" || item.label !== "デバッグ");
  const settingsRef = useRef<HTMLDivElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const debugRefMobile = useRef<HTMLDivElement>(null);
  const debugJustOpenedRef = useRef(false);

  useEffect(() => {
    if (!settingsSubOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsSubOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [settingsSubOpen]);

  useEffect(() => {
    if (!debugSubOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (debugJustOpenedRef.current) {
        debugJustOpenedRef.current = false;
        return;
      }
      const target = e.target as Node;
      const insidePc = debugRef.current?.contains(target);
      const insideMobile = debugRefMobile.current?.contains(target);
      if (!insidePc && !insideMobile) setDebugSubOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [debugSubOpen]);

  return (
    <>
      {/* PC: トップ固定ナビゲーション */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-40 h-12 bg-white border-b border-slate-200">
        <div className={`h-full flex items-center justify-between px-4 ${contentWidthClass(fullWidth)}`}>
          <nav className="flex h-full overflow-x-auto">
            {links.map((item) => {
              if (item.type === "dropdown" && item.children) {
                const isActive = item.children.some((c) => pathname.startsWith(c.href));
                return (
                  <div key={item.label} className="relative h-full flex items-stretch border-x-2 border-amber-300 bg-amber-50/40" ref={debugRef}>
                    <button
                      type="button"
                      onClick={() => {
                        debugJustOpenedRef.current = true;
                        setDebugSubOpen((o) => !o);
                      }}
                      className={`flex items-center h-full px-4 text-sm font-medium whitespace-nowrap touch-target ${
                        isActive ? "bg-primary-600 text-white" : "text-amber-800/90 hover:bg-amber-100/60"
                      }`}
                      aria-expanded={debugSubOpen}
                      aria-haspopup="true"
                    >
                      {item.label}
                      <svg
                        className={`ml-1 w-4 h-4 transition-transform ${debugSubOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {debugSubOpen &&
                      createPortal(
                        <DebugDropdownPc
                          children={item.children}
                          pathname={pathname}
                          onClose={() => setDebugSubOpen(false)}
                          anchorRef={debugRef}
                        />,
                        document.body
                      )}
                  </div>
                );
              }
              const { href, label } = item as { href: string; label: string };
              const isActive =
                pathname === href ||
                (href === "/meetings" &&
                  pathname.startsWith("/meetings") &&
                  !pathname.startsWith("/meetings/list")) ||
                (href === "/settings" && pathname === "/settings") ||
                (href === "/settings/organization" && pathname.startsWith("/settings/organization")) ||
                (href === "/settings/account" && pathname.startsWith("/settings/account"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center h-full px-4 text-sm font-medium whitespace-nowrap touch-target ${
                    isActive ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* モバイル: 固定フッター + 5ボタン */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <nav className={`flex h-8 items-stretch ${contentWidthClass(fullWidth)}`} aria-label="メインメニュー">
          {footerMainItems.map(({ href, label }) => {
            const isActive =
              (href === "/dashboard" && pathname === "/dashboard") ||
              (href === "/meetings/list" && pathname.startsWith("/meetings/list")) ||
              (href === "/meetings" && pathname.startsWith("/meetings") && !pathname.startsWith("/meetings/list")) ||
              (href === "/members" && pathname.startsWith("/members"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 h-full flex items-center justify-center text-sm font-medium min-h-0 ${
                  isActive ? "text-primary-600 bg-primary-50" : "text-slate-600 active:bg-slate-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <div className="relative flex-1 h-full flex" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsSubOpen((o) => !o)}
              className={`w-full h-full flex items-center justify-center text-sm font-medium min-h-0 ${
                isSettingsPath(pathname) ? "text-primary-600 bg-primary-50" : "text-slate-600 active:bg-slate-100"
              }`}
              aria-expanded={settingsSubOpen}
              aria-haspopup="true"
              aria-label="設定"
            >
              設定
            </button>
            {settingsSubOpen && (
              <div
                className="absolute bottom-full right-4 left-auto mb-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50"
                role="menu"
              >
                {settingsSubItems.map(({ href, label }) => {
                  const isActive =
                    (href === "/settings/organization" && pathname.startsWith("/settings/organization")) ||
                    (href === "/settings" && pathname === "/settings") ||
                    (href === "/settings/account" && pathname.startsWith("/settings/account"));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSettingsSubOpen(false)}
                      className={`block px-3 py-2.5 text-sm touch-target ${
                        isActive ? "bg-primary-50 text-primary-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                      }`}
                      role="menuitem"
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          {showDebug && (
            <div className="relative flex-1 h-full flex border-x border-amber-300 bg-amber-50/40" ref={debugRefMobile}>
              <button
                type="button"
                onClick={() => {
                  debugJustOpenedRef.current = true;
                  setDebugSubOpen((o) => !o);
                }}
                className={`w-full h-full flex items-center justify-center text-sm font-medium min-h-0 ${
                  pathname.startsWith("/debug") || pathname.startsWith("/meetings/list/duplicates") ? "text-primary-600 bg-primary-50" : "text-amber-800/90 active:bg-amber-100/60"
                }`}
                aria-expanded={debugSubOpen}
                aria-haspopup="true"
                aria-label="デバッグ"
              >
                デバッグ
              </button>
              {debugSubOpen && (
                <div
                  className="absolute bottom-full right-0 left-auto mb-1 w-36 rounded-lg border border-amber-200 bg-amber-50/95 py-1 shadow-lg z-50"
                  role="menu"
                >
                  {debugSubItems.map(({ href, label }) => {
                    const isActive = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDebugSubOpen(false)}
                        className={`block px-3 py-2.5 text-sm touch-target ${
                          isActive ? "bg-primary-50 text-primary-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                        }`}
                        role="menuitem"
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </footer>
    </>
  );
}
