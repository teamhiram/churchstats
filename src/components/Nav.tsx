"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import { useLocality } from "@/contexts/LocalityContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const baseLinks: { href: string; label: string }[] = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/meetings/list", label: "週別集計" },
  { href: "/meetings", label: "出欠登録" },
  { href: "/members", label: "名簿管理" },
];

/** モバイルフッター用: 速報｜週別｜出欠｜名簿｜設定 */
const footerMainItems = [
  { href: "/dashboard", label: "速報" },
  { href: "/meetings/list", label: "週別" },
  { href: "/meetings", label: "出欠" },
  { href: "/members", label: "名簿" },
] as const;

const settingsModalItems = [
  { href: "/settings/organization", label: "枠組設定" },
  { href: "/settings", label: "システム設定" },
] as const;
const settingsModalRolesItem = { href: "/settings/roles", label: "ユーザ・ロール管理" } as const;
const settingsModalDebugItems = [
  { href: "/debug/numbers", label: "各種数値" },
  { href: "/debug/tables", label: "全テーブル" },
  { href: "/debug/enrollment-uncertain", label: "在籍期間不確定" },
  { href: "/debug/meeting-duplicates", label: "集会重複検知" },
  { href: "/meetings/list/duplicates", label: "重複出席" },
] as const;

type NavProps = {
  displayName?: string | null;
  roleLabel?: string;
  localityName?: string | null;
  showDebug?: boolean;
  /** グローバル管理者のとき true（設定モーダルでユーザ・ロール管理を表示） */
  showRolesManagement?: boolean;
};

/** 設定画面（サイドバー付き）のパスか */
function isSettingsSectionPath(pathname: string, showDebug: boolean) {
  if (pathname.startsWith("/settings")) return true;
  if (showDebug && (pathname.startsWith("/debug") || pathname.startsWith("/meetings/list/duplicates"))) return true;
  return false;
}

const contentWidthClass = (fullWidth: boolean) =>
  fullWidth ? "w-full" : "w-full max-w-7xl mx-auto";

