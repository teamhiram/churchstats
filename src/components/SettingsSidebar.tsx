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
  { href: "/debug/meetings-list", label: "集会一覧" },
  { href: "/debug/enrollment-uncertain", label: "在籍期間不確定", badgeCount: "enrollmentUncertain" as const },
  { href: "/debug/meeting-duplicates", label: "集会重複検知", badgeCount: "meetingDuplicates" as const },
  { href: "/weekly/duplicates", label: "重複出席", badgeCount: "duplicateAttendance" as const },
] as const;

function isItemActive(href: string, pathname: string) {
  if (href === "/settings") return pathname === "/settings";
  return pathname.startsWith(href);
}

export function SettingsSidebar({
  showDebug,
  showRolesManagement,
  meetingDuplicateGroupCount = 0,
  duplicateAttendanceGroupCount = 0,
  enrollmentUncertainCount = 0,
  onCollapse,
  className = "",
}: {
  showDebug: boolean;
  showRolesManagement?: boolean;
  meetingDuplicateGroupCount?: number;
  duplicateAttendanceGroupCount?: number;
  enrollmentUncertainCount?: number;
  onCollapse?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className={`w-56 min-w-[14rem] shrink-0 border-r border-slate-200 bg-slate-50/80 flex flex-col ${className}`}>
      {onCollapse && (
        <div className="flex justify-end p-2 border-b border-slate-200 bg-white/80">
          <button
            type="button"
            onClick={onCollapse}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 touch-target"
            aria-label="サイドバーを隠す"
            title="サイドバーを隠す"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}
      <nav className="p-3 flex-1 flex flex-col gap-5 overflow-y-auto min-h-0" aria-label="設定メニュー">
        <div className="space-y-0.5">
          {settingsSidebarItems.map(({ href, label }) => {
            const active = isItemActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`block px-3 py-2.5 text-sm rounded-lg touch-target min-w-0 ${
                  active ? "bg-primary-100 text-primary-800 font-medium" : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {showRolesManagement && (
            <Link
              href={rolesSidebarItem.href}
              className={`block px-3 py-2.5 text-sm rounded-lg touch-target min-w-0 ${
                pathname.startsWith(rolesSidebarItem.href)
                  ? "bg-primary-100 text-primary-800 font-medium"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              {rolesSidebarItem.label}
            </Link>
          )}
        </div>
        {showDebug && (
          <div className="space-y-0.5">
            <p className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase tracking-wider" role="presentation">
              デバッグ
            </p>
            {debugSidebarItems.map((item) => {
              const active = isItemActive(item.href, pathname);
              const badgeCount =
                "badgeCount" in item && item.badgeCount === "meetingDuplicates"
                  ? meetingDuplicateGroupCount
                  : "badgeCount" in item && item.badgeCount === "duplicateAttendance"
                    ? duplicateAttendanceGroupCount
                    : "badgeCount" in item && item.badgeCount === "enrollmentUncertain"
                      ? enrollmentUncertainCount
                      : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-lg touch-target min-w-0 ${
                    active
                      ? "bg-amber-100 text-amber-900 font-medium"
                      : "text-amber-800 hover:bg-amber-50 hover:bg-amber-100/70"
                  }`}
                >
                  <span className="min-w-0 break-words">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="shrink-0 min-w-[1.25rem] px-1.5 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full text-center">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
