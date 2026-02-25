"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import {
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
} from "@/app/(dashboard)/settings/organization/actions";
import { QUERY_KEYS } from "@/lib/queryClient";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { Toggle } from "@/components/Toggle";
import { updateMemberAction } from "./actions";

const CATEGORIES: Category[] = ["adult", "university", "high_school", "junior_high", "elementary", "preschool"];

function ButtonGroup<T extends string>({
  value,
  onChange,
  options,
  getLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
  getLabel: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-lg px-2 py-[0.5em] text-sm font-medium transition-colors ${
            value === opt
              ? "bg-primary-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {getLabel(opt)}
        </button>
      ))}
    </div>
  );
}

type Tier = "regular" | "semi" | "pool";

type Props = {
  memberId: string;
  /** 楽観ロック用。編集中に取得した updated_at。他ユーザーが更新していると保存時にコンフリクトとして理由を表示する。 */
  initialUpdatedAt: string | null;
  initial: {
    name: string;
    furigana: string;
    gender: "male" | "female";
    is_local: boolean;
    district_id: string;
    group_id: string | null;
    district_tier: Tier;
    group_tier: Tier;
    locality_id: string;
    age_group: Category | null;
    is_baptized: boolean;
    language_main: string;
    language_sub: string;
    local_member_join_date: string | null;
    local_member_leave_date: string | null;
    enrollment_periods?: { period_no: number; join_date: string | null; leave_date: string | null; is_uncertain: boolean; memo: string | null }[];
  };
  districts: { id: string; name: string }[];
  groups: { id: string; name: string; district_id: string }[];
  localities: { id: string; name: string }[];
  /** 名簿一覧から編集に来たときのクエリ（保存後・キャンセルで /members?filter=unassigned 等に戻す） */
  returnSearchParams?: { filter?: string; type?: string };
};

