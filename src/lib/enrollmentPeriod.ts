/**
 * Phase 2 / Phase 6: 在籍期間の管理
 * ローカルメンバー転入日・転出日（または複数期間）に基づき、指定日時点で在籍期間内かどうかを判定する
 */

export type EnrollmentPeriod = {
  join_date: string | null;
  leave_date: string | null;
};

type MemberWithEnrollmentDates = {
  local_member_join_date?: string | null;
  local_member_leave_date?: string | null;
  enrollment_periods?: EnrollmentPeriod[] | null;
};

function isInPeriod(join: string | null, leave: string | null, eventDate: string): boolean {
  if (join && eventDate < join) return false; // 転入前
  if (leave && eventDate > leave) return false; // 転出後
  return true;
}

/**
 * 指定日（eventDate: YYYY-MM-DD）時点で、メンバーが在籍期間内かどうかを判定する
 * - enrollment_periods が存在する場合: いずれかの期間に eventDate が含まれれば在籍
 * - 従来の local_member_join_date / local_member_leave_date でも判定（後方互換）
 * - join_date が NULL の場合は在籍扱い（転入日未設定＝従来通り）
 */
export function isInEnrollmentPeriod(
  member: MemberWithEnrollmentDates,
  eventDate: string
): boolean {
  const periods = member.enrollment_periods;
  if (periods && periods.length > 0) {
    return periods.some((p) => isInPeriod(p.join_date, p.leave_date, eventDate));
  }
  const join = member.local_member_join_date;
  const leave = member.local_member_leave_date;
  return isInPeriod(join ?? null, leave ?? null, eventDate);
}
