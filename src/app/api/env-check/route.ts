import { NextResponse } from "next/server";

/**
 * 診断用: Vercel で環境変数が読めているか確認する。
 * 本番で /api/env-check にアクセスして確認後、このファイルは削除してよい。
 */
export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: hasUrl ? "set" : "missing",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: hasKey ? "set" : "missing",
    ok: hasUrl && hasKey,
  });
}
