export type WeekRow = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  mainCount: number;
  prayerCount: number;
  groupCount: number;
  dispatchCount: number;
};

export type WeekDetail = {
  mainAttendees: { memberId: string; name: string }[];
  mainAbsent: { memberId: string; name: string; memo: string | null }[];
  prayerAttendees: { memberId: string; name: string }[];
  groupAttendees: { memberId: string; name: string }[];
  dispatchNames: { memberId: string; name: string }[];
};
