"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";
import { DISPATCH_TYPE_LABELS, DISPATCH_TYPE_TEXT_COLORS } from "@/types/database";
import type { DispatchType } from "@/types/database";
import { getDaysInWeek, getThisWeekByLastSunday, formatDateYmd } from "@/lib/weekUtils";

const DISPATCH_OPTIONS: { value: "" | DispatchType; label: string }[] = [
  { value: "", label: "選択" },
  { value: "message", label: DISPATCH_TYPE_LABELS.message },
  { value: "phone", label: DISPATCH_TYPE_LABELS.phone },
  { value: "in_person", label: DISPATCH_TYPE_LABELS.in_person },
];

type DispatchRecord = {
  id: string;
  group_id: string;
  week_start: string;
  dispatch_type: DispatchType | null;
  dispatch_date: string | null;
  dispatch_memo: string | null;
  visitor_ids?: string[] | null;
};

type Props = {
  memberId: string;
  memberName: string;
  /** 保存時に使用する小組（メンバー登録小組。未登録時は groups の先頭を使用） */
  defaultGroupId: string | null;
  dispatchRecords: DispatchRecord[];
  dispatchGroupMap: Map<string, string>;
  visitorIdToName: Map<string, string>;
  groups: { id: string; name: string }[];
  /** 訪問者選択用。本人は除外して表示 */
  allMembers: { id: string; name: string }[];
  weekOptions: { value: string; label: string }[];
  sortedWeekStarts: string[];
  recordsByWeek: Map<string, DispatchRecord[]>;
  weekStartToNumber: Map<string, number>;
};

