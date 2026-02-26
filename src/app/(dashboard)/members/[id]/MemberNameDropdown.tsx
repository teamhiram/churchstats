"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type MemberOption = { id: string; name: string };

type Props = {
  currentId: string;
  members: MemberOption[];
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function MemberNameDropdown({ currentId, members }: Props) {
  const router = useRouter();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberOption[]>([]);
  const [searching, setSearching] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (nextId && nextId !== currentId) {
      router.push(`/members/${nextId}`);
    }
  };

  const openSearch = () => setShowSearchModal(true);
  const closeSearch = useCallback(() => {
    setShowSearchModal(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  useEffect(() => {
    if (!showSearchModal) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const supabase = createClient();
    const req = supabase
      .from("members")
      .select("id, name")
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(20);
    Promise.resolve(req.then(({ data }) => setSearchResults((data ?? []) as MemberOption[])))
      .finally(() => setSearching(false));
  }, [showSearchModal, searchQuery]);

  useEffect(() => {
    if (!showSearchModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSearchModal, closeSearch]);

  const selectMember = (memberId: string) => {
    if (memberId !== currentId) {
      router.push(`/members/${memberId}`);
    }
    closeSearch();
  };

  return (
    <div className="flex items-stretch gap-2 min-w-0">
      <div className="min-w-0 flex-1">
        <label htmlFor="member-select" className="sr-only">
          メンバーを選択
        </label>
        <select
          id="member-select"
          value={currentId}
          onChange={handleChange}
          className="w-full px-3 py-2.5 text-lg font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 touch-target focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          aria-label="表示するメンバーを選択"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={openSearch}
        className="flex items-center justify-center w-11 shrink-0 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 touch-target focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        aria-label="名前で検索してメンバーを選ぶ"
        title="名前で検索"
      >
        <SearchIcon className="w-5 h-5" />
      </button>

      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3 pb-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="メンバー検索"
          onClick={(e) => e.target === e.currentTarget && closeSearch()}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-200">
              <label htmlFor="member-search-input" className="block text-sm font-medium text-slate-700 mb-1">
                名前で検索
              </label>
              <input
                id="member-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前の一部を入力"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg touch-target focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              {searching && (
                <p className="p-3 text-sm text-slate-500">検索中…</p>
              )}
              {!searching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="p-3 text-sm text-slate-500">該当するメンバーがいません</p>
              )}
              {!searching && searchResults.length > 0 && (
                <ul className="py-1">
                  {searchResults.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => selectMember(m.id)}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 touch-target ${m.id === currentId ? "bg-primary-50 text-primary-800 font-medium" : "text-slate-800"}`}
                      >
                        {m.name}
                        {m.id === currentId && (
                          <span className="ml-2 text-xs text-primary-600">（現在表示中）</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-2 border-t border-slate-200">
              <button
                type="button"
                onClick={closeSearch}
                className="w-full py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
