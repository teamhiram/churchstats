"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SettingsSidebar } from "@/components/SettingsSidebar";

function isInSettingsSection(pathname: string, showDebug: boolean) {
  if (pathname.startsWith("/settings")) return true;
  if (showDebug && (pathname.startsWith("/debug") || pathname.startsWith("/meetings/list/duplicates"))) return true;
  return false;
}

export function SettingsShell({
  children,
  showDebug = false,
  showRolesManagement = false,
}: {
  children: React.ReactNode;
  showDebug?: boolean;
  showRolesManagement?: boolean;
}) {
  const pathname = usePathname();
  const showSidebar = isInSettingsSection(pathname, showDebug);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!showSidebar) return <>{children}</>;

  return (
    <div className="flex min-h-0 flex-1 border border-slate-200 bg-white overflow-hidden -ml-4 -mr-4 -mb-[calc(1.875rem+env(safe-area-inset-bottom,0px))] md:-ml-6 md:-mr-6 md:-mb-6">
      {sidebarOpen && (
        <SettingsSidebar
          showDebug={showDebug}
          showRolesManagement={showRolesManagement}
          onCollapse={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 min-w-0 overflow-auto flex items-stretch">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 w-8 border-r border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 touch-target"
            aria-label="サイドバーを表示"
            title="サイドバーを表示"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