export function EditMemberForm({ memberId, initialUpdatedAt, initial, districts, groups, localities, returnSearchParams }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [furigana, setFurigana] = useState(initial.furigana);
  const [gender, setGender] = useState<"male" | "female">(initial.gender);
  const [isLocal, setIsLocal] = useState(initial.is_local);
  const [districtId, setDistrictId] = useState(initial.district_id);
  const [groupId, setGroupId] = useState<string | null>(initial.group_id ?? null);
  const [districtTier, setDistrictTier] = useState<Tier>(initial.district_tier);
  const [groupTier, setGroupTier] = useState<Tier>(initial.group_tier);
  const [localityId, setLocalityId] = useState(initial.locality_id);
  const [ageGroup, setAgeGroup] = useState<Category | null>(initial.age_group);
  const [isBaptized, setIsBaptized] = useState(initial.is_baptized);
  const [languageMain, setLanguageMain] = useState(initial.language_main);
  const [languageSub, setLanguageSub] = useState(initial.language_sub);
  const initialPeriods = initial.enrollment_periods?.length
    ? initial.enrollment_periods
        .map((p) => ({
          period_no: p.period_no,
          join_date: p.join_date ?? "",
          leave_date: p.leave_date ?? "",
          is_uncertain: p.is_uncertain,
          memo: p.memo ?? "",
        }))
        .sort((a, b) => a.period_no - b.period_no)
    : [
        {
          period_no: 1,
          join_date: initial.local_member_join_date ?? "",
          leave_date: initial.local_member_leave_date ?? "",
          is_uncertain: false,
          memo: "",
        },
      ];
  const [periods, setPeriods] = useState(initialPeriods);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);

  const filteredGroups = districtId ? groups.filter((g) => g.district_id === districtId) : groups;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setConflict(false);
    if (!name.trim()) {
      setError("氏名を入力してください");
      return;
    }
    setLoading(true);
    const result = await updateMemberAction(
      memberId,
      {
        name: name.trim(),
        furigana: furigana.trim() || null,
        gender,
        is_local: isLocal,
        district_id: isLocal ? (districtId || null) : null,
        group_id: isLocal ? groupId : null,
        locality_id: !isLocal ? (localityId || null) : null,
        age_group: ageGroup,
        is_baptized: isBaptized,
        language_main: languageMain || null,
        language_sub: languageSub || null,
        local_member_join_date: periods[0]?.join_date?.trim() || null,
        local_member_leave_date: periods[0]?.leave_date?.trim() || null,
        enrollment_periods: isLocal
          ? periods.map((p, i) => ({
              period_no: i + 1,
              join_date: p.join_date?.trim() || null,
              leave_date: p.leave_date?.trim() || null,
              is_uncertain: p.is_uncertain,
              memo: p.memo?.trim() || null,
            }))
          : undefined,
      },
      initialUpdatedAt
    );
    if (!result.ok) {
      setLoading(false);
      setError(result.error ?? "保存に失敗しました。");
      setConflict(result.conflict ?? false);
      return;
    }
    try {
      if (isLocal) {
        if (initial.district_id) {
          await removeDistrictRegularMember(initial.district_id, memberId);
          await removeDistrictSemiRegularMember(initial.district_id, memberId);
          await removeDistrictPoolMember(initial.district_id, memberId);
        }
        if (districtId) {
          if (districtTier === "regular") await addDistrictRegularMember(districtId, memberId);
          else if (districtTier === "semi") await addDistrictSemiRegularMember(districtId, memberId);
          else if (districtTier === "pool") await addDistrictPoolMember(districtId, memberId);
        }
        if (initial.group_id) {
          await removeGroupRegularMember(initial.group_id, memberId);
          await removeGroupSemiRegularMember(initial.group_id, memberId);
          await removeGroupPoolMember(initial.group_id, memberId);
        }
        if (groupId) {
          if (groupTier === "regular") await addGroupRegularMember(groupId, memberId);
          else if (groupTier === "semi") await addGroupSemiRegularMember(groupId, memberId);
          else if (groupTier === "pool") await addGroupPoolMember(groupId, memberId);
        }
      }
    } finally {
      setLoading(false);
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.members });
    router.push(`/members/${memberId}`);
    // 遷移するため refresh は呼ばない（refresh すると現在ページの再検証で遷移が打ち消される）
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-0.5">氏名 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-0.5">フリガナ</label>
        <input
          type="text"
          value={furigana}
          onChange={(e) => setFurigana(e.target.value)}
          placeholder="カタカナまたはひらがな"
          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm"
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">性別</label>
          <ButtonGroup
            value={gender}
            onChange={setGender}
            options={["male", "female"]}
            getLabel={(v) => (v === "male" ? "男" : "女")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ローカル</label>
          <Toggle
            checked={isLocal}
            onChange={() => {
              setIsLocal((b) => {
                if (b) {
                  setDistrictId("");
                  setGroupId(null);
                } else {
                  setLocalityId("");
                }
                return !b;
              });
            }}
            ariaLabel="ローカル"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">バプテスマ済み（聖徒）</label>
          <Toggle
            checked={isBaptized}
            onChange={() => setIsBaptized((b) => !b)}
            ariaLabel="バプテスマ済み"
          />
        </div>
      </div>
      {isLocal ? (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地区</label>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonGroup
                value={districtId}
                onChange={(v) => {
                  setDistrictId(v);
                  setGroupId(null);
                  setDistrictTier("semi");
                  setGroupTier("semi");
                }}
                options={["", ...districts.map((d) => d.id)]}
                getLabel={(v) => (v ? districts.find((d) => d.id === v)?.name ?? "" : "選択")}
              />
              {districtId ? (
                <select
                  value={districtTier}
                  onChange={(e) => setDistrictTier(e.target.value as Tier)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                  aria-label="地区リスト"
                >
                  <option value="regular">レギュラー</option>
                  <option value="semi">準レギュラー</option>
                  <option value="pool">プール</option>
                </select>
              ) : null}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">小組</label>
            {!districtId ? (
              <p className="text-sm text-slate-500 py-1 min-h-12 flex items-center">地区を選ぶと選択肢が表示されます</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setGroupId(null); setGroupTier("semi"); }}
                    className={`rounded-lg px-2 py-[0.5em] text-sm font-medium transition-colors ${
                      groupId === null
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    無所属
                  </button>
                  {filteredGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setGroupId(g.id);
                        setGroupTier("semi");
                      }}
                      className={`rounded-lg px-2 py-[0.5em] text-sm font-medium transition-colors ${
                        groupId === g.id
                          ? "bg-primary-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
                {groupId ? (
                  <select
                    value={groupTier}
                    onChange={(e) => setGroupTier(e.target.value as Tier)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                    aria-label="小組リスト"
                  >
                    <option value="regular">レギュラー</option>
                    <option value="semi">準レギュラー</option>
                    <option value="pool">プール</option>
                  </select>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">地方</label>
          <select
            value={localityId}
            onChange={(e) => setLocalityId(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm bg-white"
          >
            <option value="">選択</option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">年齢層</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAgeGroup(null)}
            className={`rounded-lg px-2 py-[0.5em] text-sm font-medium transition-colors ${
              ageGroup === null
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            不明
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAgeGroup(c)}
              className={`rounded-lg px-2 py-[0.5em] text-sm font-medium transition-colors ${
                ageGroup === c
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-0.5">主言語</label>
          <select
            value={languageMain}
            onChange={(e) => setLanguageMain(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm bg-white"
            aria-label="主言語"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-0.5">副言語</label>
          <select
            value={languageSub}
            onChange={(e) => setLanguageSub(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm bg-white"
            aria-label="副言語"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isLocal && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">ローカル在籍期間</span>
            <button
              type="button"
              onClick={() =>
                setPeriods((prev) => [
                  ...prev,
                  {
                    period_no: prev.length + 1,
                    join_date: "",
                    leave_date: "",
                    is_uncertain: false,
                    memo: "",
                  },
                ])
              }
              className="text-sm text-primary-600 hover:underline touch-target"
            >
              ローカル在籍期間を追加する
            </button>
          </div>
          {periods.map((p, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">期間{i + 1}</span>
                {periods.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPeriods((prev) => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, period_no: j + 1 })))}
                    className="text-xs text-red-600 hover:underline touch-target"
                  >
                    削除
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">ローカルメンバー転入日</label>
                  <input
                    type="date"
                    value={p.join_date}
                    onChange={(e) =>
                      setPeriods((prev) => prev.map((x, j) => (j === i ? { ...x, join_date: e.target.value } : x)))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">ローカルメンバー転出日</label>
                  <input
                    type="date"
                    value={p.leave_date}
                    onChange={(e) =>
                      setPeriods((prev) => prev.map((x, j) => (j === i ? { ...x, leave_date: e.target.value } : x)))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">メモ</label>
                <input
                  type="text"
                  value={p.memo}
                  onChange={(e) =>
                    setPeriods((prev) => prev.map((x, j) => (j === i ? { ...x, memo: e.target.value } : x)))
                  }
                  placeholder="転入・転出の補足など"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg touch-target text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">期間不確定</span>
                <Toggle
                  checked={p.is_uncertain}
                  onChange={() =>
                    setPeriods((prev) => prev.map((x, j) => (j === i ? { ...x, is_uncertain: !x.is_uncertain } : x)))
                  }
                  ariaLabel="期間不確定"
                />
              </label>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            conflict
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role="alert"
        >
          {conflict && (
            <p className="font-medium mb-1">保存できません（コンフリクト）</p>
          )}
          <p>{error}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 px-3 bg-primary-600 text-white text-sm font-medium rounded-lg touch-target disabled:opacity-50 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          {loading ? "保存中…" : "保存"}
        </button>
        <Link
          href={(() => {
            const q = new URLSearchParams();
            if (returnSearchParams?.filter) q.set("filter", returnSearchParams.filter);
            if (returnSearchParams?.type) q.set("type", returnSearchParams.type);
            return q.toString() ? `/members?${q.toString()}` : `/members/${memberId}`;
          })()}
          className="py-2 px-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg touch-target text-center"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
