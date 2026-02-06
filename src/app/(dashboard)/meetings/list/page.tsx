import { createClient } from "@/lib/supabase/server";
import { getListData } from "./actions";
import { MeetingsListPageClient } from "./MeetingsListPageClient";

export default async function MeetingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; locality?: string; localOnly?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Math.min(Math.max(Number(params.year) || currentYear, currentYear - 10), currentYear + 1);
  const localOnly = params.localOnly !== "0";

  const supabase = await createClient();
  const { data: localities } = await supabase
    .from("localities")
    .select("id, name")
    .order("name");

  // クエリに地方がなければアカウントのデフォルト地方を使う
  let defaultLocalityId: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
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
      if (district?.locality_id) defaultLocalityId = district.locality_id;
    }
  }
  const localityId =
    params.locality && params.locality !== "all" ? params.locality : defaultLocalityId;

  const { weeks, absenceAlertWeeks } = await getListData(year, localityId, localOnly);

  return (
    <MeetingsListPageClient
      searchParams={{ year: params.year, locality: params.locality, localOnly: params.localOnly }}
      initialData={{
        year,
        localOnly,
        localityId,
        localities: localities ?? [],
        weeks,
        absenceAlertWeeks,
        currentYear,
      }}
    />
  );
}
