"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PencilButton } from "@/components/PencilButton";
import { formatMemberName, formatMemberFurigana } from "@/lib/memberName";
import { updateMemberNameFieldsAction } from "./actions";

export type IncompleteNameMemberRow = {
  id: string;
  last_name: string | null;
  first_name: string | null;
  last_furigana: string | null;
  first_furigana: string | null;
};

type FieldKey = "last_name" | "first_name" | "last_furigana" | "first_furigana";

const FIELD_LABELS: Record<FieldKey, string> = {
  last_name: "氏",
  first_name: "名",
  last_furigana: "氏のフリガナ",
  first_furigana: "名のフリガナ",
};

function isBlank(v: string | null | undefined) {
  return v == null || v.trim() === "";
}

export function IncompleteNamesClient({
  initialMembers,
  localityName,
}: {
  initialMembers: IncompleteNameMemberRow[];
  localityName: string | null;
}) {
  const [members, setMembers] = useState<IncompleteNameMemberRow[]>(initialMembers);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<FieldKey, string>>({
    last_name: "",
    first_name: "",
    last_furigana: "",
    first_furigana: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = members.length;

  const incompleteCounts = useMemo(() => {
    const c: Record<FieldKey, number> = { last_name: 0, first_name: 0, last_furigana: 0, first_furigana: 0 };
    for (const m of members) {
      (Object.keys(c) as FieldKey[]).forEach((k) => {
        if (isBlank(m[k])) c[k] += 1;
      });
    }
    return c;
  }, [members]);

  const startEdit = (memberId: string) => {
    const m = members.find((x) => x.id === memberId);
    if (!m) return;
    setError(null);
    setEditingMemberId(memberId);
    setDraft({
      last_name: String(m.last_name ?? ""),
      first_name: String(m.first_name ?? ""),
      last_furigana: String(m.last_furigana ?? ""),
      first_furigana: String(m.first_furigana ?? ""),
    });
  };

  const cancelEdit = () => {
    setError(null);
    setEditingMemberId(null);
    setDraft({
      last_name: "",
      first_name: "",
      last_furigana: "",
      first_furigana: "",
    });
  };

  const saveEdit = async () => {
    if (!editingMemberId) return;
    setSaving(true);
    setError(null);
    const m = members.find((x) => x.id === editingMemberId);
    if (!m) {
      setSaving(false);
      return;
    }

    const next: IncompleteNameMemberRow = {
      ...m,
      last_name: draft.last_name.trim() === "" ? null : draft.last_name,
      first_name: draft.first_name.trim() === "" ? null : draft.first_name,
      last_furigana: draft.last_furigana.trim() === "" ? null : draft.last_furigana,
      first_furigana: draft.first_furigana.trim() === "" ? null : draft.first_furigana,
    };

    const res = await updateMemberNameFieldsAction(editingMemberId, {
      last_name: next.last_name,
      first_name: next.first_name,
      last_furigana: next.last_furigana,
      first_furigana: next.first_furigana,
    });

    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }

    setMembers((prev) => prev.map((x) => (x.id === editingMemberId ? next : x)));
    setSaving(false);
    cancelEdit();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-sm text-slate-700">
          対象地方: <span className="font-medium">{localityName ?? "—"}</span>
        </p>
        <p className="text-sm text-slate-700">
          該当メンバー: <span className="font-medium">{count}</span>
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded bg-slate-100 px-2 py-1">姓 空欄: {incompleteCounts.last_name}</span>
          <span className="rounded bg-slate-100 px-2 py-1">名 空欄: {incompleteCounts.first_name}</span>
          <span className="rounded bg-slate-100 px-2 py-1">ふりがな(姓) 空欄: {incompleteCounts.last_furigana}</span>
          <span className="rounded bg-slate-100 px-2 py-1">ふりがな(名) 空欄: {incompleteCounts.first_furigana}</span>
        </div>
        {error && (
          <p className="text-sm text-red-600">
            保存に失敗しました: {error}
          </p>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2 w-[1%] whitespace-nowrap">メンバー</th>
                <th className="px-3 py-2 whitespace-nowrap">氏</th>
                <th className="px-3 py-2">名</th>
                <th className="px-3 py-2 whitespace-nowrap">氏のフリガナ</th>
                <th className="px-3 py-2 whitespace-nowrap">名のフリガナ</th>
                <th className="px-3 py-2 w-[1%] whitespace-nowrap">入力</th>
                <th className="px-3 py-2 w-[1%] whitespace-nowrap">個人ページ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={7}>
                    該当なし
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const displayName = formatMemberName(m) || "—";
                  const displayFurigana = formatMemberFurigana(m) || null;
                  return (
                    <tr key={m.id} className="align-top">
                      <td className="px-3 py-3 max-w-[14rem]">
                        <div className="flex flex-col min-w-0">
                          <span className="text-slate-900 font-medium truncate">{displayName}</span>
                          {displayFurigana && <span className="text-xs text-slate-500 truncate">{displayFurigana}</span>}
                        </div>
                      </td>
                      {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => {
                        const value = m[field];
                        return (
                          <td key={field} className="px-3 py-3">
                            <span className={isBlank(value) ? "text-amber-700 font-medium" : "text-slate-900"}>
                              {isBlank(value) ? "（空欄）" : value}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <PencilButton
                          aria-label={`${displayName}の氏名を編集`}
                          onClick={() => startEdit(m.id)}
                          variant="iconOnly"
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link href={`/members/${m.id}`} className="text-primary-600 hover:underline touch-target">
                          開く
                        </Link>
                        <span className="text-slate-400 mx-1">/</span>
                        <Link href={`/members/${m.id}/edit`} className="text-primary-600 hover:underline touch-target">
                          編集
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingMemberId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="氏名を編集"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) cancelEdit();
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">氏名を編集</h2>
              <button
                type="button"
                onClick={() => !saving && cancelEdit()}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 touch-target disabled:opacity-60"
                aria-label="閉じる"
                disabled={saving}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
                <label key={field} className="grid grid-cols-[10rem_1fr] items-center gap-3">
                  <span className="text-sm text-slate-700">{FIELD_LABELS[field]}</span>
                  <input
                    value={draft[field]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={saving}
                  />
                </label>
              ))}

              {error && <p className="text-sm text-red-600">保存に失敗しました: {error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 touch-target"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="h-10 px-4 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 touch-target"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

