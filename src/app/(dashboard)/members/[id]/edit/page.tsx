import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Category } from "@/types/database";
import { EditMemberForm } from "./EditMemberForm";

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; type?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("*").eq("id", id).single();
  if (!member) notFound();

  let isDistrictRegular = false;
  let isGroupRegular = false;
  if (member.district_id) {
    const { data: dr } = await supabase
      .from("district_regular_list")
      .select("id")
      .eq("district_id", member.district_id)
      .eq("member_id", id)
      .maybeSingle();
    isDistrictRegular = !!dr;
  }
  if (member.group_id) {
    const { data: gr } = await supabase
      .from("group_regular_list")
      .select("id")
      .eq("group_id", member.group_id)
      .eq("member_id", id)
      .maybeSingle();
    isGroupRegular = !!gr;
  }

  const LOCALITY_NAMES = [
    "札幌", "仙台", "新庄", "酒田", "下妻", "つくば", "北本", "川口", "さいたま", "千葉",
    "習志野", "成田", "市川", "市原", "松戸", "東京", "西東京", "調布", "小平", "町田",
    "八王子", "日野", "横浜", "小田原", "藤沢", "相模原", "富山", "新潟", "静岡", "掛川",
    "岐阜", "名古屋", "豊川", "鈴鹿", "大阪", "東大阪", "京都", "神戸", "奈良", "広島",
    "徳島", "北九州", "福岡", "那覇",
  ];
  const { data: districts } = await supabase.from("districts").select("id, name").order("name");
  const { data: groups } = await supabase.from("groups").select("id, name, district_id").order("name");
  const { data: localitiesRaw } = await supabase.from("localities").select("id, name");
  const byName = new Map((localitiesRaw ?? []).map((l) => [l.name, l]));
  const localities = LOCALITY_NAMES.map((n) => byName.get(n)).filter(Boolean) as { id: string; name: string }[];

  const membersListHref = (() => {
    const params = new URLSearchParams();
    if (search.filter) params.set("filter", search.filter);
    if (search.type) params.set("type", search.type);
    const q = params.toString() ? `?${params.toString()}` : "";
    return `/members${q}`;
  })();

  return (
    <div className="space-y-3 max-w-lg">
      <Link
        href={search.filter || search.type ? membersListHref : `/members/${id}`}
        className="text-slate-600 hover:text-slate-800 text-sm"
      >
        {search.filter || search.type ? "← 名簿に戻る" : "← メンバー詳細"}
      </Link>
      <h1 className="text-xl font-bold text-slate-800">メンバーを編集</h1>
      <EditMemberForm
        memberId={id}
        returnSearchParams={search.filter || search.type ? search : undefined}
        initialUpdatedAt={(member as { updated_at?: string }).updated_at ?? null}
        initial={{
          name: String(member.name ?? ""),
          furigana: String(member.furigana ?? ""),
          gender: (member.gender === "female" ? "female" : "male") as "male" | "female",
          is_local: Boolean(member.is_local),
          district_id: String(member.district_id ?? ""),
          group_id: member.group_id ?? null,
          is_district_regular: isDistrictRegular,
          is_group_regular: isGroupRegular,
          locality_id: String((member as { locality_id?: string | null }).locality_id ?? ""),
          age_group: (member.age_group ?? (member as { current_category?: Category | null }).current_category ?? null) as Category | null,
          is_baptized: Boolean(member.is_baptized),
        }}
        districts={districts ?? []}
        groups={groups ?? []}
        localities={localities}
      />
    </div>
  );
}
