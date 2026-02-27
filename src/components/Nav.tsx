"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import { useLocality } from "@/contexts/LocalityContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryClient";
import type { MembersApiResponse } from "@/app/api/members/route";

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
  { href: "/debug/meetings-list", label: "集会一覧" },
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

/** 検索用: カタカナをひらがなに統一し、ひらがな・カタカナ両方でヒットするようにする */
function normalizeKanaForSearch(s: string): string {
  return s.replace(/[\u30A0-\u30FF]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String.fromCharCode(code - 0x60);
  });
}

/** 検索用虫眼鏡アイコン（24x24 viewBox） */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const localityPopupRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const mobileSearchModalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const prevLocalityPopupOpen = useRef(false);

  const router = useRouter();

  const { data: membersData } = useQuery({
    queryKey: [...QUERY_KEYS.members, "nav-search", currentLocalityId ?? ""],
    queryFn: async (): Promise<MembersApiResponse> => {
      const url =
        currentLocalityId != null && currentLocalityId !== ""
          ? `/api/members?locality=${encodeURIComponent(currentLocalityId)}`
          : "/api/members";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: searchOpen || mobileSearchOpen,
    staleTime: 60 * 1000,
  });

  const searchResults = useMemo(() => {
    const members = membersData?.members ?? [];
    const raw = searchQuery.trim();
    if (!raw) return [];
    const q = raw.toLowerCase();
    const qNorm = normalizeKanaForSearch(q);
    return members
      .filter((m) => {
        const nameNorm = normalizeKanaForSearch(m.name.toLowerCase());
        const furiganaNorm = m.furigana
          ? normalizeKanaForSearch(m.furigana.toLowerCase())
          : "";
        return nameNorm.includes(qNorm) || furiganaNorm.includes(qNorm);
      })
      .slice(0, 20);
  }, [membersData?.members, searchQuery]);

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
    if (localityPopupOpen || settingsModalOpen || mobileSearchOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [localityPopupOpen, settingsModalOpen, mobileSearchOpen]);

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

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (mobileSearchOpen) {
      mobileSearchInputRef.current?.focus();
    }
  }, [mobileSearchOpen]);

  return (
    <>
      {/* モバイル: 薄い固定ヘッダー（アプリ名＋バージョン＋地方選択） */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-8 bg-slate-800 flex items-center justify-between px-3">
        <div className="flex items-center min-w-0">
          <Link href="/" className="flex items-center text-white text-sm font-medium hover:text-white/90">
            召会生活統計
          </Link>
          <span className="ml-1.5 inline-flex items-baseline shrink-0">
            <span className="relative -top-0.5 text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-primary-600 text-white">0.20.1</span>
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
      <header
        ref={headerRef}
        className="hidden md:block fixed top-0 left-0 right-0 z-40 h-12 bg-slate-800"
      >
        <div className={`h-full grid grid-cols-[auto_1fr_auto] items-center gap-0 px-4 ${contentWidthClass(fullWidth)}`}>
          {/* 左: アプリ名・バージョン・地方 */}
          <div className="flex items-center h-full shrink-0 mr-2 gap-2 min-w-0">
            <Link href="/" className="text-white text-sm font-semibold whitespace-nowrap hover:text-white/90">
              召会生活統計
            </Link>
            <span className="ml-1.5 text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-primary-600 text-white relative -top-0.5">0.20.1</span>
            {showLocalitySwitcher && !searchOpen && (
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

          {/* 中央: 検索時はフィールドが左からここまで広がる / 通常時はナビを右詰め */}
          <div className="min-w-0 flex items-center justify-end h-full">
            {searchOpen ? (
              <div className="w-full flex flex-col h-full justify-center relative max-w-full">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                  placeholder="メンバーを検索…"
                  className="w-full h-8 pl-3 pr-9 py-1.5 rounded-md border border-slate-600 bg-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-label="メンバー検索"
                  aria-expanded={searchResults.length > 0}
                  aria-autocomplete="list"
                />
                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 py-1 rounded-md border border-slate-600 bg-slate-800 shadow-lg max-h-72 overflow-y-auto z-50">
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          router.push(`/members/${m.id}`);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none flex flex-col"
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.furigana && (
                          <span className="text-xs text-slate-400">{m.furigana}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
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
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center justify-center h-full px-4 text-slate-300 hover:bg-slate-700 touch-target border-r border-slate-600/50"
                  aria-label="メンバーを検索"
                >
                  <SearchIcon className="w-5 h-5" />
                </button>
              </nav>
            )}
          </div>

          {/* 右端固定: アカウントボタン（常に同じ位置） */}
          <Link
            href="/settings/account"
            aria-label="アカウント詳細"
            className={`flex items-center justify-center h-full px-4 touch-target shrink-0 border-l border-slate-600/50 ${
              pathname.startsWith("/settings/account")
                ? "bg-primary-600 text-white"
                : "text-slate-300 hover:bg-slate-700"
            }`}
          >
            <PersonIcon className="w-5 h-5" />
          </Link>
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
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            className="shrink-0 w-12 h-full flex items-center justify-center min-h-0 text-slate-300 active:bg-slate-700"
            aria-label="メンバーを検索"
            aria-expanded={mobileSearchOpen}
          >
            <SearchIcon className="w-5 h-5" />
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
      {/* モバイル: メンバー検索ポップアップ */}
      {mobileSearchOpen && (
        <div
          className="md:hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="メンバーを検索"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMobileSearchOpen(false);
              setSearchQuery("");
            }
          }}
        >
          <div
            ref={mobileSearchModalRef}
            className="w-full max-w-sm flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 shrink-0">
              <h2 className="text-sm font-semibold text-slate-800">メンバーを検索</h2>
              <button
                type="button"
                onClick={() => {
                  setMobileSearchOpen(false);
                  setSearchQuery("");
                }}
                className="rounded-full p-2 -m-1 text-slate-500 hover:bg-slate-100 active:bg-slate-200 touch-target"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-3 pt-2 pb-3 shrink-0">
              <div className="relative">
                <input
                  ref={mobileSearchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setMobileSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                  placeholder="名前・ふりがなで検索…"
                  className="w-full h-10 pl-3 pr-9 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-label="メンバー検索"
                />
                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="h-[220px] min-h-0 overflow-y-auto overscroll-contain border-t border-slate-100">
              {searchResults.length > 0 ? (
                <ul className="py-1">
                  {searchResults.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          router.push(`/members/${m.id}`);
                          setMobileSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-3 py-2.5 min-h-[44px] flex flex-col justify-center text-slate-800 active:bg-slate-100 touch-target border-b border-slate-50 last:border-b-0 text-sm"
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.furigana && (
                          <span className="text-xs text-slate-500">{m.furigana}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim() ? (
                <p className="px-3 py-4 text-sm text-slate-500 text-center">該当するメンバーがいません</p>
              ) : (
                <p className="px-3 py-4 text-sm text-slate-500 text-center">名前またはふりがなを入力</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
