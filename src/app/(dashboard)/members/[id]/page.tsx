import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("*").eq("id", id).single();
  if (!member) notFound();

  const { data: district } = member.district_id
    ? await supabase.from("districts").select("id, name").eq("id", member.district_id).single()
    : { data: null };
  const { data: group } = member.group_id
    ? await supabase.from("groups").select("id, name").eq("id", member.group_id).single()
    : { data: null };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/members" className="text-slate-600 hover:text-slate-800 text-sm">
        ← 名簿管理
      </Link>
      <div className="bg-white rounded-lg border border-slate-200 p-2 space-y-2">
        <h1 className="text-xl font-bold text-slate-800">{member.name}</h1>
        {member.furigana && (
          <p className="text-sm text-slate-500">{member.furigana}</p>
        )}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">性別</dt>
          <dd className="text-slate-800">{member.gender === "male" ? "男" : "女"}</dd>
          <dt className="text-slate-500">ローカル/ゲスト</dt>
          <dd className="text-slate-800">{member.is_local ? "ローカル" : "ゲスト"}</dd>
          <dt className="text-slate-500">地区</dt>
          <dd className="text-slate-800">{district?.name ?? "—"}</dd>
          <dt className="text-slate-500">小組</dt>
          <dd className="text-slate-800">{group?.name ?? (member.is_local ? "未所属" : "—")}</dd>
          <dt className="text-slate-500">区分</dt>
          <dd className="text-slate-800">{member.age_group ? CATEGORY_LABELS[member.age_group as Category] : "—"}</dd>
          <dt className="text-slate-500">聖徒/友人</dt>
          <dd className="text-slate-800">{member.is_baptized ? "聖徒" : "友人"}</dd>
        </dl>
      </div>
      <div>
        <Link
          href={`/members/${id}/edit`}
          className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg touch-target"
        >
          編集
        </Link>
      </div>
    </div>
  );
}
