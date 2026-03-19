"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile, getEffectiveCurrentLocalityId, getCachedLocalities } from "@/lib/cachedData";
import type { GlobalRole, LocalRole, Role } from "@/types/database";

type EnsureLocalAdminResult =
  | { ok: true; userId: string; localityId: string; localityName: string | null; isSystemAdmin: boolean }
  | { ok: false; error: string };

async function ensureLocalAdmin(): Promise<EnsureLocalAdminResult> {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) return { ok: false, error: "ログインしてください。" };

  const localityId = await getEffectiveCurrentLocalityId();
  if (!localityId) return { ok: false, error: "地方を特定できませんでした。" };

  const isSystemAdmin = profile?.global_role === "admin";
  if (!isSystemAdmin) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("local_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("locality_id", localityId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role ?? null;
  if (role !== "local_admin") return { ok: false, error: "権限がありません（地方の管理者のみ）。" };
  }

  const localities = await getCachedLocalities();
  const localityName = localities.find((l) => l.id === localityId)?.name ?? null;

  return { ok: true, userId: user.id, localityId, localityName, isSystemAdmin };
}

export type LocalUsersData = {
  localityId: string;
  localityName: string | null;
  users: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: Role | null;
    global_role: GlobalRole | null;
    localRole: LocalRole | null;
  }[];
};

export async function getLocalUsersData(): Promise<{ ok: true; data: LocalUsersData } | { ok: false; error: string }> {
  const auth = await ensureLocalAdmin();
  if (!auth.ok) return auth;

  const supabase = auth.isSystemAdmin ? (() => { try { return createAdminClient(); } catch { return null; } })() : null;
  const client = supabase ?? (await createClient());
  // 表示対象ユーザーは、以下のいずれかで「この地方に関係がある」ものを集める
  // - user_localities にある（アクセス可能地方）
  // - local_roles にある（ローカル権限が付与されている）
  // - profiles.locality_id が一致（従来の「所属地方」）
  const [userLocalitiesRes, localRolesRes, profilesInLocalityRes] = await Promise.all([
    client.from("user_localities").select("user_id").eq("locality_id", auth.localityId).limit(5000),
    client.from("local_roles").select("user_id, role").eq("locality_id", auth.localityId).limit(5000),
    client.from("profiles").select("id").eq("locality_id", auth.localityId).limit(5000),
  ]);

  const userIdsSet = new Set<string>();
  for (const r of (userLocalitiesRes.data ?? []) as { user_id: string }[]) userIdsSet.add(r.user_id);
  for (const r of (localRolesRes.data ?? []) as { user_id: string; role: string }[]) userIdsSet.add(r.user_id);
  for (const r of (profilesInLocalityRes.data ?? []) as { id: string }[]) userIdsSet.add(r.id);

  const userIds = Array.from(userIdsSet);
  if (userIds.length === 0) return { ok: true, data: { localityId: auth.localityId, localityName: auth.localityName, users: [] } };

  const [profilesRes, localRolesForUsersRes] = await Promise.all([
    client.from("profiles").select("id, email, full_name, role, global_role").in("id", userIds),
    client.from("local_roles").select("user_id, role").eq("locality_id", auth.localityId).in("user_id", userIds),
  ]);

  const profiles = (profilesRes.data ?? []) as {
    id: string;
    email: string | null;
    full_name: string | null;
    role: Role | null;
    global_role: GlobalRole | null;
  }[];
  const localRoles = (localRolesForUsersRes.data ?? []) as { user_id: string; role: string }[];
  const roleByUserId = new Map(localRoles.map((r) => [r.user_id, r.role]));

  const users = profiles
    .map((p) => {
      const v = roleByUserId.get(p.id) ?? null;
      const localRole = v === "local_admin" || v === "local_reporter" || v === "local_viewer" ? (v as LocalRole) : null;
      return { ...p, localRole };
    })
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  return { ok: true, data: { localityId: auth.localityId, localityName: auth.localityName, users } };
}

