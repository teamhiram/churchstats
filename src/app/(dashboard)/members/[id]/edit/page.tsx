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

  const { data: periods } = await supabase
    .from("member_local_enrollment_periods")
    .select("period_no, join_date, leave_date, is_uncertain, memo")
    .eq("member_id", id)
    .order("period_no");
  const enrollmentPeriods = (periods ?? []).map((p) => ({
    period_no: p.period_no,
    join_date: (p as { join_date?: string | null }).join_date ?? null,
    leave_date: (p as { leave_date?: string | null }).leave_date ?? null,
    is_uncertain: Boolean((p as { is_uncertain?: boolean }).is_uncertain),
    memo: (p as { memo?: string | null }).memo ?? null,
  }));

  let districtTier: "regular" | "semi" | "pool" = "semi";
  let groupTier: "regular" | "semi" | "pool" = "semi";
  if (member.district_id) {
    const [dr, ds, dp] = await Promise.all([
      supabase.from("district_regular_list").select("id").eq("district_id", member.district_id).eq("member_id", id).maybeSingle(),
      supabase.from("district_semi_regular_list").select("id").eq("district_id", member.district_id).eq("member_id", id).maybeSingle(),
      supabase.from("district_pool_list").select("id").eq("district_id", member.district_id).eq("member_id", id).maybeSingle(),
    ]);
    if (dr.data) districtTier = "regular";
    else if (ds.data) districtTier = "semi";
    else if (dp.data) districtTier = "pool";
  }
  if (member.group_id) {
    const [gr, gs, gp] = await Promise.all([
      supabase.from("group_regular_list").select("id").eq("group_id", member.group_id).eq("member_id", id).maybeSingle(),
      supabase.from("group_semi_regular_list").select("id").eq("group_id", member.group_id).eq("member_id", id).maybeSingle(),
      supabase.from("group_pool_list").select("id").eq("group_id", member.group_id).eq("member_id", id).maybeSingle(),
    ]);
    if (gr.data) groupTier = "regular";
    else if (gs.data) groupTier = "semi";
    else if (gp.data) groupTier = "pool";
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

  const ALLOWED_LANGUAGES = new Set(["Japanese", "English", "Chinese", "Spanish", "French"]);
  const rawMain = (member as { language_main?: string | null }).language_main;
  const rawSub = (member as { language_sub?: string | null }).language_sub;
  const language_main = rawMain && ALLOWED_LANGUAGES.has(rawMain) ? rawMain : "";
  const language_sub = rawSub && ALLOWED_LANGUAGES.has(rawSub) ? rawSub : "";

  return (
    <div className="space-y-3 max-w-lg">
      <Link
        href={search.filter || search.type ? membersListHref : `/members/${id}`}
        className="text-slate-600 hover:text-slate-800 text-sm"
      >
        {search.filter || search.type ? "← 名簿に戻る" : "← メンバー詳細"}
      </Link>
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
          district_tier: districtTier,
          group_tier: groupTier,
          locality_id: String((member as { locality_id?: string | null }).locality_id ?? ""),
          age_group: (member.age_group ?? (member as { current_category?: Category | null }).current_category ?? null) as Category | null,
          is_baptized: Boolean(member.is_baptized),
          language_main,
          language_sub,
          local_member_join_date: (member as { local_member_join_date?: string | null }).local_member_join_date ?? null,
          local_member_leave_date: (member as { local_member_leave_date?: string | null }).local_member_leave_date ?? null,
          enrollment_periods: enrollmentPeriods.length > 0 ? enrollmentPeriods : undefined,
        }}
        districts={districts ?? []}
        groups={groups ?? []}
        localities={localities}
      />
    </div>
  );
}
