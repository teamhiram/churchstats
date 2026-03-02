"use client";

import { MeetingsFilterBar } from "./MeetingsFilterBar";
import { MeetingTabs } from "./MeetingTabs";
import { AttendanceEditModeProvider, useAttendanceEditMode } from "./AttendanceEditModeContext";

type District = { id: string; name: string };

function AttendanceLayoutInner({
  districts,
  defaultDistrictId,
  children,
}: {
  districts: District[];
  defaultDistrictId: string;
  children: React.ReactNode;
}) {
  const { editMode } = useAttendanceEditMode();
  return (
    <>
      <div className="-mx-4 md:-mx-6">
        <MeetingsFilterBar
          districts={districts}
          defaultDistrictId={defaultDistrictId}
          disabled={editMode}
        />
        <MeetingTabs />
      </div>
      <div className="pt-4 md:pt-6 pb-8 md:pb-10">{children}</div>
    </>
  );
}

export function ClientAttendanceLayout({
  districts,
  defaultDistrictId,
  children,
}: {
  districts: District[];
  defaultDistrictId: string;
  children: React.ReactNode;
}) {
  return (
    <AttendanceEditModeProvider>
      <AttendanceLayoutInner districts={districts} defaultDistrictId={defaultDistrictId}>
        {children}
      </AttendanceLayoutInner>
    </AttendanceEditModeProvider>
  );
}
