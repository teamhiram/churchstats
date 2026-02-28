"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import type { GlobalRole, LocalRole } from "@/types/database";

/** global_role = admin でない場合は null を返す。ロール管理の Server Action で使用。 */
async function ensureGlobalAdmin() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user || profile?.global_role !== "admin") return null;
  return { user, profile };
}

export type InviteResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * メールでユーザーを招待する。global admin のみ。
 * 招待後、profiles に global_role 等を設定し、必要なら user_localities / local_roles を挿入する。
 */
export async function inviteUser(
  email: string,
  options?: {
    globalRole?: GlobalRole | null;
    localityIds?: string[];
    localRoleByLocality?: Record<string, LocalRole>;
    areaIds?: string[];
    defaultLocalityId?: string | null;
  }
): Promise<InviteResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

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
  if (!invitedUserId) {
    return { ok: false, error: "招待の応答からユーザー ID を取得できませんでした。" };
  }

  const supabase = await createClient();

  if (options?.globalRole) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ global_role: options.globalRole })
      .eq("id", invitedUserId);
    if (updateError) {
      return { ok: false, error: `プロフィールの更新に失敗しました: ${updateError.message}` };
    }
  }

  if (options?.defaultLocalityId != null) {
    const { error: locError } = await supabase
      .from("profiles")
      .update({ locality_id: options.defaultLocalityId })
      .eq("id", invitedUserId);
    if (locError) {
      return { ok: false, error: `デフォルト表示地方の設定に失敗しました: ${locError.message}` };
    }
    // ローカル権限ユーザーが getCachedLocalities でその地方だけ見えるように、user_localities にも追加
    const { error: ulErr } = await supabase
      .from("user_localities")
      .upsert({ user_id: invitedUserId, locality_id: options.defaultLocalityId }, { onConflict: "user_id,locality_id" });
    if (ulErr) {
      return { ok: false, error: `アクセス可能地方の設定に失敗しました: ${ulErr.message}` };
    }
  }

  if (options?.globalRole === "regional_viewer" && options?.areaIds?.length) {
    for (const areaId of options.areaIds) {
      const { error: e } = await supabase.from("user_areas").insert({ user_id: invitedUserId, area_id: areaId });
      if (e) return { ok: false, error: `地域の設定に失敗しました: ${e.message}` };
    }
  }

  if (options?.localityIds?.length) {
    for (const localityId of options.localityIds) {
      const { error: e } = await supabase.from("user_localities").insert({ user_id: invitedUserId, locality_id: localityId });
      if (e) return { ok: false, error: `アクセス可能地方の設定に失敗しました: ${e.message}` };
    }
  }

  if (options?.localRoleByLocality && Object.keys(options.localRoleByLocality).length > 0) {
    for (const [localityId, role] of Object.entries(options.localRoleByLocality)) {
      const { error: e } = await supabase
        .from("local_roles")
        .upsert({ user_id: invitedUserId, locality_id: localityId, role }, { onConflict: "user_id,locality_id" });
      if (e) return { ok: false, error: `ローカル権限の設定に失敗しました: ${e.message}` };
    }
  }

  revalidatePath("/settings/roles");
  revalidatePath("/settings");
  return { ok: true, message: "招待メールを送信しました。ユーザーがメール内のリンクから登録を完了すると利用可能になります。" };
}

const MIN_PASSWORD_LENGTH = 6;

/**
 * メール・パスワード・氏名を指定してユーザーを直接作成する。global admin のみ。
 * 招待メールは送らず、その場でログイン可能なアカウントが作成される。
 */
