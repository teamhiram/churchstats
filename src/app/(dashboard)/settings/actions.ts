"use server";

import { revalidateTag } from "next/cache";
import { revalidatePath } from "next/cache";
import { CACHE_TAG } from "@/lib/cachedData";

/** キャッシュを無効化し、次回表示時に最新データを再取得する */
export async function revalidateCache(): Promise<void> {
  revalidateTag(CACHE_TAG, "max");
  revalidatePath("/", "layout");
}
