"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { unstable_noStore } from "next/cache";
import { CURRENT_LOCALITY_COOKIE_NAME } from "@/lib/localityConstants";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1年

/**
 * 現在の地方 ID を Cookie から取得する（サーバー専用）。
 * 未設定の場合は null。unstable_noStore で RSC キャッシュを無効化し、地方切り替え後に必ず最新の Cookie を読む。
 */
export async function getCurrentLocalityId(): Promise<string | null> {
  unstable_noStore();
  const cookieStore = await cookies();
  return cookieStore.get(CURRENT_LOCALITY_COOKIE_NAME)?.value ?? null;
}

/**
 * 現在の地方を Cookie に保存する Server Action。
 * 地方切り替え UI から呼ぶ。呼び出し後に router.refresh() で再描画すること。
 */
export async function setCurrentLocalityIdAction(localityId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_LOCALITY_COOKIE_NAME, localityId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
