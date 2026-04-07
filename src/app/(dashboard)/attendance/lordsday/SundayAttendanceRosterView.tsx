"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Toggle } from "@/components/Toggle";
import { PencilButton } from "@/components/PencilButton";
import { CATEGORY_LABELS } from "@/types/database";
import {
  GROUP_LABELS,
  type AttendanceChoice,
  type AttendanceRow,
  type GroupOption,
  type MemberRow,
  type Section,
} from "./sundayAttendanceTypes";

type Props = {
  roster: MemberRow[];
  sections: Section[];
  group1: GroupOption | "";
  group2: GroupOption | "";
  isEditMode: boolean;
  attendanceMap: Map<string, AttendanceRow>;
  memos: Map<string, string>;
  memberTierMap: Map<string, "regular" | "semi" | "pool">;
  guestIds: Set<string>;
  dirtyMemberIds: Set<string>;
  showOnlineColumn: boolean;
  showAwayColumn: boolean;
  tableColumnSpan: number;
  memoColumnSpan: number;
  isSectionOpen: (key: string) => boolean;
  toggleSectionOpen: (key: string) => void;
  setAttendanceChoice: (memberId: string, member: MemberRow, choice: AttendanceChoice) => void;
  toggleOnline: (memberId: string) => void;
  toggleIsAway: (memberId: string) => void;
  setMemos: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  saveMemo: (memberId: string) => void;
  setMemoPopupMemberId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function SundayAttendanceRosterView({
  roster,
  sections,
  group1,
  group2,
  isEditMode,
  attendanceMap,
  memos,
  memberTierMap,
  guestIds,
  dirtyMemberIds,
  showOnlineColumn,
  showAwayColumn,
  tableColumnSpan,
  memoColumnSpan,
  isSectionOpen,
  toggleSectionOpen,
  setAttendanceChoice,
  toggleOnline,
  toggleIsAway,
  setMemos,
  saveMemo,
  setMemoPopupMemberId,
}: Props) {
  return (
    <>
      <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {isEditMode && <th className="w-6 px-1 py-1.5" aria-label="変更" />}
              <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase max-w-[9rem]">名前</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase min-w-[3.75rem] w-14 sm:w-24 whitespace-nowrap">出欠({[...attendanceMap.values()].filter((r) => r.attended !== false).length})</th>
              {showOnlineColumn && (
                <th className="px-1 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-16 sm:w-24 whitespace-nowrap">
                  ｵﾝﾗｲﾝ({[...attendanceMap.values()].filter((r) => r.attended !== false && r.is_online).length})
                </th>
              )}
              {showAwayColumn && (
                <th className="px-1 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-[4.5rem] sm:w-24 whitespace-nowrap">
                  他地方({[...attendanceMap.values()].filter((r) => r.attended !== false && r.is_away).length})
                </th>
              )}
              <th className={`px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto ${!isEditMode ? "hidden sm:table-cell" : ""}`}><span className="hidden sm:inline">メモ</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {roster.length === 0 && (
              <tr>
                <td colSpan={tableColumnSpan} className="px-3 py-4 text-center text-slate-500 text-sm">
                  名簿がありません
                </td>
              </tr>
            )}
            {sections.map((section, idx) => {
              const hasGroup1 = Boolean(group1 && section.group1Key);
              const hasGroup2 = Boolean(group2);
              const g1Key = `g1-${section.group1Key}`;
              const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
              const sectionMemberIds = section.subsections.flatMap((s) => s.members.map((m) => m.id));
              const sectionAttendedCount = sectionMemberIds.filter((id) => {
                const row = attendanceMap.get(id);
                return row && row.attended !== false;
              }).length;
              const sectionAbsentCount = sectionMemberIds.filter((id) => {
                const row = attendanceMap.get(id);
                return row && row.attended === false;
              }).length;
              const sectionUnrecordedCount = sectionMemberIds.filter((id) => !attendanceMap.has(id)).length;
              const sectionDisplayCount =
                group1 === "attendance"
                  ? section.group1Key === "absent"
                    ? sectionAbsentCount
                    : section.group1Key === "unrecorded"
                      ? sectionUnrecordedCount
                      : sectionAttendedCount
                  : sectionAttendedCount;
              const sectionOnlineCount = sectionMemberIds.filter((id) => {
                const row = attendanceMap.get(id);
                return row && row.attended !== false && row.is_online;
              }).length;
              const sectionAwayCount = sectionMemberIds.filter((id) => {
                const row = attendanceMap.get(id);
                return row && row.attended !== false && row.is_away;
              }).length;
              return (
                <Fragment key={`s-${section.group1Key}-${idx}`}>
                  {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                    <tr className="bg-gray-800">
                      <td colSpan={tableColumnSpan} className="px-3 py-0">
                        <button
                          type="button"
                          onClick={() => toggleSectionOpen(g1Key)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-left text-sm font-medium text-white hover:bg-gray-700 touch-target"
                          aria-expanded={g1Open}
                        >
                          <span>{group1 ? `${GROUP_LABELS[group1]}：${section.group1Label || "—"}` : ""}</span>
                          <svg
                            className={`w-4 h-4 text-gray-300 transition-transform ${g1Open ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )}
                  {hasGroup1 && g1Open && section.subsections.some((s) => s.members.length > 0) && (
                    <tr className="bg-slate-50">
                      {isEditMode && <th className="w-6 px-1 py-1" aria-hidden />}
                      <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase max-w-[9rem]">名前</th>
                      <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase min-w-[3.75rem] w-14 sm:w-24 whitespace-nowrap">出欠({sectionDisplayCount})</th>
                      {showOnlineColumn && (
                        <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-16 sm:w-24 whitespace-nowrap">ｵﾝﾗｲﾝ({sectionOnlineCount})</th>
                      )}
                      {showAwayColumn && (
                        <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-[4.5rem] sm:w-24 whitespace-nowrap">他地方({sectionAwayCount})</th>
                      )}
                      <th className={`px-2 py-1 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto ${!isEditMode ? "hidden sm:table-cell" : ""}`}><span className="hidden sm:inline">メモ</span></th>
                    </tr>
                  )}
                  {(hasGroup1 ? g1Open : true) && section.subsections.map((sub, subIdx) => {
                    const hasSubHeader = hasGroup2 && sub.group2Key;
                    const g2Key = hasSubHeader ? `g1-${section.group1Key}::g2-${sub.group2Key}` : "";
                    const g2Open = g2Key ? isSectionOpen(g2Key) : true;
                    return (
                      <Fragment key={`sub-${section.group1Key}-${sub.group2Key}-${subIdx}`}>
                        {hasSubHeader && sub.members.length > 0 && (
                          <tr className="bg-gray-500">
                            <td colSpan={tableColumnSpan} className="px-3 py-0 pl-6">
                              <button
                                type="button"
                                onClick={() => toggleSectionOpen(g2Key)}
                                className="w-full flex items-center justify-between px-3 py-1 text-left text-sm font-medium text-white hover:bg-gray-400 touch-target"
                                aria-expanded={g2Open}
                              >
                                <span>{group2 ? `${GROUP_LABELS[group2]}：${sub.group2Label || "—"}` : ""}</span>
                                <svg
                                  className={`w-4 h-4 text-gray-300 transition-transform ${g2Open ? "rotate-180" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        )}
                        {hasSubHeader && g2Open && sub.members.length > 0 && (
                          <tr className="bg-slate-50">
                            {isEditMode && <th className="w-6 px-1 py-1 pl-6" aria-hidden />}
                            <th className="px-3 py-1 pl-6 text-left text-xs font-medium text-slate-500 uppercase max-w-[9rem]">名前</th>
                            <th className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase min-w-[3.75rem] w-14 sm:w-24 whitespace-nowrap">出欠({(() => {
                              const subAttended = sub.members.filter((m) => {
                                const row = attendanceMap.get(m.id);
                                return row && row.attended !== false;
                              }).length;
                              if (group1 !== "attendance") return subAttended;
                              if (section.group1Key === "absent") {
                                return sub.members.filter((m) => {
                                  const row = attendanceMap.get(m.id);
                                  return row && row.attended === false;
                                }).length;
                              }
                              if (section.group1Key === "unrecorded") {
                                return sub.members.filter((m) => !attendanceMap.has(m.id)).length;
                              }
                              return subAttended;
                            })()})</th>
                            {showOnlineColumn && (
                              <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-16 sm:w-24 whitespace-nowrap">ｵﾝﾗｲﾝ({sub.members.filter((m) => {
                                const row = attendanceMap.get(m.id);
                                return row && row.attended !== false && row.is_online;
                              }).length})</th>
                            )}
                            {showAwayColumn && (
                              <th className="px-1 py-1 text-left text-xs font-medium text-slate-500 uppercase w-[4.5rem] sm:w-24 whitespace-nowrap">他地方({sub.members.filter((m) => {
                                const row = attendanceMap.get(m.id);
                                return row && row.attended !== false && row.is_away;
                              }).length})</th>
                            )}
                            <th className={`px-2 py-1 text-left text-xs font-medium text-slate-500 uppercase w-10 sm:w-auto ${!isEditMode ? "hidden sm:table-cell" : ""}`}><span className="hidden sm:inline">メモ</span></th>
                          </tr>
                        )}
                        {(!hasSubHeader || g2Open) && sub.members.map((m) => {
                          const rec = attendanceMap.get(m.id);
                          const attended = Boolean(rec && rec.attended !== false);
                          const unrecorded = !rec;
                          const isOnline = rec?.is_online ?? false;
                          const isAway = rec?.is_away ?? false;
                          const memo = memos.get(m.id) ?? "";
                          const memoPlaceholder = isAway ? "出席した地方を記載してください" : "欠席理由など";
                          const tier = memberTierMap.get(m.id);
                          const rowBgClass = tier === "semi" ? "bg-amber-50 hover:bg-amber-100" : tier === "pool" ? "bg-sky-50 hover:bg-sky-100" : "hover:bg-slate-50";
                          return (
                            <Fragment key={m.id}>
                              <tr className={rowBgClass}>
                                {isEditMode && (
                                  <td className="px-1 py-0.5 text-red-600 text-center w-6" title={dirtyMemberIds.has(m.id) ? "変更あり" : undefined}>
                                    {dirtyMemberIds.has(m.id) ? "●" : ""}
                                  </td>
                                )}
                                <td className="px-3 py-0.5 text-slate-800 text-sm max-w-[9rem] min-w-0">
                                  <div className="flex items-center gap-1 min-w-0 truncate">
                                    {isEditMode ? (
                                      <span className={`min-w-0 truncate ${guestIds.has(m.id) ? "text-slate-400" : ""}`}>{m.name}</span>
                                    ) : (
                                      <Link href={`/members/${m.id}`} className={`min-w-0 truncate text-primary-600 hover:underline ${guestIds.has(m.id) ? "text-slate-400" : ""}`}>
                                        {m.name}
                                      </Link>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-0.5 text-left">
                                  {isEditMode ? (
                                    <div className="flex items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceChoice(m.id, m, "unrecorded")}
                                        className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium p-0 ${unrecorded ? "border-amber-400 bg-amber-100 text-slate-600 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-300"}`}
                                        aria-label={`${m.name}を記録なしに`}
                                        title="記録なし"
                                      >
                                        ー
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceChoice(m.id, m, "present")}
                                        className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium p-0 ${attended ? "border-primary-400 bg-primary-100 text-primary-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-primary-50 hover:border-primary-400"}`}
                                        aria-label={`${m.name}を出席に`}
                                        title="出席"
                                      >
                                        ○
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceChoice(m.id, m, "absent")}
                                        className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium p-0 ${!attended && !unrecorded ? "border-amber-400 bg-amber-100 text-amber-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-400"}`}
                                        aria-label={`${m.name}を欠席に`}
                                        title="欠席"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ) : (
                                    <span className={attended ? "text-primary-600" : unrecorded ? "text-slate-400" : "text-slate-400"}>{attended ? "○" : unrecorded ? "ー" : "×"}</span>
                                  )}
                                </td>
                                {showOnlineColumn && (
                                  <td className="px-1 py-0.5 align-middle text-left">
                                    {attended ? (
                                      isEditMode ? (
                                        <Toggle
                                          checked={isOnline}
                                          onChange={() => toggleOnline(m.id)}
                                          ariaLabel={`${m.name}のオンライン`}
                                        />
                                      ) : (
                                        <span className={isOnline ? "text-primary-600" : "text-slate-400"}>{isOnline ? "○" : "—"}</span>
                                      )
                                    ) : isEditMode ? (
                                      <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}のオンライン`} />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                )}
                                {showAwayColumn && (
                                  <td className="px-1 py-0.5 align-middle text-left">
                                    {attended ? (
                                      isEditMode ? (
                                        <Toggle
                                          checked={isAway}
                                          onChange={() => toggleIsAway(m.id)}
                                          ariaLabel={`${m.name}の他地方`}
                                        />
                                      ) : (
                                        <span className={isAway ? "text-amber-600" : "text-slate-400"}>{isAway ? "○" : "—"}</span>
                                      )
                                    ) : isEditMode ? (
                                      <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}の他地方`} />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                )}
                                <td className={`px-2 py-0.5 align-top ${!isEditMode ? "hidden sm:table-cell" : ""}`}>
                                  {isEditMode ? (
                                    <>
                                      <div className="sm:hidden">
                                        <PencilButton
                                          aria-label="メモを編集"
                                          onClick={() => setMemoPopupMemberId(m.id)}
                                        />
                                      </div>
                                      <div className="hidden sm:block">
                                        <input
                                          type="text"
                                          value={memo}
                                          onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                                          onBlur={() => saveMemo(m.id)}
                                          placeholder={memoPlaceholder}
                                          className={`w-full max-w-xs px-2 py-0.5 text-sm border rounded touch-target ${
                                            isAway ? "border-amber-400" : "border-slate-300"
                                          }`}
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-600 text-sm">{memo || "—"}</span>
                                  )}
                                </td>
                              </tr>
                              {memo.trim() && (
                                <tr className="sm:hidden [border-top:0]">
                                  <td colSpan={memoColumnSpan} className="pl-4 pr-3 py-0.5 pb-1 text-xs text-slate-500 [border-top:0]">
                                    {memo}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="block sm:hidden border border-slate-200 rounded-lg overflow-hidden bg-white">
        {roster.length === 0 ? (
          <p className="px-3 py-4 text-center text-slate-500 text-sm">名簿がありません</p>
        ) : (
          <div>
            {!group1 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex-nowrap min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase min-w-0 truncate max-w-[50%]">名前</span>
                <div className="flex items-center gap-1.5 ml-auto flex-shrink-0 text-xs font-medium text-slate-500 uppercase">
                  <span>出欠</span>
                  {showOnlineColumn && <span>ｵﾝﾗｲﾝ</span>}
                  {showAwayColumn && <span>他地方</span>}
                  <span>メモ</span>
                </div>
              </div>
            )}
            {sections.map((section, idx) => {
              const hasGroup1 = Boolean(group1 && section.group1Key);
              const hasGroup2 = Boolean(group2);
              const g1Key = `g1-${section.group1Key}`;
              const g1Open = hasGroup1 ? isSectionOpen(g1Key) : true;
              return (
                <Fragment key={`card-s-${section.group1Key}-${idx}`}>
                  {hasGroup1 && section.subsections.some((s) => s.members.length > 0) && (
                    <div className="bg-gray-800">
                      <button
                        type="button"
                        onClick={() => toggleSectionOpen(g1Key)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-left text-sm font-medium text-white hover:bg-gray-700 touch-target"
                        aria-expanded={g1Open}
                      >
                        <span>{group1 ? `${GROUP_LABELS[group1]}：${section.group1Label || "—"}` : ""}</span>
                        <svg
                          className={`w-4 h-4 text-gray-300 transition-transform ${g1Open ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {hasGroup1 && g1Open && section.subsections.some((s) => s.members.length > 0) && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex-nowrap min-w-0">
                      <span className="text-xs font-medium text-slate-500 uppercase min-w-0 truncate max-w-[50%]">名前</span>
                      <div className="flex items-center gap-1.5 ml-auto flex-shrink-0 text-xs font-medium text-slate-500 uppercase">
                        <span>出欠</span>
                        {showOnlineColumn && <span>ｵﾝﾗｲﾝ</span>}
                        {showAwayColumn && <span>他地方</span>}
                        <span>メモ</span>
                      </div>
                    </div>
                  )}
                  {(hasGroup1 ? g1Open : true) &&
                    section.subsections.map((sub, subIdx) => {
                      const hasSubHeader = hasGroup2 && sub.group2Key;
                      const g2Key = hasSubHeader ? `g1-${section.group1Key}::g2-${sub.group2Key}` : "";
                      const g2Open = g2Key ? isSectionOpen(g2Key) : true;
                      return (
                        <Fragment key={`card-sub-${section.group1Key}-${sub.group2Key}-${subIdx}`}>
                          {hasSubHeader && sub.members.length > 0 && (
                            <div className="bg-gray-500">
                              <button
                                type="button"
                                onClick={() => toggleSectionOpen(g2Key)}
                                className="w-full flex items-center justify-between px-3 py-1 pl-6 text-left text-sm font-medium text-white hover:bg-gray-400 touch-target"
                                aria-expanded={g2Open}
                              >
                                <span>{group2 ? `${GROUP_LABELS[group2]}：${sub.group2Label || "—"}` : ""}</span>
                                <svg
                                  className={`w-4 h-4 text-gray-300 transition-transform ${g2Open ? "rotate-180" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          )}
                          {(!hasSubHeader || g2Open) &&
                            sub.members.map((m) => {
                              const rec = attendanceMap.get(m.id);
                              const attended = Boolean(rec && rec.attended !== false);
                              const unrecorded = !rec;
                              const isOnline = rec?.is_online ?? false;
                              const isAway = rec?.is_away ?? false;
                              const memo = memos.get(m.id) ?? "";
                              const tier = memberTierMap.get(m.id);
                              const cardBgClass =
                                tier === "semi" ? "bg-amber-50" : tier === "pool" ? "bg-sky-50" : "bg-white";
                              return (
                                <div
                                  key={m.id}
                                  className={`border-b border-slate-200 last:border-b-0 ${cardBgClass}`}
                                >
                                  <div className="flex items-center gap-1.5 px-3 py-2 flex-nowrap min-w-0">
                                    {isEditMode && dirtyMemberIds.has(m.id) && (
                                      <span className="text-red-600 flex-shrink-0" title="変更あり">●</span>
                                    )}
                                    <span
                                      className={`min-w-0 truncate text-slate-800 text-sm text-left flex-shrink max-w-[50%] ${guestIds.has(m.id) ? "text-slate-400" : ""}`}
                                    >
                                      {isEditMode ? (
                                        m.name
                                      ) : (
                                        <Link
                                          href={`/members/${m.id}`}
                                          className="text-primary-600 hover:underline truncate block"
                                        >
                                          {m.name}
                                        </Link>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                                      {isEditMode ? (
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => setAttendanceChoice(m.id, m, "unrecorded")}
                                            className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-medium p-0 ${unrecorded ? "border-amber-400 bg-amber-100 text-slate-600 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-300"}`}
                                            aria-label={`${m.name}を記録なしに`}
                                          >
                                            ー
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAttendanceChoice(m.id, m, "present")}
                                            className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-medium p-0 ${attended ? "border-primary-400 bg-primary-100 text-primary-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-primary-50 hover:border-primary-400"}`}
                                            aria-label={`${m.name}を出席に`}
                                          >
                                            ○
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAttendanceChoice(m.id, m, "absent")}
                                            className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-medium p-0 ${!attended && !unrecorded ? "border-amber-400 bg-amber-100 text-amber-700 cursor-default" : "border-slate-300 bg-white text-slate-500 hover:bg-amber-50 hover:border-amber-400"}`}
                                            aria-label={`${m.name}を欠席に`}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ) : (
                                        <span
                                          className={`flex-shrink-0 ${attended ? "text-primary-600" : unrecorded ? "text-slate-400" : "text-slate-400"}`}
                                        >
                                          {attended ? "○" : unrecorded ? "ー" : "×"}
                                        </span>
                                      )}
                                      {showOnlineColumn &&
                                        (attended ? (
                                          isEditMode ? (
                                            <Toggle
                                              checked={isOnline}
                                              onChange={() => toggleOnline(m.id)}
                                              ariaLabel={`${m.name}のオンライン`}
                                            />
                                          ) : (
                                            <span className="text-slate-400 flex-shrink-0">{isOnline ? "○" : "—"}</span>
                                          )
                                        ) : isEditMode ? (
                                          <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}のオンライン`} />
                                        ) : (
                                          <span className="text-slate-300 flex-shrink-0">—</span>
                                        ))}
                                      {showAwayColumn &&
                                        (attended ? (
                                          isEditMode ? (
                                            <Toggle
                                              checked={isAway}
                                              onChange={() => toggleIsAway(m.id)}
                                              ariaLabel={`${m.name}の他地方`}
                                            />
                                          ) : (
                                            <span className="text-slate-400 flex-shrink-0">{isAway ? "○" : "—"}</span>
                                          )
                                        ) : isEditMode ? (
                                          <Toggle checked={false} onChange={() => {}} disabled ariaLabel={`${m.name}の他地方`} />
                                        ) : (
                                          <span className="text-slate-300 flex-shrink-0">—</span>
                                        ))}
                                      {isEditMode && (
                                        <PencilButton
                                          variant="iconOnly"
                                          aria-label={`${m.name}のメモを編集`}
                                          onClick={() => setMemoPopupMemberId(m.id)}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  {memo.trim() && (
                                    <div className="px-3 pl-4 pr-3 py-0.5 pb-2 text-xs text-slate-600 break-words">
                                      {memo}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

