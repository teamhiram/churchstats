"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function addDistrictAction(formData: FormData) {
  const localityId = (formData.get("localityId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!localityId || !name) {
    redirect("/settings/organization?add=district&error=" + encodeURIComponent("地方と地区名を入力してください"));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("districts")
    .insert({ locality_id: localityId, name })
    .select("id")
    .single();
  if (error) {
    redirect("/settings/organization?add=district&error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}

export async function updateDistrictAction(formData: FormData) {
  const districtId = (formData.get("districtId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!districtId || !name) {
    redirect("/settings/organization?edit_district=" + encodeURIComponent(districtId || "") + "&error=" + encodeURIComponent("地区名を入力してください"));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("districts")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", districtId);
  if (error) {
    redirect("/settings/organization?edit_district=" + encodeURIComponent(districtId) + "&error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}

export async function addGroupAction(formData: FormData) {
  const districtId = (formData.get("districtId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!districtId || !name) {
    redirect("/settings/organization?add=group&error=" + encodeURIComponent("地区と小組名を入力してください"));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .insert({ district_id: districtId, name })
    .select("id")
    .single();
  if (error) {
    redirect("/settings/organization?add=group&error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}

export async function saveEditGroupAction(formData: FormData) {
  const groupId = (formData.get("groupId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const districtId = (formData.get("districtId") as string)?.trim();
  if (!groupId || !name || !districtId) {
    redirect("/settings/organization?edit=" + encodeURIComponent(groupId || "") + "&error=" + encodeURIComponent("名前と地区を入力してください"));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ name, district_id: districtId, updated_at: new Date().toISOString() })
    .eq("id", groupId);
  if (error) {
    redirect("/settings/organization?edit=" + encodeURIComponent(groupId) + "&error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}

export async function deleteGroupAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "viewer";
  if (role !== "admin" && role !== "co_admin") {
    redirect("/settings/organization?error=" + encodeURIComponent("小組の削除は共同管理者以上のみ可能です。"));
  }

  const groupId = (formData.get("groupId") as string)?.trim();
  const confirmName = (formData.get("confirmName") as string)?.trim();
  if (!groupId) {
    redirect("/settings/organization");
  }
  const { data: group } = await supabase.from("groups").select("name").eq("id", groupId).single();
  if (!group) {
    redirect("/settings/organization?error=" + encodeURIComponent("小組が見つかりません。"));
  }
  const expectedName = (group as { name: string }).name?.trim() ?? "";
  if (confirmName !== expectedName) {
    redirect("/settings/organization?error=" + encodeURIComponent("小組の名前が一致しません。削除するには枠内に小組の名前を正確に入力してください。"));
  }

  await supabase.from("members").update({ group_id: null }).eq("group_id", groupId);
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) {
    redirect("/settings/organization?error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}

export type RegularListItem = { id: string; member_id: string; sort_order: number; name: string };

export async function getDistrictRegularList(districtId: string): Promise<RegularListItem[]> {
  if (!districtId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("district_regular_list")
    .select("id, member_id, sort_order")
    .eq("district_id", districtId)
    .order("sort_order");
  const rows = (data ?? []) as { id: string; member_id: string; sort_order: number }[];
  if (rows.length === 0) return [];
  const memberIds = [...new Set(rows.map((r) => r.member_id))];
  const { data: membersData } = await supabase
    .from("members")
    .select("id, name")
    .in("id", memberIds);
  const nameMap = new Map(((membersData ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name]));
  return rows.map((r) => ({
    id: r.id,
    member_id: r.member_id,
    sort_order: r.sort_order,
    name: nameMap.get(r.member_id) ?? "",
  }));
}

export async function getGroupRegularList(groupId: string): Promise<RegularListItem[]> {
  if (!groupId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_regular_list")
    .select("id, member_id, sort_order")
    .eq("group_id", groupId)
    .order("sort_order");
  const rows = (data ?? []) as { id: string; member_id: string; sort_order: number }[];
  if (rows.length === 0) return [];
  const memberIds = [...new Set(rows.map((r) => r.member_id))];
  const { data: membersData } = await supabase
    .from("members")
    .select("id, name")
    .in("id", memberIds);
  const nameMap = new Map(((membersData ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name]));
  return rows.map((r) => ({
    id: r.id,
    member_id: r.member_id,
    sort_order: r.sort_order,
    name: nameMap.get(r.member_id) ?? "",
  }));
}

export async function addDistrictRegularMember(districtId: string, memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("district_regular_list")
    .select("id")
    .eq("district_id", districtId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (existing) return {};
  const maxOrder = await supabase
    .from("district_regular_list")
    .select("sort_order")
    .eq("district_id", districtId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxOrder.data?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("district_regular_list")
    .insert({ district_id: districtId, member_id: memberId, sort_order: nextOrder });
  return error ? { error: error.message } : {};
}

export async function removeDistrictRegularMember(districtId: string, memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("district_regular_list")
    .delete()
    .eq("district_id", districtId)
    .eq("member_id", memberId);
  return error ? { error: error.message } : {};
}

export async function addGroupRegularMember(groupId: string, memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("group_regular_list")
    .select("id")
    .eq("group_id", groupId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (existing) return {};
  const maxOrder = await supabase
    .from("group_regular_list")
    .select("sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxOrder.data?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("group_regular_list")
    .insert({ group_id: groupId, member_id: memberId, sort_order: nextOrder });
  return error ? { error: error.message } : {};
}

export async function removeGroupRegularMember(groupId: string, memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_regular_list")
    .delete()
    .eq("group_id", groupId)
    .eq("member_id", memberId);
  return error ? { error: error.message } : {};
}

export async function getMembersByDistrict(districtId: string): Promise<{ id: string; name: string }[]> {
  if (!districtId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name")
    .eq("district_id", districtId)
    .order("name");
  return data ?? [];
}

export async function getMembersByGroup(groupId: string): Promise<{ id: string; name: string }[]> {
  if (!groupId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name")
    .eq("group_id", groupId)
    .order("name");
  return data ?? [];
}
