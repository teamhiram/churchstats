import { redirect } from "next/navigation";
import { ClientAttendanceLayout } from "./ClientAttendanceLayout";
import { getMeetingsLayoutData } from "@/lib/cachedData";

export default async function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, districts, defaultDistrictId, currentLocalityId } = await getMeetingsLayoutData();
  if (!user) redirect("/login");

  return (
    <div className="space-y-0" key={currentLocalityId ?? "all"}>
      <ClientAttendanceLayout districts={districts} defaultDistrictId={defaultDistrictId}>
        {children}
      </ClientAttendanceLayout>
    </div>
  );
}
