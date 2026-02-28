"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { SettingsSidebar } from "@/components/SettingsSidebar";

const MOBILE_BREAKPOINT = 768;

function isInSettingsSection(pathname: string, showDebug: boolean) {
  if (pathname.startsWith("/settings")) return true;
  if (showDebug && (pathname.startsWith("/debug") || pathname.startsWith("/weekly/duplicates"))) return true;
  return false;
}

export function SettingsShell({
  children,
  showDebug = false,
  showRolesManagement = false,
  meetingDuplicateGroupCount = 0,
  duplicateAttendanceGroupCount = 0,
  enrollmentUncertainCount = 0,
}: {
  children: React.ReactNode;
  showDebug?: boolean;
  showRolesManagement?: boolean;
  meetingDuplicateGroupCount?: number;
  duplicateAttendanceGroupCount?: number;
  enrollmentUncertainCount?: number;
}) {
  const pathname = usePathname();
  const showSidebar = isInSettingsSection(pathname, showDebug);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handle = () => {
      const mobile = mql.matches;
      if (mobile) setSidebarOpen(false);
      setIsMobile(mobile);
    };
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  useEffect(() => {
    setSidebarOpen((open) => {
      if (!open) return open;
      if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) return false;
      return open;
    });
  }, [pathname]);

  if (!showSidebar) {
    return (
      <div className="flex-1 min-h-0 overflow-auto flex flex-col px-4 md:px-6">
        {children}
      </div>
    );
  }

  /* スマホ: サイドバーは出さずコンテンツのみ（サブメニューはNavのモーダルで表示） */
  if (isMobile) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm w-full min-w-0">
        <div className="flex-1 min-w-0 overflow-auto px-4 py-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm w-full min-w-0">
      {sidebarOpen && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="メニューを閉じる"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
          />
          <SettingsSidebar
            showDebug={showDebug}
            showRolesManagement={showRolesManagement}
            meetingDuplicateGroupCount={meetingDuplicateGroupCount}
            duplicateAttendanceGroupCount={duplicateAttendanceGroupCount}
            enrollmentUncertainCount={enrollmentUncertainCount}
            onCollapse={() => setSidebarOpen(false)}
            className="fixed left-0 top-0 bottom-0 z-50 w-56 min-w-[14rem] shadow-xl md:relative md:left-auto md:top-auto md:bottom-auto md:z-0 md:shadow-none"
          />
        </>
      )}
      <div className="flex-1 min-w-0 overflow-auto flex items-stretch">
        {!sidebarOpen && (
          <div className="shrink-0 w-10 md:w-12 flex flex-col border-r border-slate-200 bg-slate-50/80">
            <div className="flex justify-end p-2 border-b border-slate-200 bg-white/80">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 touch-target"
                aria-label="メニューを開く"
                title="メニュー"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-auto px-4 py-4 md:px-6 md:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