export type InviteLocalUserResult = { ok: true; message: string } | { ok: false; error: string };

export async function inviteLocalUser(email: string, localRole: LocalRole): Promise<InviteLocalUserResult> {
  const auth = await ensureLocalAdmin();
  if (!auth.ok) return auth;

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "メールアドレスを入力してください。" };

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { ok: false, error: "招待機能を使うには SUPABASE_SERVICE_ROLE_KEY を設定してください。" };
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
  });

  if (inviteError) {
    if (inviteError.message.includes("already been registered")) {
      return { ok: false, error: "このメールアドレスは既に登録されています。" };
    }
    return { ok: false, error: inviteError.message };
  }

  const invitedUserId = inviteData?.user?.id;
  if (!invitedUserId) return { ok: false, error: "招待の応答からユーザー ID を取得できませんでした。" };

  // RLS を超える必要があるため、DB更新はサービスロール側で実行
  const { error: profErr } = await adminClient
    .from("profiles")
    .update({ locality_id: auth.localityId })
    .eq("id", invitedUserId);
  if (profErr) return { ok: false, error: `プロフィールの更新に失敗しました: ${profErr.message}` };

  const { error: ulErr } = await adminClient
    .from("user_localities")
    .upsert({ user_id: invitedUserId, locality_id: auth.localityId }, { onConflict: "user_id,locality_id" });
  if (ulErr) return { ok: false, error: `アクセス可能地方の設定に失敗しました: ${ulErr.message}` };

  const { error: lrErr } = await adminClient
    .from("local_roles")
    .upsert({ user_id: invitedUserId, locality_id: auth.localityId, role: localRole }, { onConflict: "user_id,locality_id" });
  if (lrErr) return { ok: false, error: `ローカル権限の設定に失敗しました: ${lrErr.message}` };

  revalidatePath("/settings/local-admin/users");
  revalidatePath("/settings");

  return { ok: true, message: "招待メールを送信しました。ユーザーが登録を完了すると利用可能になります。" };
}

export async function setLocalUserRole(userId: string, localRole: LocalRole | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await ensureLocalAdmin();
  if (!auth.ok) return auth;

  if (!userId) return { ok: false, error: "ユーザーIDが不正です。" };

  const supabase = auth.isSystemAdmin ? (() => { try { return createAdminClient(); } catch { return null; } })() : null;
  const client = supabase ?? (await createClient());

  // まず、そのユーザーがこの地方にアクセス可能であることを担保
  const { error: ulErr } = await client
    .from("user_localities")
    .upsert({ user_id: userId, locality_id: auth.localityId }, { onConflict: "user_id,locality_id" });
  if (ulErr) return { ok: false, error: ulErr.message };

  if (localRole == null) {
    const { error } = await client
      .from("local_roles")
      .delete()
      .eq("user_id", userId)
      .eq("locality_id", auth.localityId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await client
      .from("local_roles")
      .upsert({ user_id: userId, locality_id: auth.localityId, role: localRole }, { onConflict: "user_id,locality_id" });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/settings/local-admin/users");
  return { ok: true };
}

export async function removeLocalUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await ensureLocalAdmin();
  if (!auth.ok) return auth;

  if (!userId) return { ok: false, error: "ユーザーIDが不正です。" };
  if (userId === auth.userId) return { ok: false, error: "自分自身は削除できません。" };

  const supabase = auth.isSystemAdmin ? (() => { try { return createAdminClient(); } catch { return null; } })() : null;
  const client = supabase ?? (await createClient());

  const { error: lrErr } = await client
    .from("local_roles")
    .delete()
    .eq("user_id", userId)
    .eq("locality_id", auth.localityId);
  if (lrErr) return { ok: false, error: lrErr.message };

  const { error: ulErr } = await client
    .from("user_localities")
    .delete()
    .eq("user_id", userId)
    .eq("locality_id", auth.localityId);
  if (ulErr) return { ok: false, error: ulErr.message };

  revalidatePath("/settings/local-admin/users");
  revalidatePath("/settings");
  return { ok: true };
}

