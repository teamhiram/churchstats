"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { hiraganaToKatakana } from "@/lib/furigana";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

const CATEGORIES: Category[] = ["adult", "university", "high_school", "junior_high", "elementary", "preschool"];

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: { checked: boolean; onChange: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
        checked ? "bg-primary-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

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

type Props = {
  memberId: string;
  initial: {
    name: string;
    furigana: string;
    gender: "male" | "female";
    is_local: boolean;
    district_id: string;
    group_id: string | null;
    locality_id: string;
    age_group: Category | null;
    is_baptized: boolean;
  };
  districts: { id: string; name: string }[];
  groups: { id: string; name: string; district_id: string }[];
  localities: { id: string; name: string }[];
};

export function EditMemberForm({ memberId, initial, districts, groups, localities }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [furigana, setFurigana] = useState(initial.furigana);
  const [gender, setGender] = useState<"male" | "female">(initial.gender);
  const [isLocal, setIsLocal] = useState(initial.is_local);
  const [districtId, setDistrictId] = useState(initial.district_id);
  const [groupId, setGroupId] = useState<string | null>(initial.group_id ?? null);
  const [localityId, setLocalityId] = useState(initial.locality_id);
  const [ageGroup, setAgeGroup] = useState<Category | null>(initial.age_group);
  const [isBaptized, setIsBaptized] = useState(initial.is_baptized);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredGroups = districtId ? groups.filter((g) => g.district_id === districtId) : groups;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("氏名を入力してください");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const furiganaValue = furigana.trim() || null;
    const { error: err } = await supabase
      .from("members")
      .update({
        name: name.trim(),
        furigana: furiganaValue ? hiraganaToKatakana(furiganaValue) : null,
        gender,
        is_local: isLocal,
        district_id: isLocal ? (districtId || null) : null,
        group_id: isLocal ? groupId : null,
        locality_id: !isLocal ? (localityId || null) : null,
        age_group: ageGroup,
        is_baptized: isBaptized,
      })
      .eq("id", memberId);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/members");
    router.refresh();
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">性別</label>
        <ButtonGroup
          value={gender}
          onChange={setGender}
          options={["male", "female"]}
          getLabel={(v) => (v === "male" ? "男" : "女")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
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
            <ButtonGroup
              value={districtId}
              onChange={(v) => {
                setDistrictId(v);
                setGroupId(null);
              }}
              options={["", ...districts.map((d) => d.id)]}
              getLabel={(v) => (v ? districts.find((d) => d.id === v)?.name ?? "" : "選択")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">小組</label>
            {!districtId ? (
              <p className="text-sm text-slate-500 py-1 min-h-12 flex items-center">地区を選ぶと選択肢が表示されます</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setGroupId(null)}
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
                    onClick={() => setGroupId(g.id)}
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm font-medium rounded-lg touch-target disabled:opacity-50 hover:bg-slate-700"
        >
          {loading ? "保存中…" : "保存"}
        </button>
        <Link
          href={`/members/${memberId}`}
          className="py-2 px-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg touch-target text-center"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
