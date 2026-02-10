import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getListData } from "@/app/(dashboard)/meetings/list/actions";
import type { WeekRow } from "@/app/(dashboard)/meetings/list/types";

export type MeetingsListApiResponse = {
  year: number;
  localOnly: boolean;
  localityId: string | null;
  localities: { id: string; name: string }[];
  weeks: WeekRow[];
  absenceAlertWeeks: number;
  currentYear: number;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const currentYear = new Date().getFullYear();
  const yearParam = Number(searchParams.get("year")) || currentYear;
  const year = Math.min(Math.max(yearParam, currentYear - 10), currentYear + 1);
  const localOnly = (searchParams.get("localOnly") ?? "1") !== "0";

  const { data: localities } = await supabase
    .from("localities")
    .select("id, name")
    .order("name");

  // クエリに地方がなければアカウントのデフォルト地方を使う
  let defaultLocalityId: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("main_district_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.main_district_id) {
    const { data: district } = await supabase
      .from("districts")
      .select("locality_id")
      .eq("id", profile.main_district_id)
      .maybeSingle();
    defaultLocalityId = (district as { locality_id?: string } | null)?.locality_id ?? null;
  }

  const localityParam = searchParams.get("locality");
  const localityId =
    localityParam && localityParam !== "all" ? localityParam : defaultLocalityId;

  const { weeks, absenceAlertWeeks } = await getListData(year, localityId, localOnly);

  return NextResponse.json({
    year,
    localOnly,
    localityId,
    localities: localities ?? [],
    weeks,
    absenceAlertWeeks,
    currentYear,
  } satisfies MeetingsListApiResponse);
}

