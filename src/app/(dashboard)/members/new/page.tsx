"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { hiraganaToKatakana } from "@/lib/furigana";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";
import { addDistrictRegularMember, addGroupRegularMember } from "@/app/(dashboard)/settings/organization/actions";
import { QUERY_KEYS } from "@/lib/queryClient";

const CATEGORIES: Category[] = ["adult", "university", "high_school", "junior_high", "elementary", "preschool"];

/** ローカルでないメンバーの「地方」選択肢（表示順） */
const LOCALITY_NAMES = [
  "札幌", "仙台", "新庄", "酒田", "下妻", "つくば", "北本", "川口", "さいたま", "千葉",
  "習志野", "成田", "市川", "市原", "松戸", "東京", "西東京", "調布", "小平", "町田",
  "八王子", "日野", "横浜", "小田原", "藤沢", "相模原", "富山", "新潟", "静岡", "掛川",
  "岐阜", "名古屋", "豊川", "鈴鹿", "大阪", "東大阪", "京都", "神戸", "奈良", "広島",
  "徳島", "北九州", "福岡", "那覇",
];

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

export default function NewMemberPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; district_id: string }[]>([]);
  const [localities, setLocalities] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [furigana, setFurigana] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [isLocal, setIsLocal] = useState(true);
  const [districtId, setDistrictId] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isDistrictRegular, setIsDistrictRegular] = useState(false);
  const [isGroupRegular, setIsGroupRegular] = useState(false);
  const [localityId, setLocalityId] = useState("");
  const [ageGroup, setAgeGroup] = useState<Category | null>(null);
  const [isBaptized, setIsBaptized] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("districts").select("id, name").then(({ data }) => setDistricts(data ?? []));
    supabase.from("groups").select("id, name, district_id").then(({ data }) => setGroups(data ?? []));
    supabase.from("localities").select("id, name").then(({ data }) => {
      const all = data ?? [];
      const byName = new Map(all.map((l) => [l.name, l]));
      const ordered = LOCALITY_NAMES.map((n) => byName.get(n)).filter(Boolean) as { id: string; name: string }[];
      setLocalities(ordered);
    });
  }, []);

  const filteredGroups = districtId ? groups.filter((g) => g.district_id === districtId) : [];

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
    const { data: inserted, error: err } = await supabase
      .from("members")
      .insert({
        name: name.trim(),
        furigana: furiganaValue ? hiraganaToKatakana(furiganaValue) : null,
        gender,
        is_local: isLocal,
        district_id: isLocal ? (districtId || null) : null,
        group_id: isLocal ? (groupId ?? null) : null,
        locality_id: !isLocal ? (localityId || null) : null,
        age_group: ageGroup,
        is_baptized: isBaptized,
      })
      .select("id")
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const newId = (inserted as { id: string } | null)?.id;
    if (newId && isLocal) {
      if (districtId && isDistrictRegular) await addDistrictRegularMember(districtId, newId);
      if (groupId && isGroupRegular) await addGroupRegularMember(groupId, newId);
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.members });
    router.push("/members");
    router.refresh();
  };

  return (
    <div className="space-y-3 max-w-lg">
      <Link href="/members" className="text-slate-600 hover:text-slate-800 text-sm">
        ← 名簿管理
      </Link>
      <h1 className="text-xl font-bold text-slate-800">メンバーを追加</h1>
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
              <div className="flex flex-wrap items-center gap-2">
                <ButtonGroup
                  value={districtId}
                  onChange={(v) => {
                    setDistrictId(v);
                    setGroupId(null);
                  }}
                  options={["", ...districts.map((d) => d.id)]}
                  getLabel={(v) => (v ? districts.find((d) => d.id === v)?.name ?? "" : "選択")}
                />
                {districtId ? (
                  <>
                    <span className="text-slate-500 text-sm">レギュラー</span>
                    <Toggle
                      checked={isDistrictRegular}
                      onChange={() => setIsDistrictRegular((b) => !b)}
                      ariaLabel="地区レギュラー"
                    />
                  </>
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
                  {groupId ? (
                    <>
                      <span className="text-slate-500 text-sm">レギュラー</span>
                      <Toggle
                        checked={isGroupRegular}
                        onChange={() => setIsGroupRegular((b) => !b)}
                        ariaLabel="小組レギュラー"
                      />
                    </>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-3 bg-slate-600 text-white text-sm font-medium rounded-lg touch-target disabled:opacity-50 hover:bg-slate-700"
        >
          {loading ? "登録中…" : "登録"}
        </button>
      </form>
    </div>
  );
}