export function MemberDispatchSection({
  memberId,
  memberName,
  defaultGroupId,
  dispatchRecords,
  dispatchGroupMap,
  visitorIdToName,
  groups,
  allMembers,
  weekOptions,
  sortedWeekStarts,
  recordsByWeek,
  weekStartToNumber,
}: Props) {
  const router = useRouter();
  const [popupOpen, setPopupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    week_start: "",
    dispatch_type: "" as "" | DispatchType,
    visitor_ids: [] as string[],
    dispatch_date: "",
    dispatch_memo: "",
  });
  const [visitorSearchQuery, setVisitorSearchQuery] = useState("");
  const [visitorSearchResults, setVisitorSearchResults] = useState<{ id: string; name: string; furigana: string | null }[]>([]);
  const [visitorNameMap, setVisitorNameMap] = useState<Map<string, string>>(new Map());

  const currentWeekDays = form.week_start ? getDaysInWeek(form.week_start) : [];

  useEffect(() => {
    if (!popupOpen || !visitorSearchQuery.trim()) {
      setVisitorSearchResults([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("members")
      .select("id, name, furigana")
      .ilike("name", `%${visitorSearchQuery.trim()}%`)
      .limit(15)
      .then(({ data }) => {
        setVisitorSearchResults((data ?? []) as { id: string; name: string; furigana: string | null }[]);
      });
  }, [popupOpen, visitorSearchQuery]);

  const openPopup = () => {
    // 今日に一番近い週をデフォルトに
    const { weekStart: thisWeekStart } = getThisWeekByLastSunday();
    const thisWeekIso = formatDateYmd(thisWeekStart);
    const exactMatch = weekOptions.find((o) => o.value === thisWeekIso);
    const defaultWeek =
      exactMatch?.value ??
      weekOptions.find((o) => o.value >= thisWeekIso)?.value ??
      weekOptions[weekOptions.length - 1]?.value ??
      "";

    // その週のなかで今日の日付があれば派遣日デフォルトに、なければ週の日曜
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const daysInDefaultWeek = defaultWeek ? getDaysInWeek(defaultWeek) : [];
    const todayInWeek = daysInDefaultWeek.some((d) => d.value === todayIso);
    const defaultDispatchDate = defaultWeek && todayInWeek ? todayIso : defaultWeek;

    setForm({
      week_start: defaultWeek,
      dispatch_type: "",
      visitor_ids: [],
      dispatch_date: defaultDispatchDate,
      dispatch_memo: "",
    });
    setVisitorSearchQuery("");
    setVisitorSearchResults([]);
    setError(null);
    setPopupOpen(true);
  };

  const closePopup = () => {
    setPopupOpen(false);
    setVisitorSearchQuery("");
    setVisitorSearchResults([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { week_start, dispatch_type, dispatch_date, dispatch_memo, visitor_ids } = form;
    const group_id = defaultGroupId ?? groups[0]?.id ?? "";
    if (!week_start || !dispatch_type || !dispatch_date?.trim() || !dispatch_memo?.trim()) {
      setError("週・派遣種類・派遣日・メモをすべて入力してください。");
      return;
    }
    if (!group_id) {
      setError("小組が取得できません。メンバーに小組を登録するか、枠組設定で小組を追加してください。");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("organic_dispatch_records").insert({
      member_id: memberId,
      group_id,
      week_start,
      dispatch_type: dispatch_type as DispatchType,
      dispatch_date: dispatch_date.trim(),
      dispatch_memo: dispatch_memo.trim(),
      visitor_ids: visitor_ids,
    });
    setLoading(false);
    if (insertError) {
      const isRls = /row-level security|RLS/i.test(insertError.message ?? "");
      setError(isRls ? "保存する権限がありません。報告者以上のロールが必要です。" : `保存に失敗しました: ${insertError.message}`);
      return;
    }
    closePopup();
    router.refresh();
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-slate-800">派遣記録</h2>
        <button
          type="button"
          onClick={openPopup}
          aria-label="派遣記録を追加する"
          className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-400 touch-target text-lg leading-none"
        >
          +
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">時系列（古い→新しい）</p>
      {dispatchRecords.length > 0 ? (
        <div className="space-y-5">
          {sortedWeekStarts.map((weekStart) => {
            const weekNum = weekStartToNumber.get(weekStart);
            const records = recordsByWeek.get(weekStart) ?? [];
            return (
              <section key={weekStart}>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">W{weekNum ?? "?"}</h3>
                <ul className="space-y-3">
                  {records.map((r) => (
                    <li
                      key={r.id}
                      className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {r.dispatch_date
                            ? format(parseISO(r.dispatch_date), "yyyy/M/d")
                            : format(parseISO(r.week_start), "yyyy/M/d") + "（週）"}
                        </span>
                        <span className="text-slate-500">
                          {dispatchGroupMap.get(r.group_id) ?? r.group_id}
                        </span>
                        {r.dispatch_type && (
                          <span className={DISPATCH_TYPE_TEXT_COLORS[r.dispatch_type]}>
                            {DISPATCH_TYPE_LABELS[r.dispatch_type]}
                          </span>
                        )}
                      </div>
                      {r.dispatch_memo && r.dispatch_memo.trim() !== "" && (
                        <p className="mt-1.5 text-slate-600 whitespace-pre-wrap">
                          {r.dispatch_memo.trim()}
                        </p>
                      )}
                      {r.visitor_ids && r.visitor_ids.length > 0 && (
                        <p className="mt-1.5 text-slate-600 text-xs">
                          訪問者: {r.visitor_ids.map((vid) => visitorIdToName.get(vid) ?? vid).join("、")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">記録がありません</p>
      )}

      {popupOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-dispatch-title"
          onClick={(e) => e.target === e.currentTarget && closePopup()}
        >
          <div
            className="relative z-[101] w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-dispatch-title" className="text-sm font-semibold text-slate-800 mb-4">
              派遣記録を追加 — {memberName}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">対象週</label>
                <select
                  value={form.week_start}
                  onChange={(e) => {
                    const week = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      week_start: week,
                      dispatch_date: week || prev.dispatch_date,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target bg-white"
                  required
                >
                  <option value="">選択</option>
                  {weekOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">派遣種類</label>
                <select
                  value={form.dispatch_type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, dispatch_type: (e.target.value || "") as "" | DispatchType }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target bg-white"
                  required
                >
                  {DISPATCH_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">訪問者</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.visitor_ids.map((vid) => (
                    <span
                      key={vid}
                      className="inline-flex items-center gap-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-800"
                    >
                      {visitorNameMap.get(vid) ?? visitorIdToName.get(vid) ?? vid}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            visitor_ids: prev.visitor_ids.filter((id) => id !== vid),
                          }))
                        }
                        className="ml-0.5 rounded p-0.5 hover:bg-slate-300 touch-target"
                        aria-label={`${visitorNameMap.get(vid) ?? visitorIdToName.get(vid) ?? vid}を削除`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={visitorSearchQuery}
                    onChange={(e) => setVisitorSearchQuery(e.target.value)}
                    placeholder="名前で検索して追加"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg touch-target"
                    aria-label="訪問者を追加"
                  />
                  {visitorSearchResults.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-0.5">
                      {visitorSearchResults
                        .filter((vm) => vm.id !== memberId && !form.visitor_ids.includes(vm.id))
                        .map((vm) => (
                          <li key={vm.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setForm((prev) => ({ ...prev, visitor_ids: [...prev.visitor_ids, vm.id] }));
                                setVisitorNameMap((p) => new Map(p).set(vm.id, vm.name));
                                setVisitorSearchQuery("");
                                setVisitorSearchResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 touch-target"
                            >
                              {vm.name}
                              {vm.furigana && <span className="ml-1 text-slate-500 text-xs">{vm.furigana}</span>}
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">派遣日</label>
                <select
                  value={form.dispatch_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, dispatch_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm touch-target bg-white"
                  required
                >
                  <option value="">選択</option>
                  {currentWeekDays.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">メモ</label>
                <textarea
                  value={form.dispatch_memo}
                  onChange={(e) => setForm((prev) => ({ ...prev, dispatch_memo: e.target.value }))}
                  placeholder="メモ"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg touch-target resize-none"
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePopup}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 touch-target"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 touch-target disabled:opacity-50"
                >
                  {loading ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
