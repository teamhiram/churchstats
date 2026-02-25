"use client";

import { useState, useEffect, useRef } from "react";
import {
  getDistrictRegularList,
  getGroupRegularList,
  getDistrictSemiRegularList,
  getGroupSemiRegularList,
  getDistrictPoolList,
  getGroupPoolList,
  addDistrictRegularMember,
  removeDistrictRegularMember,
  addDistrictSemiRegularMember,
  removeDistrictSemiRegularMember,
  addDistrictPoolMember,
  removeDistrictPoolMember,
  addGroupRegularMember,
  removeGroupRegularMember,
  addGroupSemiRegularMember,
  removeGroupSemiRegularMember,
  addGroupPoolMember,
  removeGroupPoolMember,
  getMembersByDistrict,
  getMembersByGroup,
} from "./actions";

type Props = {
  kind: "district" | "group";
  id: string;
  name: string;
  onClose: () => void;
};

type MemberItem = { id: string; name: string; furigana: string };
type Tier = "regular" | "semi" | "pool";

const TABS: { key: Tier; label: string }[] = [
  { key: "regular", label: "レギュラー" },
  { key: "semi", label: "準レギュラー" },
  { key: "pool", label: "プール" },
];

export function RegularListModal({ kind, id, name, onClose }: Props) {
  const [memberTiers, setMemberTiers] = useState<Map<string, Tier>>(new Map());
  const [allMembers, setAllMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<Tier>("regular");
  const initialTiersRef = useRef<Map<string, Tier>>(new Map());

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setMessage("");

    const fetchData = async () => {
      const [members, regularList, semiList, poolList] =
        kind === "district"
          ? await Promise.all([getMembersByDistrict(id), getDistrictRegularList(id), getDistrictSemiRegularList(id), getDistrictPoolList(id)])
          : await Promise.all([getMembersByGroup(id), getGroupRegularList(id), getGroupSemiRegularList(id), getGroupPoolList(id)]);

      const regularIds = new Set(regularList.map((r) => r.member_id));
      const semiIds = new Set(semiList.map((r) => r.member_id));
      const poolIds = new Set(poolList.map((r) => r.member_id));
      const tiers = new Map<string, Tier>();
      members.forEach((m) => {
        if (regularIds.has(m.id)) tiers.set(m.id, "regular");
        else if (semiIds.has(m.id)) tiers.set(m.id, "semi");
        else if (poolIds.has(m.id)) tiers.set(m.id, "pool");
        else tiers.set(m.id, "semi");
      });

      setAllMembers(members);
      setMemberTiers(tiers);
      initialTiersRef.current = new Map(tiers);
      setLoading(false);
    };

    fetchData().catch(() => setLoading(false));
  }, [kind, id]);

  const membersInTier = (tier: Tier): MemberItem[] =>
    allMembers
      .filter((m) => memberTiers.get(m.id) === tier)
      .sort((a, b) => a.furigana.localeCompare(b.furigana, "ja"));

  const isChanged = (memberId: string): boolean =>
    initialTiersRef.current.get(memberId) !== memberTiers.get(memberId);

  const moveMember = async (member: MemberItem, from: Tier, to: Tier) => {
    if (from === to) return;
    setMessage("");

    setMemberTiers((prev) => new Map(prev).set(member.id, to));

    try {
      if (from === "regular") {
        const err = kind === "district"
          ? await removeDistrictRegularMember(id, member.id)
          : await removeGroupRegularMember(id, member.id);
        if (err.error) throw new Error(err.error);
      } else if (from === "semi") {
        const err = kind === "district"
          ? await removeDistrictSemiRegularMember(id, member.id)
          : await removeGroupSemiRegularMember(id, member.id);
        if (err.error) throw new Error(err.error);
      } else if (from === "pool") {
        const err = kind === "district"
          ? await removeDistrictPoolMember(id, member.id)
          : await removeGroupPoolMember(id, member.id);
        if (err.error) throw new Error(err.error);
      }

      if (to === "regular") {
        const err = kind === "district"
          ? await addDistrictRegularMember(id, member.id)
          : await addGroupRegularMember(id, member.id);
        if (err.error) throw new Error(err.error);
      } else if (to === "semi") {
        const err = kind === "district"
          ? await addDistrictSemiRegularMember(id, member.id)
          : await addGroupSemiRegularMember(id, member.id);
        if (err.error) throw new Error(err.error);
      } else if (to === "pool") {
        const err = kind === "district"
          ? await addDistrictPoolMember(id, member.id)
          : await addGroupPoolMember(id, member.id);
        if (err.error) throw new Error(err.error);
      }
    } catch (e: unknown) {
      setMemberTiers((prev) => new Map(prev).set(member.id, from));
      setMessage(e instanceof Error ? e.message : "移動に失敗しました");
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
        className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90dvh] md:max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800 p-4 border-b border-slate-200 shrink-0 flex items-center gap-2">
          <span>{kind === "district" ? "地区" : "小組"}「{name}」メンバーリスト</span>
          {(() => {
            const totalChanged = allMembers.filter((m) => initialTiersRef.current.get(m.id) !== memberTiers.get(m.id)).length;
            return totalChanged > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                {totalChanged}
              </span>
            ) : null;
          })()}
        </h3>

        {message && (
          <p className="text-sm text-red-600 px-4 pt-2 shrink-0" role="alert">
            {message}
          </p>
        )}

        {/* タブ */}
        <div className="flex border-b border-slate-200 shrink-0">
          {TABS.map(({ key, label }) => {
            const count = membersInTier(key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 p-4">読み込み中…</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-scroll p-4">
            {activeTab === "regular" && (
              <MemberList
                members={membersInTier("regular")}
                isChanged={isChanged}
                hint="クリックで準レギュラーへ移動"
                renderAction={(m) => (
                  <button
                    type="button"
                    onClick={() => moveMember(m, "regular", "semi")}
                    className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800 truncate min-w-0 ${isChanged(m.id) ? "bg-amber-100" : ""}`}
                    title={m.name}
                  >
                    {m.name}
                  </button>
                )}
              />
            )}

            {activeTab === "semi" && (
              <MemberList
                members={membersInTier("semi")}
                isChanged={isChanged}
                hint="← レギュラーへ ／ → プールへ"
                renderAction={(m) => (
                  <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg min-w-0 ${isChanged(m.id) ? "bg-amber-100" : ""}`}>
                    <button
                      type="button"
                      onClick={() => moveMember(m, "semi", "regular")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-primary-600 transition-colors shrink-0"
                      title="レギュラーへ"
                    >
                      <ArrowLeftIcon />
                    </button>
                    <span className="flex-1 text-slate-800 text-center truncate min-w-0" title={m.name}>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => moveMember(m, "semi", "pool")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-red-500 transition-colors shrink-0"
                      title="プールへ"
                    >
                      <ArrowRightIcon />
                    </button>
                  </div>
                )}
              />
            )}

            {activeTab === "pool" && (
              <MemberList
                members={membersInTier("pool")}
                isChanged={isChanged}
                hint="クリックで準レギュラーへ移動"
                renderAction={(m) => (
                  <button
                    type="button"
                    onClick={() => moveMember(m, "pool", "semi")}
                    className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800 truncate min-w-0 ${isChanged(m.id) ? "bg-amber-100" : ""}`}
                    title={m.name}
                  >
                    {m.name}
                  </button>
                )}
              />
            )}
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

function MemberList({
  members,
  isChanged,
  hint,
  renderAction,
}: {
  members: MemberItem[];
  isChanged: (id: string) => boolean;
  hint: string;
  renderAction: (m: MemberItem) => React.ReactNode;
}) {
  const changedCount = members.filter((m) => isChanged(m.id)).length;
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">
        {hint}
        {changedCount > 0 && (
          <span className="ml-2 text-amber-600 font-medium">（変更 {changedCount}件）</span>
        )}
      </p>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-sm">
        {members.length === 0 && <li className="col-span-2 text-slate-500 py-1">—</li>}
        {members.map((m) => (
          <li key={m.id} className="min-w-0">
            {renderAction(m)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638l-4.158-3.96a.75.75 0 011.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
    </svg>
  );
}
