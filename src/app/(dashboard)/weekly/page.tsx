import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile, getEffectiveCurrentLocalityId } from "@/lib/cachedData";
import { getListData } from "./actions";
import { MeetingsListPageClient } from "./MeetingsListPageClient";

export default async function MeetingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; localOnly?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Math.min(Math.max(Number(params.year) || currentYear, currentYear - 10), currentYear + 1);
  const localOnly = params.localOnly !== "0";

  const localityId = await getEffectiveCurrentLocalityId();
  const { weeks, absenceAlertWeeks } = await getListData(year, localityId, localOnly);

  return (
    <MeetingsListPageClient
      searchParams={{ year: params.year, localOnly: params.localOnly }}
      initialData={{
        year,
        localOnly,
        localityId,
        weeks,
        absenceAlertWeeks,
        currentYear,
      }}
    />
  );
}
