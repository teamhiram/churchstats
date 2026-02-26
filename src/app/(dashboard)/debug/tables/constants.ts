/** デバッグで参照可能なテーブル一覧（スキーマと一致）。クライアント・サーバー共通 */
export const DEBUG_TABLE_NAMES = [
  "localities",
  "districts",
  "groups",
  "lordsday_meeting_records",
  "members",
  "lordsday_regular_list",
  "lordsday_meeting_attendance",
  "profiles",
  "reporter_districts",
  "attribute_histories",
  "system_settings",
  "audit_logs",
  "login_logs",
  "organic_dispatch_records",
  "group_meeting_records",
  "group_meeting_attendance",
  "prayer_meeting_records",
  "prayer_meeting_attendance",
  "district_regular_list",
  "group_regular_list",
] as const;

export type DebugTableName = (typeof DEBUG_TABLE_NAMES)[number];
