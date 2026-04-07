export type SundayOptionalColumnKey = "online" | "away";

export type SundayOptionalColumnVisibility = Record<SundayOptionalColumnKey, boolean>;

export function getSundayOptionalColumnVisibility(input: {
  showLordsDayOnlineColumn: boolean;
  showLordsDayAwayColumn: boolean;
}): SundayOptionalColumnVisibility {
  return {
    online: input.showLordsDayOnlineColumn,
    away: input.showLordsDayAwayColumn,
  };
}

export function getSundayAttendanceColSpans(params: {
  isEditMode: boolean;
  visibility: SundayOptionalColumnVisibility;
}): {
  optionalVisibleColumnCount: number;
  tableColumnSpan: number;
  memoColumnSpan: number;
} {
  const optionalVisibleColumnCount = Number(params.visibility.online) + Number(params.visibility.away);
  return {
    optionalVisibleColumnCount,
    tableColumnSpan: (params.isEditMode ? 4 : 3) + optionalVisibleColumnCount,
    memoColumnSpan: 4 + optionalVisibleColumnCount,
  };
}

