"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithProfile, getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type DeleteToBeDeletedMembersResult =
  | { ok: true }
  | { ok: false; error: string };

type DeletePermissionResult =
  | { ok: true; localityId: string }
  | { ok: false; error: string };

async function ensureDeletePermission(): Promise<DeletePermissionResult> {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) return { ok: false, error: "ログインしてください。" };

  const localityId = await getEffectiveCurrentLocalityId();
  if (!localityId) return { ok: false, error: "地方を特定できませんでした。" };

  if (profile?.global_role === "admin" || profile?.role === "admin" || profile?.role === "co_admin") {
    return { ok: true, localityId };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("local_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("locality_id", localityId)
    .maybeSingle();

  const role = (data as { role?: string } | null)?.role ?? null;
  if (role !== "local_admin") {
    return { ok: false, error: "権限がありません（削除は管理者権限のあるユーザーのみ）。" };
  }

  return { ok: true, localityId };
}

function revalidateRelatedPaths() {
  revalidatePath("/settings");
  revalidatePath("/settings/local-admin/to-be-deleted");
  revalidatePath("/members");
}

async function getDeleteClient() {
  try {
    return createAdminClient();
  } catch {
    return createClient();
  }
}

export async function deleteToBeDeletedMember(memberId: string): Promise<DeleteToBeDeletedMembersResult> {
  const id = memberId.trim();
  if (!id) return { ok: false, error: "メンバーIDが不正です。" };

  const auth = await ensureDeletePermission();
  if (!auth.ok) return auth;

  const supabase = await getDeleteClient();
  const { data, error } = await supabase
    .from("members")
    .delete()
    .eq("id", id)
    .eq("locality_id", auth.localityId)
    .eq("status", "tobedeleted")
    .select("id");

  if (error) return { ok: false, error: error.message };
  if ((data ?? []).length !== 1) {
    return { ok: false, error: "削除対象が見つからないか、削除条件に一致しませんでした。" };
  }

  revalidateRelatedPaths();
  return { ok: true };
}

export async function deleteToBeDeletedMembers(memberIds: string[]): Promise<DeleteToBeDeletedMembersResult> {
  const ids = Array.from(new Set(memberIds.map((id) => id.trim()).filter((id) => id.length > 0)));
  if (ids.length === 0) return { ok: true };

  const auth = await ensureDeletePermission();
  if (!auth.ok) return auth;

  const supabase = await getDeleteClient();
  const { data, error } = await supabase
    .from("members")
    .delete()
    .in("id", ids)
    .eq("locality_id", auth.localityId)
    .eq("status", "tobedeleted")
    .select("id");

  if (error) return { ok: false, error: error.message };
  if ((data ?? []).length !== ids.length) {
    return { ok: false, error: "一部のメンバーを削除できませんでした。画面を再読み込みして再度お試しください。" };
  }

  revalidateRelatedPaths();
  return { ok: true };
}
