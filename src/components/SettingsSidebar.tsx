"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRoleOverride } from "@/contexts/RoleOverrideContext";
import { useLocalAdmin } from "@/contexts/LocalAdminContext";

const localAdminSidebarItems = [
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "表示設定" },
  { href: "/settings/local-admin/incomplete-names", label: "氏名不完全", badgeCount: "incompleteNames" as const },
  { href: "/settings/local-admin/inactive", label: "非表示リスト", badgeCount: "inactiveMembers" as const },
  { href: "/settings/local-admin/to-be-deleted", label: "削除予定", badgeCount: "toBeDeletedMembers" as const },
] as const;

const localAdminOnlySidebarItems = [
  { href: "/settings/local-admin/users", label: "ユーザ・ロール管理（地方）" },
] as const;

const rolesSidebarItem = { href: "/settings/roles", label: "ユーザ・ロール管理" } as const;

/** セクション見出し（ヘッダーと同じ黒背景・白文字） */
const sectionTitleClass =
  "px-3 py-2 -mx-3 mt-5 text-sm font-semibold text-white bg-slate-800";
/** 一番上のセクション用（上マージンなし） */
const sectionTitleFirstClass =
  "px-3 py-2 -mx-3 text-sm font-semibold text-white bg-slate-800";

const databaseMaintenanceSidebarItems = [
  { href: "/settings/backup", label: "バックアップ・リストア" },
  { href: "/debug/tables", label: "全テーブル" },
  { href: "/debug/meetings-list", label: "集会一覧" },
  { href: "/debug/numbers", label: "各種数値" },
  { href: "/debug/meeting-duplicates", label: "集会重複検知", badgeCount: "meetingDuplicates" as const },
  { href: "/weekly/duplicates", label: "重複出席", badgeCount: "duplicateAttendance" as const },
  { href: "/debug/enrollment-uncertain", label: "在籍期間不確定", badgeCount: "enrollmentUncertain" as const },
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
  incompleteNamesCount = 0,
  inactiveMembersCount = 0,
  toBeDeletedMembersCount = 0,
  onCollapse,
  className = "",
}: {
  showDebug: boolean;
  showRolesManagement?: boolean;
  meetingDuplicateGroupCount?: number;
  duplicateAttendanceGroupCount?: number;
  enrollmentUncertainCount?: number;
  incompleteNamesCount?: number;
  inactiveMembersCount?: number;
  toBeDeletedMembersCount?: number;
  onCollapse?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { effective } = useRoleOverride();
  const { isLocalAdmin, localRole } = useLocalAdmin();
  // profile.role が viewer でも、local_roles による地方ロールがあればローカル設定は使える
  const canUseLocalAdmin = effective.role !== "viewer" || effective.globalRole === "admin" || localRole != null;
  const canManageLocalUsers = isLocalAdmin || effective.globalRole === "admin";

  return (
    <aside className={`w-56 min-w-[14rem] shrink-0 border-r border-slate-200 bg-slate-50/80 flex flex-col ${className}`}>
      {onCollapse && (
        <div className="flex justify-end p-2 border-b border-slate-200 bg-white/80">
          <button
            type="button"
            onClick={onCollapse}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-400 touch-target"
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
          <p className={sectionTitleFirstClass} role="presentation">
            ローカル設定
          </p>
          {localAdminSidebarItems
            .filter((item) => {
              return canUseLocalAdmin || item.href === "/settings";
            })
            .map((item) => {
            const { href, label } = item;
            const active = isItemActive(href, pathname);
            const badgeCount =
              "badgeCount" in item && item.badgeCount === "incompleteNames"
                ? incompleteNamesCount
                : "badgeCount" in item && item.badgeCount === "inactiveMembers"
                  ? inactiveMembersCount
                  : "badgeCount" in item && item.badgeCount === "toBeDeletedMembers"
                    ? toBeDeletedMembersCount
                    : 0;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-lg touch-target min-w-0 ${
                  active ? "bg-primary-100 text-primary-800 font-medium" : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span className="min-w-0 break-words">{label}</span>
                {badgeCount > 0 && (
                  <span className="shrink-0 min-w-[1.25rem] px-1.5 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full text-center">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        {canManageLocalUsers && (
          <div className="space-y-0.5">
            <p className={sectionTitleClass} role="presentation">
              ローカル管理者
            </p>
            {localAdminOnlySidebarItems.map((item) => {
              const active = isItemActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2.5 text-sm rounded-lg touch-target min-w-0 ${
                    active ? "bg-primary-100 text-primary-800 font-medium" : "text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
        {showDebug && (
          <>
            {showRolesManagement && (
              <div className="space-y-0.5">
                <p className={sectionTitleClass} role="presentation">
                  グローバル管理
                </p>
                <Link
                  href={rolesSidebarItem.href}
                  className={`block px-3 py-2.5 text-sm rounded-lg touch-target min-w-0 ${
                    pathname.startsWith(rolesSidebarItem.href)
                      ? "bg-amber-100 text-amber-900 font-medium"
                      : "text-amber-800 hover:bg-amber-50 hover:bg-amber-100/70"
                  }`}
                >
                  {rolesSidebarItem.label}
                </Link>
              </div>
            )}
            <div className="space-y-0.5">
              <p className={sectionTitleClass} role="presentation">
                データベース整理
              </p>
              {databaseMaintenanceSidebarItems.map((item) => {
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
        </>
        )}
      </nav>
    </aside>
  );
}
