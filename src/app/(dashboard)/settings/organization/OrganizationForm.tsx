"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  addDistrictAction,
  addGroupAction,
  saveEditGroupAction,
  deleteGroupAction,
  updateDistrictAction,
  getDistrictRegularList,
  getMembersByDistrict,
  getGroupRegularList,
  getMembersByGroup,
} from "./actions";
import { RegularListModal } from "./RegularListModal";

type Locality = { id: string; name: string };
type District = { id: string; locality_id: string; name: string };
type Group = { id: string; district_id: string; name: string };

type Props = {
  localities: Locality[];
  userLocalities: Locality[];
  districts: District[];
  groups: Group[];
  initialAbsenceWeeks: number;
};

export function OrganizationForm({
  localities,
  userLocalities,
  districts,
  groups: initialGroups,
  initialAbsenceWeeks,
}: Props) {
  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams.get("edit");
  const editDistrictIdFromUrl = searchParams.get("edit_district");
  const addFromUrl = searchParams.get("add");
  const errorFromUrl = searchParams.get("error");

  const router = useRouter();
  const [districtsList, setDistrictsList] = useState(districts);
  const [groupsList, setGroupsList] = useState(initialGroups);
  const [absenceWeeks, setAbsenceWeeks] = useState(initialAbsenceWeeks);
  const [absenceWeeksSaving, setAbsenceWeeksSaving] = useState(false);
  const [absenceWeeksMessage, setAbsenceWeeksMessage] = useState("");
  const userLocalityIds = userLocalities.map((l) => l.id ?? "");
  const [selectedLocalityIdForAdd, setSelectedLocalityIdForAdd] = useState<string>(() =>
    userLocalities[0]?.id ?? ""
  );
  const showDistrictModal = addFromUrl === "district";
  const showGroupModal = addFromUrl === "group";
  const [renameDistrictId, setRenameDistrictId] = useState<string | null>(null);
  const [renameGroup, setRenameGroup] = useState<Group | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<Group | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [listModal, setListModal] = useState<{ kind: "district" | "group"; id: string; name: string } | null>(null);
  const [expandedDistrictIds, setExpandedDistrictIds] = useState<Set<string>>(() => new Set());
  const [districtListCache, setDistrictListCache] = useState<
    Record<string, { regularNames: string[]; nonRegularNames: string[] }>
  >({});
  const [districtListLoading, setDistrictListLoading] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [groupListCache, setGroupListCache] = useState<
    Record<string, { regularNames: string[]; nonRegularNames: string[] }>
  >({});
  const [groupListLoading, setGroupListLoading] = useState<Set<string>>(new Set());

  const showRenameDistrictModal = renameDistrictId !== null || editDistrictIdFromUrl !== null;
  const renameDistrict = showRenameDistrictModal
    ? districtsList.find((d) => d.id === renameDistrictId || d.id === editDistrictIdFromUrl)
    : null;
  const showRenameGroupModal = renameGroup !== null || editIdFromUrl !== null;
  const renameGroupData = showRenameGroupModal
    ? (renameGroup ?? groupsList.find((g) => g.id === editIdFromUrl) ?? null)
    : null;

  const districtsForLocality = districtsList
    .filter((d) => userLocalityIds.includes(d.locality_id ?? ""))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "en"));
  const groupsByDistrict = districtsForLocality.map((d) => ({
    district: d,
    groups: groupsList
      .filter((g) => (g.district_id ?? "") === (d.id ?? ""))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "en")),
  }));

  useEffect(() => {
    if (userLocalities[0]?.id && !selectedLocalityIdForAdd) {
      setSelectedLocalityIdForAdd(userLocalities[0].id);
    }
  }, [userLocalities]);

  useEffect(() => {
    setDistrictsList(districts);
  }, [districts]);

  useEffect(() => {
    setGroupsList(initialGroups);
  }, [initialGroups]);

  useEffect(() => {
    setAbsenceWeeks(initialAbsenceWeeks);
  }, [initialAbsenceWeeks]);

  // 枠組設定を開いたときに地区・小組のリストを1リクエストで一括取得し、キャッシュに流し込む
  useEffect(() => {
    let cancelled = false;
    fetch("/api/organization-lists")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then(
        (data: { districts: Record<string, { regularNames: string[]; nonRegularNames: string[] }>; groups: Record<string, { regularNames: string[]; nonRegularNames: string[] }> }) => {
          if (cancelled) return;
          setDistrictListCache((prev) => ({ ...prev, ...data.districts }));
          setGroupListCache((prev) => ({ ...prev, ...data.groups }));
          setDistrictListLoading(() => new Set());
          setGroupListLoading(() => new Set());
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const toLoad = [...expandedGroupIds].filter((id) => id && !groupListCache[id]);
    if (toLoad.length === 0) return;
    setGroupListLoading((prev) => new Set([...prev, ...toLoad]));
    Promise.all(
      toLoad.map((gid) =>
        Promise.all([getMembersByGroup(gid), getGroupRegularList(gid)]).then(([members, regularList]) => {
          const regularIds = new Set(regularList.map((r) => r.member_id));
          const regularNames: string[] = [];
          const nonRegularNames: string[] = [];
          members.forEach((m) => {
            if (regularIds.has(m.id)) regularNames.push(m.name);
            else nonRegularNames.push(m.name);
          });
          return { gid, regularNames, nonRegularNames };
        })
      )
    )
      .then((results) => {
        setGroupListCache((prev) => {
          const next = { ...prev };
          results.forEach(({ gid, regularNames, nonRegularNames }) => {
            next[gid] = { regularNames, nonRegularNames };
          });
          return next;
        });
      })
      .finally(() => setGroupListLoading((prev) => {
        const next = new Set(prev);
        toLoad.forEach((id) => next.delete(id));
        return next;
      }));
  }, [expandedGroupIds, groupListCache]);

  useEffect(() => {
    const toLoad = [...expandedDistrictIds].filter((id) => id && !districtListCache[id]);
    if (toLoad.length === 0) return;
    setDistrictListLoading((prev) => new Set([...prev, ...toLoad]));
    Promise.all(
      toLoad.map((did) =>
        Promise.all([getMembersByDistrict(did), getDistrictRegularList(did)]).then(([members, regularList]) => {
          const regularIds = new Set(regularList.map((r) => r.member_id));
          const regularNames: string[] = [];
          const nonRegularNames: string[] = [];
          members.forEach((m) => {
            if (regularIds.has(m.id)) regularNames.push(m.name);
            else nonRegularNames.push(m.name);
          });
          return { did, regularNames, nonRegularNames };
        })
      )
    )
      .then((results) => {
        setDistrictListCache((prev) => {
          const next = { ...prev };
          results.forEach(({ did, regularNames, nonRegularNames }) => {
            next[did] = { regularNames, nonRegularNames };
          });
          return next;
        });
      })
      .finally(() => setDistrictListLoading((prev) => {
        const next = new Set(prev);
        toLoad.forEach((id) => next.delete(id));
        return next;
      }));
  }, [expandedDistrictIds, districtListCache]);

  const saveAbsenceWeeks = async (value: number) => {
    setAbsenceWeeksSaving(true);
    setAbsenceWeeksMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "absence_alert_weeks", value }, { onConflict: "key" });
    setAbsenceWeeksSaving(false);
    if (error) {
      setAbsenceWeeksMessage(error.message);
      return;
    }
    setAbsenceWeeksMessage("保存しました");
    setTimeout(() => setAbsenceWeeksMessage(""), 2500);
  };

  const accountLocalityNames = userLocalities.map((l) => l.name ?? "").filter(Boolean).join("、") || "—";
  const selectedLocalityForAdd = localities.find((l) => l.id === selectedLocalityIdForAdd);

  return (
    <div className="space-y-8">
      {/* 欠席アラートの週数 */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800 mb-2">欠席アラートの週数（1〜52）</h2>
        <div className="space-y-2 max-w-xs">
          <select
            value={absenceWeeks}
            onChange={(e) => {
              const v = Number(e.target.value);
              setAbsenceWeeks(v);
              saveAbsenceWeeks(v);
            }}
            disabled={absenceWeeksSaving}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target disabled:opacity-50"
          >
            {Array.from({ length: 52 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}週</option>
            ))}
          </select>
          <p className="text-xs text-slate-500">過去この週数出席していたローカルメンバーの今週欠席を表示</p>
          {absenceWeeksMessage && (
            <p className={`text-sm ${absenceWeeksMessage === "保存しました" ? "text-orange-600" : "text-slate-600"}`}>
              {absenceWeeksMessage}
            </p>
          )}
        </div>
      </section>

      {/* アカウントの所属地方（表示のみ・変更不可） */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800 mb-2">アカウントの所属地方</h2>
        <p className="text-slate-700">{accountLocalityNames}</p>
      </section>

      {/* 地区の設定 */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-800">地区の設定</h2>
          {userLocalityIds.length > 0 ? (
            <a
              href="/settings/organization?add=district"
              className="text-primary-600 hover:text-primary-700 hover:underline text-sm font-medium no-underline"
            >
              地区を追加する
            </a>
          ) : (
            <span className="text-slate-400 text-sm cursor-not-allowed">
              地区を追加する
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-3">
          一覧の「リネーム」で地区名を変更できます。
        </p>
        {districtsForLocality.map((d) => {
          const did = d.id ?? "";
          const isExpanded = expandedDistrictIds.has(did);
          const cache = districtListCache[did];
          const loading = districtListLoading.has(did);
          return (
            <div
              key={did}
              className="mb-4 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-2 py-2 w-full">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDistrictIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(did)) next.delete(did);
                        else next.add(did);
                        return next;
                      })
                    }
                    className="flex-1 min-w-0 text-left px-3 py-3 min-h-[44px] rounded-lg touch-target flex items-center gap-2 text-white bg-primary-600 shadow-sm hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
                    aria-expanded={isExpanded}
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-white/90" aria-hidden>
                      {isExpanded ? "−" : "+"}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-white">{d.name ?? ""}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenameDistrictId(did)}
                    className="text-primary-600 text-sm hover:underline touch-target bg-transparent border-0 cursor-pointer p-0 shrink-0"
                  >
                    リネーム
                  </button>
                </div>
                {isExpanded && (
                  <div className="pl-4 pb-3 pr-2 text-sm text-slate-700 border-l-2 border-slate-200 ml-2">
                    {loading ? (
                      <p className="text-slate-500">読み込み中…</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-xs font-bold text-slate-700 mb-0.5">レギュラーメンバー</p>
                            <p className="text-slate-600">{cache?.regularNames?.length ? cache.regularNames.join("、") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700 mb-0.5">非レギュラーメンバー</p>
                            <p className="text-slate-600">{cache?.nonRegularNames?.length ? cache.nonRegularNames.join("、") : "—"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setListModal({ kind: "district", id: did, name: d.name ?? "" })}
                          className="text-primary-600 text-sm hover:underline mt-2"
                        >
                          リストを編集
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {districtsForLocality.length === 0 && (
          <p className="text-slate-500 text-sm">地区がありません。＋ボタンで追加できます。</p>
        )}
      </section>

      {/* 小組の設定（地区セクション順） */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-800">小組の設定</h2>
          {districtsForLocality.length > 0 ? (
            <a
              href="/settings/organization?add=group"
              className="text-primary-600 hover:text-primary-700 hover:underline text-sm font-medium no-underline"
            >
              小組を追加する
            </a>
          ) : (
            <span className="text-slate-400 text-sm cursor-not-allowed">
              小組を追加する
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-3">
          一覧の「リネーム」で名前・所属地区を変更、「削除」で小組を削除できます（メンバーは無所属に移ります）。
        </p>
        {groupsByDistrict.map(({ district, groups: districtGroups }) => (
          <div
            key={district.id ?? ""}
            className="mb-4 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="bg-slate-100 border-b border-slate-200 py-2 px-4">
              <h3 className="font-semibold text-white rounded-md px-2 py-1 inline-block bg-primary-600 shadow-sm">
                {district.name ?? ""}
              </h3>
            </div>
            <div className="p-3">
              <ul className="space-y-1 text-sm text-slate-700">
              {districtGroups.map((g) => {
                const gid = g.id ?? "";
                const isExpanded = expandedGroupIds.has(gid);
                const cache = groupListCache[gid];
                const loading = groupListLoading.has(gid);
                return (
                  <li key={gid} className="border-b border-slate-100 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2 py-2 w-full">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroupIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(gid)) next.delete(gid);
                            else next.add(gid);
                            return next;
                          })
                        }
                        className="flex-1 min-w-0 text-left px-3 py-3 min-h-[44px] rounded-lg touch-target flex items-center gap-2 text-white bg-primary-600 shadow-sm hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
                      >
                        <span className="w-5 shrink-0 text-center font-mono text-white/90" aria-hidden>
                          {isExpanded ? "−" : "+"}
                        </span>
                        <span className="min-w-0 truncate font-semibold text-white">{g.name ?? ""}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameGroup(g);
                        }}
                        className="text-primary-600 text-sm hover:underline touch-target bg-transparent border-0 cursor-pointer p-0 shrink-0"
                      >
                        リネーム
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmGroup(g);
                          setDeleteConfirmName("");
                        }}
                        className="px-3 py-3 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg text-sm touch-target shrink-0"
                        title={`「${g.name ?? ""}」を削除（メンバーは無所属に移ります）`}
                      >
                        削除
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="pl-4 pb-3 pr-2 text-sm text-slate-700 border-l-2 border-slate-200 ml-2">
                        {loading ? (
                          <p className="text-slate-500">読み込み中…</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                              <div>
                                <p className="text-xs font-bold text-slate-700 mb-0.5">レギュラーメンバー</p>
                                <p className="text-slate-600">{cache?.regularNames?.length ? cache.regularNames.join("、") : "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700 mb-0.5">非レギュラーメンバー</p>
                                <p className="text-slate-600">{cache?.nonRegularNames?.length ? cache.nonRegularNames.join("、") : "—"}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setListModal({ kind: "group", id: gid, name: g.name ?? "" });
                              }}
                              className="text-primary-600 text-sm hover:underline mt-2"
                            >
                              リストを編集
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              </ul>
              {districtGroups.length === 0 && (
                <p className="text-slate-500 text-sm">小組がありません。</p>
              )}
            </div>
          </div>
        ))}
        {groupsByDistrict.length === 0 && (
          <p className="text-slate-500 text-sm">地区がありません。地区を追加すると小組を登録できます。</p>
        )}
      </section>

      {errorFromUrl && !addFromUrl && !editIdFromUrl && !editDistrictIdFromUrl && (
        <p className="text-sm text-red-600">{decodeURIComponent(errorFromUrl)}</p>
      )}

      {/* 地区追加モーダル */}
      {showDistrictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-4">地区を追加</h3>
            <p className="text-sm text-slate-600 mb-2">
              「{selectedLocalityForAdd?.name ?? ""}」に紐づく地区を追加します。
            </p>
            <form action={addDistrictAction} className="space-y-4">
              {userLocalities.length === 1 ? (
                <input type="hidden" name="localityId" value={selectedLocalityIdForAdd} />
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">追加先の地方</label>
                  <select
                    name="localityId"
                    value={selectedLocalityIdForAdd}
                    onChange={(e) => setSelectedLocalityIdForAdd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                    required
                  >
                    {userLocalities.map((l) => (
                      <option key={l.id ?? ""} value={l.id ?? ""}>
                        {l.name ?? ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {errorFromUrl && addFromUrl === "district" && (
                <p className="text-sm text-red-600">{decodeURIComponent(errorFromUrl)}</p>
              )}
              <input
                type="text"
                name="name"
                placeholder="地区名"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                required
              />
              <div className="flex gap-2 justify-end">
                <Link
                  href="/settings/organization"
                  className="inline-block px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  キャンセル
                </Link>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500">
                  追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 小組追加モーダル */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-4">小組を追加</h3>
            <form action={addGroupAction} className="space-y-4">
              {errorFromUrl && addFromUrl === "group" && (
                <p className="text-sm text-red-600">{decodeURIComponent(errorFromUrl)}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">地区</label>
                <select
                  name="districtId"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                  required
                  defaultValue={districtsForLocality[0]?.id ?? ""}
                >
                  <option value="">地区を選択</option>
                  {districtsForLocality.map((d) => (
                    <option key={d.id ?? ""} value={d.id ?? ""}>
                      {d.name ?? ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">小組名</label>
                <input
                  type="text"
                  name="name"
                  placeholder="小組名"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Link
                  href="/settings/organization"
                  className="inline-block px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  キャンセル
                </Link>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500">
                  追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 地区リネームモーダル */}
      {showRenameDistrictModal && renameDistrict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            setRenameDistrictId(null);
            if (editDistrictIdFromUrl) router.replace("/settings/organization");
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-800 mb-4">地区名を変更</h3>
            <form action={updateDistrictAction} className="space-y-4">
              <input type="hidden" name="districtId" value={renameDistrict.id ?? ""} />
              {errorFromUrl && editDistrictIdFromUrl === String(renameDistrict.id ?? "") && (
                <p className="text-sm text-red-600">{decodeURIComponent(errorFromUrl ?? "")}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">地区名</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={renameDistrict.name ?? ""}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRenameDistrictId(null);
                    if (editDistrictIdFromUrl) router.replace("/settings/organization");
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 小組リネームモーダル */}
      {showRenameGroupModal && renameGroupData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            setRenameGroup(null);
            if (editIdFromUrl) router.replace("/settings/organization");
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-800 mb-4">小組名・所属地区を変更</h3>
            <form action={saveEditGroupAction} className="space-y-4">
              <input type="hidden" name="groupId" value={renameGroupData.id ?? ""} />
              {errorFromUrl && editIdFromUrl === String(renameGroupData.id ?? "") && (
                <p className="text-sm text-red-600">{decodeURIComponent(errorFromUrl ?? "")}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">小組名</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={renameGroupData.name ?? ""}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">所属地区</label>
                <select
                  name="districtId"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target text-sm"
                  defaultValue={renameGroupData.district_id ?? ""}
                >
                  <option value="">地区を選択</option>
                  {districtsList.map((d) => (
                    <option key={d.id ?? ""} value={d.id ?? ""}>
                      {d.name ?? ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRenameGroup(null);
                    if (editIdFromUrl) router.replace("/settings/organization");
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 小組削除確認モーダル */}
      {deleteConfirmGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDeleteConfirmGroup(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-group-title"
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-group-title" className="font-semibold text-slate-800 mb-3">小組を削除</h3>
            <p className="text-sm text-slate-700 mb-4">
              本当に削除しますか？メンバーが無所属になります。
              <br />
              削除する場合は、枠内に小組の名前を入力した上で削除ボタンを押してください。
            </p>
            <form action={deleteGroupAction} className="space-y-4">
              <input type="hidden" name="groupId" value={deleteConfirmGroup.id ?? ""} />
              <div>
                <label htmlFor="delete-confirm-name" className="block text-sm font-medium text-slate-700 mb-1">
                  小組の名前（確認用）
                </label>
                <input
                  id="delete-confirm-name"
                  type="text"
                  name="confirmName"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={deleteConfirmGroup.name ?? ""}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmGroup(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={(deleteConfirmName.trim()) !== (deleteConfirmGroup.name ?? "").trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  削除
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* レギュラーリストモーダル（地区／小組） */}
      {listModal && (
        <RegularListModal
          kind={listModal.kind}
          id={listModal.id}
          name={listModal.name}
          onClose={() => {
            const was = listModal;
            setListModal(null);
            if (was.kind === "group" && was.id) {
              setGroupListCache((prev) => {
                const next = { ...prev };
                delete next[was.id];
                return next;
              });
            }
          }}
        />
      )}
    </div>
  );
}
