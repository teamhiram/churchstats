import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase の環境変数が未設定です。プロジェクト直下に .env.local を作成し、NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: { path?: string; maxAge?: number; domain?: string; sameSite?: "lax" | "strict" | "none"; secure?: boolean } }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component では set が無視される場合あり
          }
        },
      },
    }
  );
}

/**
 * サービスロールキーを使う管理者用クライアント。
 * 招待メール送信（auth.admin.inviteUserByEmail）など、RLS を超えた操作にのみ使用する。
 * 呼び出し元で「現在のユーザーが global_role = admin であること」を必ず確認してから使用すること。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 管理者用の環境変数が未設定です。SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください（招待機能を使う場合）。"
    );
  }
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
