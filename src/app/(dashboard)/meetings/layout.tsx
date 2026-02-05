import { redirect } from "next/navigation";
import { MeetingTabs } from "./MeetingTabs";
import { MeetingsFilterBar } from "./MeetingsFilterBar";
import { getMeetingsLayoutData } from "@/lib/cachedData";

export default async function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, districts } = await getMeetingsLayoutData();
  if (!user) redirect("/login");

  return (
    <div className="space-y-0">
      <div className="-mx-4 md:-mx-6">
        <MeetingsFilterBar
          districts={districts}
          defaultDistrictId={profile?.main_district_id ?? districts[0]?.id ?? ""}
        />
        <MeetingTabs />
      </div>
      <div className="pt-4 md:pt-6">{children}</div>
    </div>
  );
}
