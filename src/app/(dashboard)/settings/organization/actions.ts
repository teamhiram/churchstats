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
    .update({ name })
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
    .update({ name, district_id: districtId })
    .eq("id", groupId);
  if (error) {
    redirect("/settings/organization?edit=" + encodeURIComponent(groupId) + "&error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}

export async function deleteGroupAction(formData: FormData) {
  const groupId = (formData.get("groupId") as string)?.trim();
  if (!groupId) {
    redirect("/settings/organization");
  }
  const supabase = await createClient();
  await supabase.from("members").update({ group_id: null }).eq("group_id", groupId);
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) {
    redirect("/settings/organization?error=" + encodeURIComponent(error.message));
  }
  redirect("/settings/organization");
}