/** アカウント詳細用の人物アイコン（24x24 viewBox） */
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export function Nav({ displayName, roleLabel, localityName: _localityName, showDebug = false, showRolesManagement = false }: NavProps) {
  const pathname = usePathname();
  const { fullWidth } = useDisplaySettings();
  const { currentLocalityName, currentLocalityId, localitiesByArea, setCurrentLocalityId } = useLocality();
  const showLocalitySwitcher =
    localitiesByArea.some((s) => s.prefectures.some((p) => p.localities.length > 0)) &&
    localitiesByArea.flatMap((s) => s.prefectures).flatMap((p) => p.localities).length > 1;
  /** その他タブを隠した表示用セクション */
  const visibleSections = localitiesByArea.filter((s) => s.areaName !== "その他");
  const [localityPopupOpen, setLocalityPopupOpen] = useState(false);
  const [localityPopupAreaIndex, setLocalityPopupAreaIndex] = useState(0);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const localityPopupRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const prevLocalityPopupOpen = useRef(false);

  useEffect(() => {
    if (!localityPopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (localityPopupRef.current && !localityPopupRef.current.contains(e.target as Node)) {
        setLocalityPopupOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [localityPopupOpen]);

  useEffect(() => {
    if (!settingsModalOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsModalRef.current && !settingsModalRef.current.contains(e.target as Node)) {
        setSettingsModalOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [settingsModalOpen]);

  useEffect(() => {
    if (localityPopupOpen || settingsModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [localityPopupOpen, settingsModalOpen]);

  useEffect(() => {
    const justOpened = localityPopupOpen && !prevLocalityPopupOpen.current;
    prevLocalityPopupOpen.current = localityPopupOpen;
    if (justOpened && currentLocalityId && visibleSections.length > 0) {
      const idx = visibleSections.findIndex((s) =>
        s.prefectures.some((p) => p.localities.some((l) => l.id === currentLocalityId))
      );
      if (idx >= 0) setLocalityPopupAreaIndex(idx);
      else setLocalityPopupAreaIndex(0);
    }
  }, [localityPopupOpen, currentLocalityId, visibleSections]);

  return (
    <>
      {/* モバイル: 薄い固定ヘッダー（アプリ名＋バージョン＋地方選択） */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-8 bg-slate-800 flex items-center justify-between px-3">
        <div className="flex items-center min-w-0">
          <span className="text-white text-sm font-medium">召会生活統計</span>
          <span className="ml-1.5 inline-flex items-baseline shrink-0">
            <span className="relative -top-0.5 text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-primary-600 text-white">0.20</span>
          </span>
        </div>
        {showLocalitySwitcher && (
          <button
            type="button"
            onClick={() => setLocalityPopupOpen(true)}
            className="flex items-center gap-0.5 px-2 py-1 rounded text-slate-300 hover:bg-slate-700 active:bg-slate-600 text-xs max-w-[50%] min-w-0 shrink-0 touch-target"
            aria-expanded={localityPopupOpen}
            aria-haspopup="dialog"
            aria-label="地方を切り替え"
          >
            <span className="truncate">{currentLocalityName ?? "地方"}</span>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </header>

      {/* PC: トップ固定ナビゲーション */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-40 h-12 bg-slate-800">
        <div className={`h-full flex items-center justify-between px-4 ${contentWidthClass(fullWidth)}`}>
          <div className="flex items-center h-full shrink-0 mr-2 gap-2">
            <span className="text-white text-sm font-semibold whitespace-nowrap">召会生活統計</span>
            <span className="ml-1.5 text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-primary-600 text-white relative -top-0.5">0.20</span>
            {showLocalitySwitcher && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLocalityPopupOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-slate-300 hover:bg-slate-700 text-xs"
                  aria-expanded={localityPopupOpen}
                  aria-haspopup="dialog"
                  aria-label="地方を切り替え"
                >
                  <span className="max-w-[8rem] truncate">{currentLocalityName ?? "地方"}</span>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <nav className="flex h-full overflow-x-auto">
            {baseLinks.map((item) => {
              const { href, label } = item;
              const isActive =
                pathname === href ||
                (href === "/meetings" &&
                  pathname.startsWith("/meetings") &&
                  !pathname.startsWith("/meetings/list"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center h-full px-4 text-sm font-medium whitespace-nowrap touch-target border-r border-slate-600/50 ${
                    isActive ? "bg-primary-600 text-white" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/settings"
              className={`flex items-center h-full px-4 text-sm font-medium whitespace-nowrap touch-target border-r border-slate-600/50 ${
                isSettingsSectionPath(pathname, !!showDebug) && !pathname.startsWith("/settings/account")
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              設定
            </Link>
            <Link
              href="/settings/account"
              aria-label="アカウント詳細"
              className={`flex items-center justify-center h-full px-4 touch-target ${
                pathname.startsWith("/settings/account")
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              <PersonIcon className="w-5 h-5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* 地方選択ポップアップ（モバイル・PC共通） */}
      {localityPopupOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="地方を選択"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLocalityPopupOpen(false);
          }}
        >
          <div
            ref={localityPopupRef}
            className="relative z-[101] w-full max-w-md max-h-[80vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shrink-0">
              <h2 className="text-sm font-semibold text-slate-800">地方を選択</h2>
              <button
                type="button"
                onClick={() => setLocalityPopupOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 touch-target"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 地域タブ */}
            <div className="flex border-b border-slate-200 overflow-x-auto shrink-0" role="tablist" aria-label="地域">
              {visibleSections.map((section, idx) => (
                <button
                  key={section.areaId ?? `other-${idx}`}
                  type="button"
                  role="tab"
                  aria-selected={localityPopupAreaIndex === idx}
                  aria-controls={`locality-panel-${idx}`}
                  id={`locality-tab-${idx}`}
                  onClick={() => setLocalityPopupAreaIndex(idx)}
                  onPointerDown={() => setLocalityPopupAreaIndex(idx)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap touch-target border-b-2 -mb-px transition-colors cursor-pointer ${
                    localityPopupAreaIndex === idx
                      ? "border-primary-500 text-primary-600 bg-slate-50"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {section.areaName}
                </button>
              ))}
            </div>
            {/* 都道府県は小ラベル、地方は横並びボタン（選択中タブ内） */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 bg-white">
              {visibleSections.map((section, sectionIdx) => (
                <div
                  key={section.areaId ?? `other-${sectionIdx}`}
                  id={`locality-panel-${sectionIdx}`}
                  role="tabpanel"
                  aria-labelledby={`locality-tab-${sectionIdx}`}
                  hidden={localityPopupAreaIndex !== sectionIdx}
                  className={localityPopupAreaIndex === sectionIdx ? "px-4 space-y-4" : "hidden"}
                >
                  {section.prefectures.map((pref) => (
                    <div key={pref.prefectureId ?? `other-${pref.prefectureName}`}>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {pref.prefectureName}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {pref.localities.map((loc) => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => {
                              setCurrentLocalityId(loc.id);
                              setLocalityPopupOpen(false);
                            }}
                            className={`inline-flex items-center rounded-lg px-3 py-2 text-sm touch-target transition-colors ${
                              loc.id === currentLocalityId
                                ? "bg-primary-600 text-white font-medium"
                                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                            }`}
                            role="menuitemradio"
                            aria-checked={loc.id === currentLocalityId}
                          >
                            {loc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* モバイル: 固定フッター（速報｜週別｜出欠｜名簿｜設定｜アカウント） */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-800 pb-[env(safe-area-inset-bottom)]">
        <nav className={`flex h-[1.875rem] items-stretch ${contentWidthClass(fullWidth)}`} aria-label="メインメニュー">
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
                  isActive ? "text-white bg-primary-600" : "text-slate-300 active:bg-slate-700"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className={`flex-1 h-full flex items-center justify-center text-sm font-medium min-h-0 ${
              isSettingsSectionPath(pathname, !!showDebug) && !pathname.startsWith("/settings/account")
                ? "text-white bg-primary-600"
                : "text-slate-300 active:bg-slate-700"
            }`}
            aria-label="設定"
            aria-expanded={settingsModalOpen}
          >
            設定
          </button>
          <Link
            href="/settings/account"
            aria-label="アカウント詳細"
            className={`shrink-0 w-12 h-full flex items-center justify-center min-h-0 ${
              pathname.startsWith("/settings/account")
                ? "text-white bg-primary-600"
                : "text-slate-300 active:bg-slate-700"
            }`}
          >
            <PersonIcon className="w-5 h-5" />
          </Link>
        </nav>
      </footer>
      {settingsModalOpen && (
        <div
          className="md:hidden fixed inset-0 z-[100] flex items-end justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="設定メニュー"
          onClick={() => setSettingsModalOpen(false)}
        >
          <div
            ref={settingsModalRef}
            className="w-full max-h-[60vh] overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-xl flex flex-col mb-[calc(1.875rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur px-3 py-2 shrink-0">
              <h2 className="text-xs font-semibold text-slate-800">設定</h2>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="rounded-full p-2 -m-1 text-slate-500 hover:bg-slate-100 active:bg-slate-200 touch-target"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="overflow-y-auto overscroll-contain flex-1 min-h-0" aria-label="設定サブメニュー">
              <ul className="py-1">
                {settingsModalItems.map(({ href, label }) => {
                  const active = isSettingsSectionPath(pathname, !!showDebug) && pathname.startsWith(href) && (href !== "/settings" || pathname === "/settings");
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setSettingsModalOpen(false)}
                        className={`block px-4 py-2.5 text-[15px] min-h-[44px] flex items-center ${
                          active ? "bg-primary-50 text-primary-800 font-medium" : "text-slate-800 active:bg-slate-100"
                        }`}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
                {showRolesManagement && (
                  <li>
                    <Link
                      href={settingsModalRolesItem.href}
                      onClick={() => setSettingsModalOpen(false)}
                      className={`block px-4 py-2.5 text-[15px] min-h-[44px] flex items-center ${
                        pathname.startsWith(settingsModalRolesItem.href)
                          ? "bg-primary-50 text-primary-800 font-medium"
                          : "text-slate-800 active:bg-slate-100"
                      }`}
                    >
                      {settingsModalRolesItem.label}
                    </Link>
                  </li>
                )}
              </ul>
              {showDebug && (
                <div className="border-t border-slate-200 mt-1 pt-1">
                  <p className="px-4 py-1.5 text-[11px] font-semibold text-amber-700 uppercase tracking-wider" role="presentation">
                    デバッグ
                  </p>
                  <ul className="py-1">
                    {settingsModalDebugItems.map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => setSettingsModalOpen(false)}
                          className={`block px-4 py-2.5 text-[15px] min-h-[44px] flex items-center ${
                            pathname.startsWith(href)
                              ? "bg-amber-50 text-amber-900 font-medium"
                              : "text-amber-800 active:bg-amber-50"
                          }`}
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
