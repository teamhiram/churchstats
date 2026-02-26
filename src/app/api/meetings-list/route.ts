import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import { getListData } from "@/app/(dashboard)/meetings/list/actions";
import type { WeekRow } from "@/app/(dashboard)/meetings/list/types";

export type MeetingsListApiResponse = {
  year: number;
  localOnly: boolean;
  localityId: string | null;
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

  const localityId = await getEffectiveCurrentLocalityId();
  const { weeks, absenceAlertWeeks } = await getListData(year, localityId, localOnly);

  return NextResponse.json({
    year,
    localOnly,
    localityId,
    weeks,
    absenceAlertWeeks,
    currentYear,
  } satisfies MeetingsListApiResponse);
}

