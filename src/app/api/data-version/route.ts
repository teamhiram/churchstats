import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** キャッシュ無効化用。各テーブルの「最も新しい updated_at」を返す。裏で定期的に叩き、変更があればクライアントが再取得する。 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membersRes = await supabase
    .from("members")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const members = (membersRes.data as { updated_at?: string } | null)?.updated_at ?? null;

  const [districtsRes, groupsRes] = await Promise.all([
    supabase.from("districts").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("groups").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const districts = districtsRes.error ? null : (districtsRes.data as { updated_at?: string } | null)?.updated_at ?? null;
  const groups = groupsRes.error ? null : (groupsRes.data as { updated_at?: string } | null)?.updated_at ?? null;

  const version = [members, districts, groups].filter(Boolean).join("_") || "0";

  return NextResponse.json({
    version,
    members,
    districts,
    groups,
  });
}
