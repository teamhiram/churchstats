"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMemberName, formatMemberFurigana } from "@/lib/memberName";
import { deleteToBeDeletedMember, deleteToBeDeletedMembers } from "./actions";

export type ToBeDeletedMemberRow = {
  id: string;
  last_name: string | null;
  first_name: string | null;
  last_furigana: string | null;
  first_furigana: string | null;
  status: string | null;
};

export function ToBeDeletedMembersClient({
  initialMembers,
  localityName,
  canDeleteMembers,
}: {
  initialMembers: ToBeDeletedMemberRow[];
  localityName: string | null;
  canDeleteMembers: boolean;
}) {
  const [members, setMembers] = useState<ToBeDeletedMemberRow[]>(initialMembers);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedIds.size;
  const allSelected = useMemo(
    () => members.length > 0 && members.every((member) => selectedIds.has(member.id)),
    [members, selectedIds]
  );

  const toggleSelected = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(members.map((member) => member.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const removeDeletedMembers = (deletedIds: string[]) => {
    const deletedIdSet = new Set(deletedIds);
    setMembers((prev) => prev.filter((member) => !deletedIdSet.has(member.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleDeleteOne = async (member: ToBeDeletedMemberRow) => {
    const displayName = formatMemberName(member) || "このメンバー";
    if (!window.confirm(`${displayName}を完全に削除しますか？\n関連する出席・在籍情報も削除されます。`)) {
      return;
    }

    setDeletingId(member.id);
    setError(null);
    try {
      const result = await deleteToBeDeletedMember(member.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      removeDeletedMembers([member.id]);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = members.filter((member) => selectedIds.has(member.id)).map((member) => member.id);
    if (ids.length === 0) return;
    if (!window.confirm(`選択した ${ids.length} 件を完全に削除しますか？\n関連する出席・在籍情報も削除されます。`)) {
      return;
    }

    setBulkDeleting(true);
    setError(null);
    try {
      const result = await deleteToBeDeletedMembers(ids);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      removeDeletedMembers(ids);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-sm text-slate-700">
          対象地方: <span className="font-medium">{localityName ?? "—"}</span>
        </p>
        <p className="text-sm text-slate-700">
          該当メンバー: <span className="font-medium">{members.length}</span>
        </p>
        {canDeleteMembers ? (
          <p className="text-sm text-slate-600">
            個別削除と一括削除ができます。削除すると、関連する出席・在籍データも同時に削除されます。
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            一覧の確認はできますが、削除は管理者権限のあるユーザーのみ実行できます。
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600">
            削除に失敗しました: {error}
          </p>
        )}
      </div>

      {canDeleteMembers && members.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <button
            type="button"
            onClick={allSelected ? clearSelection : selectAll}
            className="rounded border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
          >
            {allSelected ? "選択解除" : "全件選択"}
          </button>
          <span className="text-sm font-medium text-rose-800">
            選択中: {selectedCount} 件
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedCount === 0 || bulkDeleting}
            className="rounded border border-rose-300 bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {bulkDeleting ? "一括削除中…" : "選択したメンバーを一括削除"}
          </button>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {members.length === 0 ? (
          <p className="text-sm text-slate-500">該当なし</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {canDeleteMembers && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(member.id)}
                      onChange={() => toggleSelected(member.id)}
                      disabled={bulkDeleting || deletingId === member.id}
                      className="rounded border-slate-300"
                      aria-label={`${formatMemberName(member) || "メンバー"}を選択`}
                    />
                  )}
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{formatMemberName(member) || "—"}</span>
                    {formatMemberFurigana(member) && (
                      <span className="ml-2 text-xs text-slate-500">({formatMemberFurigana(member)})</span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 text-sm">
                  <Link href={`/members/${member.id}/edit`} className="text-primary-600 hover:underline touch-target">
                    編集
                  </Link>
                  {canDeleteMembers && (
                    <>
                      <span className="mx-1 text-slate-400">/</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(member)}
                        disabled={bulkDeleting || deletingId === member.id}
                        className="text-red-700 hover:underline disabled:opacity-50"
                      >
                        {deletingId === member.id ? "削除中…" : "削除"}
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