export async function createUserDirect(
  email: string,
  password: string,
  fullName?: string | null,
  options?: {
    globalRole?: GlobalRole | null;
    localityIds?: string[];
    localRoleByLocality?: Record<string, LocalRole>;
    areaIds?: string[];
    defaultLocalityId?: string | null;
  }
): Promise<InviteResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "メールアドレスを入力してください。" };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。` };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { ok: false, error: "直接作成機能を使うには SUPABASE_SERVICE_ROLE_KEY を設定してください。" };
  }

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (createError) {
    if (createError.message.includes("already been registered")) {
      return { ok: false, error: "このメールアドレスは既に登録されています。" };
    }
    return { ok: false, error: createError.message };
  }

  const createdUserId = createData?.user?.id;
  if (!createdUserId) {
    return { ok: false, error: "ユーザー作成の応答から ID を取得できませんでした。" };
  }

  const supabase = await createClient();

  if (options?.globalRole) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ global_role: options.globalRole })
      .eq("id", createdUserId);
    if (updateError) {
      return { ok: false, error: `プロフィールの更新に失敗しました: ${updateError.message}` };
    }
  }

  if (options?.defaultLocalityId != null) {
    const { error: locError } = await supabase
      .from("profiles")
      .update({ locality_id: options.defaultLocalityId })
      .eq("id", createdUserId);
    if (locError) {
      return { ok: false, error: `デフォルト表示地方の設定に失敗しました: ${locError.message}` };
    }
    // ローカル権限ユーザーが getCachedLocalities でその地方だけ見えるように、user_localities にも追加
    const { error: ulErr } = await supabase
      .from("user_localities")
      .upsert({ user_id: createdUserId, locality_id: options.defaultLocalityId }, { onConflict: "user_id,locality_id" });
    if (ulErr) {
      return { ok: false, error: `アクセス可能地方の設定に失敗しました: ${ulErr.message}` };
    }
  }

  if (options?.globalRole === "regional_viewer" && options?.areaIds?.length) {
    for (const areaId of options.areaIds) {
      const { error: e } = await supabase.from("user_areas").insert({ user_id: createdUserId, area_id: areaId });
      if (e) return { ok: false, error: `地域の設定に失敗しました: ${e.message}` };
    }
  }

  if (options?.localityIds?.length) {
    for (const localityId of options.localityIds) {
      const { error: e } = await supabase.from("user_localities").insert({ user_id: createdUserId, locality_id: localityId });
      if (e) return { ok: false, error: `アクセス可能地方の設定に失敗しました: ${e.message}` };
    }
  }

  if (options?.localRoleByLocality && Object.keys(options.localRoleByLocality).length > 0) {
    for (const [localityId, role] of Object.entries(options.localRoleByLocality)) {
      const { error: e } = await supabase
        .from("local_roles")
        .upsert({ user_id: createdUserId, locality_id: localityId, role }, { onConflict: "user_id,locality_id" });
      if (e) return { ok: false, error: `ローカル権限の設定に失敗しました: ${e.message}` };
    }
  }

  revalidatePath("/settings/roles");
  revalidatePath("/settings");
  return { ok: true, message: "ユーザーを作成しました。このアカウントでログインできます。" };
}

export type UpdateGlobalRoleResult = { ok: true } | { ok: false; error: string };

export async function updateUserGlobalRole(userId: string, globalRole: GlobalRole | null): Promise<UpdateGlobalRoleResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ global_role: globalRole }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function updateProfileLocalityId(userId: string, localityId: string | null): Promise<UpdateGlobalRoleResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ locality_id: localityId }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function setUserAreas(userId: string, areaIds: string[]): Promise<UpdateGlobalRoleResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

  const supabase = await createClient();
  const { error: delError } = await supabase.from("user_areas").delete().eq("user_id", userId);
  if (delError) return { ok: false, error: delError.message };
  for (const areaId of areaIds) {
    const { error: e } = await supabase.from("user_areas").insert({ user_id: userId, area_id: areaId });
    if (e) return { ok: false, error: e.message };
  }
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function setUserLocalities(userId: string, localityIds: string[]): Promise<UpdateGlobalRoleResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

  const supabase = await createClient();
  const { error: delError } = await supabase.from("user_localities").delete().eq("user_id", userId);
  if (delError) return { ok: false, error: delError.message };
  for (const localityId of localityIds) {
    const { error: e } = await supabase.from("user_localities").insert({ user_id: userId, locality_id: localityId });
    if (e) return { ok: false, error: e.message };
  }
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function setUserLocalRoles(
  userId: string,
  entries: { localityId: string; role: LocalRole }[]
): Promise<UpdateGlobalRoleResult> {
  const auth = await ensureGlobalAdmin();
  if (!auth) return { ok: false, error: "権限がありません。" };

  const supabase = await createClient();
  const { error: delError } = await supabase.from("local_roles").delete().eq("user_id", userId);
  if (delError) return { ok: false, error: delError.message };
  for (const { localityId, role } of entries) {
    const { error: e } = await supabase.from("local_roles").insert({ user_id: userId, locality_id: localityId, role });
    if (e) return { ok: false, error: e.message };
  }
  revalidatePath("/settings/roles");
  return { ok: true };
}
