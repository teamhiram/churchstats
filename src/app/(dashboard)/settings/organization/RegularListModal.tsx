"use client";

import { useState, useEffect } from "react";
import {
  getDistrictRegularList,
  getGroupRegularList,
  addDistrictRegularMember,
  removeDistrictRegularMember,
  addGroupRegularMember,
  removeGroupRegularMember,
  getMembersByDistrict,
  getMembersByGroup,
} from "./actions";

type Props = {
  kind: "district" | "group";
  id: string;
  name: string;
  onClose: () => void;
};

type MemberItem = { id: string; name: string };

export function RegularListModal({ kind, id, name, onClose }: Props) {
  const [regularMembers, setRegularMembers] = useState<MemberItem[]>([]);
  const [nonRegularMembers, setNonRegularMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setMessage("");
    try {
      const [allMembers, regularList] =
        kind === "district"
          ? await Promise.all([getMembersByDistrict(id), getDistrictRegularList(id)])
          : await Promise.all([getMembersByGroup(id), getGroupRegularList(id)]);
      const regularIds = new Set(regularList.map((r) => r.member_id));
      const regular: MemberItem[] = [];
      const nonRegular: MemberItem[] = [];
      allMembers.forEach((m) => {
        if (regularIds.has(m.id)) regular.push(m);
        else nonRegular.push(m);
      });
      setRegularMembers(regular);
      setNonRegularMembers(nonRegular);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [kind, id]);

  const moveToNonRegular = async (member: MemberItem) => {
    setMessage("");
    setRegularMembers((prev) => prev.filter((m) => m.id !== member.id));
    setNonRegularMembers((prev) => [...prev, member]);
    const err =
      kind === "district"
        ? await removeDistrictRegularMember(id, member.id)
        : await removeGroupRegularMember(id, member.id);
    if (err.error) {
      setMessage(err.error);
      setRegularMembers((prev) => [...prev, member]);
      setNonRegularMembers((prev) => prev.filter((m) => m.id !== member.id));
    }
  };

  const moveToRegular = async (member: MemberItem) => {
    setMessage("");
    setNonRegularMembers((prev) => prev.filter((m) => m.id !== member.id));
    setRegularMembers((prev) => [...prev, member]);
    const err =
      kind === "district"
        ? await addDistrictRegularMember(id, member.id)
        : await addGroupRegularMember(id, member.id);
    if (err.error) {
      setMessage(err.error);
      setNonRegularMembers((prev) => [...prev, member]);
      setRegularMembers((prev) => prev.filter((m) => m.id !== member.id));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800 p-4 border-b border-slate-200 shrink-0">
          {kind === "district" ? "地区" : "小組"}「{name}」レギュラーリスト
        </h3>
        {message && (
          <p className="text-sm text-red-600 px-4 pt-2 shrink-0" role="alert">
            {message}
          </p>
        )}
        {loading ? (
          <p className="text-sm text-slate-500 p-4">読み込み中…</p>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <section>
              <h4 className="font-medium text-slate-700 mb-2 text-sm">レギュラーメンバー</h4>
              <p className="text-xs text-slate-500 mb-1">クリックで非レギュラーへ移動</p>
              <ul className="space-y-0.5 text-sm">
                {regularMembers.length === 0 && (
                  <li className="text-slate-500 py-1">—</li>
                )}
                {regularMembers.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => moveToNonRegular(m)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-800"
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="font-medium text-slate-700 mb-2 text-sm">非レギュラーメンバー</h4>
              <p className="text-xs text-slate-500 mb-1">クリックでレギュラーへ移動</p>
              <ul className="space-y-0.5 text-sm">
                {nonRegularMembers.length === 0 && (
                  <li className="text-slate-500 py-1">—</li>
                )}
                {nonRegularMembers.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => moveToRegular(m)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-800"
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
        <div className="p-4 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
