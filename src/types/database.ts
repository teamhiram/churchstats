/** spec5 に基づく型定義 */

export type Role = "admin" | "co_admin" | "reporter" | "viewer";

/** 多地方: グローバル権限（profiles.global_role） */
export type GlobalRole = "admin" | "national_viewer" | "regional_viewer";

/** 多地方: ローカル権限（local_roles.role） */
export type LocalRole = "local_admin" | "local_reporter" | "local_viewer";

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
  /** 多地方: 都道府県。地域(area)は prefecture.area_id から導出。030 で追加、032 で area_id 削除。 */
  prefecture_id?: string | null;
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

/** 主日集会（日付・地区）。テーブル名: lordsday_meeting_records */
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
  /** ローカルメンバー転入日：この日以降、在籍期間内 */
  local_member_join_date?: string | null;
  /** ローカルメンバー転出日：この日以降、在籍期間外 */
  local_member_leave_date?: string | null;
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

/** 主日集会のレギュラーリスト項目。テーブル名: lordsday_regular_list */
export interface RegularMemberListItem {
  id: string;
  meeting_id: string;
  member_id: string;
  sort_order: number;
}

/** 主日集会出欠。テーブル名: lordsday_meeting_attendance */
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
  /** 出欠フラグ。false = 欠席（メモのみ）。マイグレーション 014 で追加 */
  attended?: boolean;
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
  /** 訪問者（名簿メンバーIDの配列）。複数選択可。 */
  visitor_ids?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

/** 小組集会記録（小組・週ごと。週はアメリカ式・日曜日を week_start とする） */
export interface GroupMeetingRecord {
  id: string;
  group_id: string;
  week_start: string;
  event_date: string | null;
  name: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 小組集会出欠 */
export interface GroupMeetingAttendance {
  id: string;
  group_meeting_record_id: string;
  member_id: string;
  memo: string | null;
  /** 出欠フラグ。false = 欠席（メモのみ）。マイグレーション 014 で追加 */
  attended?: boolean;
  reported_by_user_id: string | null;
  created_at?: string;
}

export const DISPATCH_TYPE_LABELS: Record<DispatchType, string> = {
  message: "メッセージ",
  phone: "電話",
  in_person: "対面",
};

/** 派遣種別ごとのスクエア・ラベル色（全サイト共通）。メッセージ＝最も薄い、電話＝少し薄い、対面＝濃い紫 */
export const DISPATCH_TYPE_SQUARE_COLORS: Record<DispatchType, { square: string; border: string }> = {
  message: { square: "bg-violet-200", border: "border-violet-200" },
  phone: { square: "bg-violet-300", border: "border-violet-300" },
  in_person: { square: "bg-violet-500", border: "border-violet-500" },
};

/** 派遣種別のラベル用テキスト色（スクエアと同じ濃さの系統） */
export const DISPATCH_TYPE_TEXT_COLORS: Record<DispatchType, string> = {
  message: "text-violet-500",
  phone: "text-violet-600",
  in_person: "text-violet-700",
};

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
  /** 多地方: グローバル権限。null = ローカル権限のみ。027 で追加 */
  global_role?: GlobalRole | null;
  full_name: string | null;
  main_district_id: string | null;
  /** サイト初回表示のデフォルト地方。040 で追加 */
  locality_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReporterDistrict {
  id: string;
  user_id: string;
  district_id: string;
}

/** 多地方: 地域（関東・関西など）。027 で追加 */
export interface Area {
  id: string;
  name: string;
  sort_order?: number | null;
}

/** 多地方: 都道府県。地域(area)に属する。030 で追加 */
export interface Prefecture {
  id: string;
  name: string;
  area_id: string;
  sort_order?: number | null;
}

/** 多地方: ユーザーがアクセス可能な地方。027 で追加 */
export interface UserLocality {
  user_id: string;
  locality_id: string;
}

/** 多地方: 地域閲覧者が閲覧可能な地域。027 で追加 */
export interface UserArea {
  user_id: string;
  area_id: string;
}

/** 多地方: 地方ごとのローカル役割。027 で追加 */
export interface LocalRoleRow {
  user_id: string;
  locality_id: string;
  role: LocalRole;
}

/** 多地方: 同一人物紐づけ（管理者表示用のみ）。027 で追加 */
export interface MemberLink {
  id: string;
  member_id_a: string;
  member_id_b: string;
  created_at?: string;
  created_by_user_id?: string | null;
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

export const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  admin: "システム管理者",
  national_viewer: "全国閲覧者",
  regional_viewer: "地域閲覧者",
};

export const LOCAL_ROLE_LABELS: Record<LocalRole, string> = {
  local_admin: "管理者（その地方）",
  local_reporter: "報告者（その地方）",
  local_viewer: "閲覧者（その地方）",
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  main: "主日集会",
  group: "小組集会",
};
