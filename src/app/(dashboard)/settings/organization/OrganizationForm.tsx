"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addDistrictAction, addGroupAction, saveEditGroupAction, deleteGroupAction, updateDistrictAction } from "./actions";

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

  const editingGroupId = editIdFromUrl ?? null;
  const editingDistrictId = editDistrictIdFromUrl ?? null;

  const districtsForLocality = districtsList
    .filter((d) => userLocalityIds.includes(d.locality_id ?? ""))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const groupsByDistrict = districtsForLocality.map((d) => ({
    district: d,
    groups: groupsList
      .filter((g) => (g.district_id ?? "") === (d.id ?? ""))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
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
    <div className="space-y-8 max-w-2xl">
      {/* 欠席アラートの週数 */}
      <section>
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
      <section>
        <h2 className="font-semibold text-slate-800 mb-2">アカウントの所属地方</h2>
        <p className="text-slate-700">{accountLocalityNames}</p>
      </section>

      {/* 地区 */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-800">地区</h2>
          {userLocalityIds.length > 0 ? (
            <a
              href="/settings/organization?add=district"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white hover:bg-red-700 touch-target shrink-0 no-underline"
              title="地区を追加"
            >
              +
            </a>
          ) : (
            <span
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white opacity-50 cursor-not-allowed shrink-0"
              title="所属地方に地区を追加できます"
            >
              +
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-2">
          一覧の「編集」で地区名を変更できます。
        </p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-2">
          {districtsForLocality.map((d) => (
            <li key={d.id ?? ""} className="flex flex-wrap items-center gap-2">
              {editingDistrictId === String(d.id ?? "") ? (
                <form action={updateDistrictAction} className="flex flex-wrap items-center gap-2 flex-1">
                  <input type="hidden" name="districtId" value={d.id ?? ""} />
                  {errorFromUrl && editDistrictIdFromUrl === String(d.id ?? "") && (
                    <p className="w-full text-sm text-red-600">{decodeURIComponent(errorFromUrl)}</p>
                  )}
                  <input
                    type="text"
                    name="name"
                    defaultValue={d.name ?? ""}
                    required
                    className="flex-1 min-w-[120px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button type="submit" className="px-3 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700">
                    保存
                  </button>
                  <Link
                    href="/settings/organization"
                    className="px-3 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg inline-block"
                  >
                    キャンセル
                  </Link>
                </form>
              ) : (
                <>
                  <span>{d.name ?? ""}</span>
                  <a
                    href={`/settings/organization?edit_district=${encodeURIComponent(String(d.id ?? ""))}`}
                    className="text-primary-600 text-sm hover:underline touch-target no-underline"
                  >
                    編集
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
        {districtsForLocality.length === 0 && (
          <p className="text-slate-500 text-sm">地区がありません。＋ボタンで追加できます。</p>
        )}
      </section>

      {/* 小組（地区セクション順） */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-800">小組</h2>
          {districtsForLocality.length > 0 ? (
            <a
              href="/settings/organization?add=group"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white hover:bg-red-700 touch-target shrink-0 no-underline"
              title="小組を追加"
            >
              +
            </a>
          ) : (
            <span
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white opacity-50 cursor-not-allowed shrink-0"
              title="地区を追加すると小組を登録できます"
            >
              +
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-3">
          一覧の「編集」で名前・所属地区を変更、「削除」で小組を削除できます（メンバーは無所属に移ります）。
        </p>
        {groupsByDistrict.map(({ district, groups: districtGroups }) => (
          <div key={district.id ?? ""} className="mb-6">
            <h3 className="font-medium text-slate-700 mb-2 border-b border-slate-200 pb-1">
              {district.name ?? ""}
            </h3>
            <ul className="space-y-1 text-sm text-slate-700">
              {districtGroups.map((g) => (
                <li key={g.id ?? ""} className="flex flex-wrap items-center gap-2 py-1">
                  {editingGroupId === String(g.id ?? "") ? (
                    <form action={saveEditGroupAction} className="flex flex-wrap items-center gap-2 flex-1">
                      <input type="hidden" name="groupId" value={g.id ?? ""} />
                      {errorFromUrl && editIdFromUrl === String(g.id ?? "") && (
                        <p className="w-full text-sm text-red-600">{decodeURIComponent(errorFromUrl)}</p>
                      )}
                      <input
                        type="text"
                        name="name"
                        defaultValue={g.name ?? ""}
                        required
                        className="flex-1 min-w-[100px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <select
                        name="districtId"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        defaultValue={g.district_id ?? ""}
                      >
                        <option value="">地区を選択</option>
                        {districtsList.map((d) => (
                          <option key={d.id ?? ""} value={d.id ?? ""}>
                            {d.name ?? ""}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="px-3 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700">
                        保存
                      </button>
                      <Link
                        href="/settings/organization"
                        className="px-3 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg inline-block"
                      >
                        キャンセル
                      </Link>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 w-full">
                      <a
                        href={`/settings/organization?edit=${encodeURIComponent(String(g.id ?? ""))}`}
                        className="flex-1 min-w-0 text-left px-3 py-3 min-h-[44px] rounded-lg hover:bg-primary-50 text-slate-700 hover:text-primary-700 touch-target flex items-center gap-2 no-underline"
                      >
                        <span className="min-w-0 truncate">{g.name ?? ""}</span>
                        <span className="text-primary-600 text-sm shrink-0">編集</span>
                      </a>
                      <form action={deleteGroupAction} className="inline-block">
                        <input type="hidden" name="groupId" value={g.id ?? ""} />
                        <button
                          type="submit"
                          className="px-3 py-3 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg text-sm touch-target shrink-0"
                          title={`「${g.name ?? ""}」を削除（メンバーは無所属に移ります）`}
                        >
                          削除
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {districtGroups.length === 0 && (
              <p className="text-slate-500 text-sm pl-2">小組がありません。</p>
            )}
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
                <button type="submit" className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">
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
                <button type="submit" className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">
                  追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
