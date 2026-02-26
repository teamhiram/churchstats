"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsSidebarItems = [
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "システム設定" },
] as const;

const rolesSidebarItem = { href: "/settings/roles", label: "ユーザ・ロール管理" } as const;

const debugSidebarItems = [
  { href: "/debug/numbers", label: "各種数値" },
  { href: "/debug/tables", label: "全テーブル" },
  { href: "/debug/enrollment-uncertain", label: "在籍期間不確定リスト" },
  { href: "/meetings/list/duplicates", label: "重複出席" },
] as const;

function isItemActive(href: string, pathname: string) {
  if (href === "/settings") return pathname === "/settings";
  return pathname.startsWith(href);
}

export function SettingsSidebar({
  showDebug,
  showRolesManagement,
  onCollapse,
}: {
  showDebug: boolean;
  showRolesManagement?: boolean;
  onCollapse?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      {onCollapse && (
        <div className="flex justify-end p-1 border-b border-slate-100">
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 touch-target"
            aria-label="サイドバーを隠す"
            title="サイドバーを隠す"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}
      <nav className="p-2 flex-1 flex flex-col gap-4" aria-label="設定メニュー">
        <div className="space-y-0.5">
          {settingsSidebarItems.map(({ href, label }) => {
            const active = isItemActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`block px-3 py-2 text-sm rounded-lg touch-target ${
                  active ? "bg-primary-100 text-primary-800 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {showRolesManagement && (
            <Link
              href={rolesSidebarItem.href}
              className={`block px-3 py-2 text-sm rounded-lg touch-target ${
                pathname.startsWith(rolesSidebarItem.href)
                  ? "bg-primary-100 text-primary-800 font-medium"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {rolesSidebarItem.label}
            </Link>
          )}
        </div>
        {showDebug && (
          <div className="space-y-0.5">
            <p className="px-3 py-1.5 text-xs font-medium text-amber-700 uppercase tracking-wider" role="presentation">
              デバッグ
            </p>
            {debugSidebarItems.map(({ href, label }) => {
              const active = isItemActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block px-3 py-2 text-sm rounded-lg touch-target ${
                    active
                      ? "bg-amber-100 text-amber-900 font-medium"
                      : "text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
