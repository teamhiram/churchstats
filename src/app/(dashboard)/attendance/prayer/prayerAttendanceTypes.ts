import type { Category } from "@/types/database";

export type District = { id: string; name: string };
export type Group = { id: string; name: string; district_id: string };
export type WeekOption = { value: string; label: string };
export type SortOption = "furigana" | "district" | "group" | "age_group";
export type GroupOption = "district" | "group" | "age_group" | "believer" | "attendance" | "list" | "gojuon";
export type AttendanceChoice = "unrecorded" | "present" | "absent";

export const SORT_LABELS: Record<SortOption, string> = {
  furigana: "フリガナ順",
  district: "地区順",
  group: "小組順",
  age_group: "年齢層順",
};

export const GROUP_LABELS: Record<GroupOption, string> = {
  district: "地区",
  group: "小組",
  age_group: "年齢層",
  believer: "信者",
  attendance: "出欠別",
  list: "リスト別",
  gojuon: "五十音別",
};

export type MemberRow = {
  id: string;
  name: string;
  furigana: string | null;
  district_id: string | null;
  group_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
  local_member_join_date?: string | null;
  local_member_leave_date?: string | null;
  locality_name?: string;
  district_name?: string;
  group_name?: string;
};

export const MEMBERS_SELECT =
  "id, last_name, first_name, last_furigana, first_furigana, district_id, group_id, age_group, is_baptized, local_member_join_date, local_member_leave_date, status";

export type AttendanceRow = {
  id: string;
  member_id: string;
  memo: string | null;
  is_online: boolean | null;
  is_away: boolean | null;
  attended?: boolean;
};

export type Subsection = {
  group2Key: string;
  group2Label: string;
  members: MemberRow[];
};

export type Section = {
  group1Key: string;
  group1Label: string;
  subsections: Subsection[];
};

