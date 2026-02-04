/** spec5 に基づく型定義 */

export type Role = "admin" | "co_admin" | "reporter" | "viewer";

export type MeetingType = "main" | "group"; // 主日 / 小組

export type Category =
  | "adult"
  | "university"
  | "high_school"
  | "junior_high"
  | "elementary"
  | "preschool";

export type BaptismDatePrecision = "exact" | "unknown" | "approximate";

export type AttributeHistoryType = "category" | "baptism";

export interface Locality {
  id: string;
  name: string;
}

export interface District {
  id: string;
  locality_id: string;
  name: string;
}

export interface Group {
  id: string;
  district_id: string;
  name: string;
}

export interface Meeting {
  id: string;
  event_date: string;
  meeting_type: MeetingType;
  district_id: string | null;
  group_id: string | null;
  name: string;
  created_at?: string;
}

export interface Member {
  id: string;
  name: string;
  furigana: string | null;
  gender: "male" | "female";
  is_local: boolean;
  district_id: string | null;
  group_id: string | null;
  locality_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
  baptism_year: number | null;
  baptism_month: number | null;
  baptism_day: number | null;
  baptism_date_precision: BaptismDatePrecision | null;
  language_main: string | null;
  language_sub: string | null;
  follower_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RegularMemberListItem {
  id: string;
  meeting_id: string;
  member_id: string;
  sort_order: number;
}

export interface AttendanceRecord {
  id: string;
  meeting_id: string;
  member_id: string;
  recorded_category: Category | null;
  recorded_is_baptized: boolean | null;
  district_id: string | null;
  group_id: string | null;
  memo: string | null;
  is_online: boolean | null;
  is_away: boolean | null;
  reported_by_user_id?: string | null;
  created_at?: string;
}

export type DispatchType = "message" | "phone" | "in_person";

export interface OrganicDispatchRecord {
  id: string;
  member_id: string;
  group_id: string;
  week_start: string;
  dispatch_type: DispatchType | null;
  dispatch_date: string | null;
  dispatch_memo: string | null;
  created_at?: string;
  updated_at?: string;
}

export const DISPATCH_TYPE_LABELS: Record<DispatchType, string> = {
  message: "メッセージ",
  phone: "電話",
  in_person: "対面",
};

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
  full_name: string | null;
  main_district_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReporterDistrict {
  id: string;
  user_id: string;
  district_id: string;
}

export interface AttributeHistory {
  id: string;
  member_id: string;
  attribute_type: AttributeHistoryType;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string | number | boolean | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface LoginLog {
  id: string;
  user_id: string;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  adult: "大人",
  university: "大学生",
  high_school: "高校生",
  junior_high: "中学生",
  elementary: "小学生",
  preschool: "未就学児",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理者",
  co_admin: "共同管理者",
  reporter: "報告者",
  viewer: "閲覧者",
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  main: "主日集会",
  group: "小組集会",
};
