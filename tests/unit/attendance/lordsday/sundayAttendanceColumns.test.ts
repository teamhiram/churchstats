import { describe, expect, it } from "vitest";
import {
  getSundayAttendanceColSpans,
  getSundayOptionalColumnVisibility,
} from "@/app/(dashboard)/attendance/lordsday/sundayAttendanceColumns";

describe("sundayAttendanceColumns", () => {
  it("表示設定から optional 列の表示状態を返す", () => {
    expect(
      getSundayOptionalColumnVisibility({
        showLordsDayOnlineColumn: true,
        showLordsDayAwayColumn: false,
      })
    ).toEqual({ online: true, away: false });
  });

  it("閲覧モード/記録モードで colSpan を正しく計算する", () => {
    const viewMode = getSundayAttendanceColSpans({
      isEditMode: false,
      visibility: { online: true, away: false },
    });
    expect(viewMode).toEqual({
      optionalVisibleColumnCount: 1,
      tableColumnSpan: 4,
      memoColumnSpan: 5,
    });

    const editMode = getSundayAttendanceColSpans({
      isEditMode: true,
      visibility: { online: true, away: true },
    });
    expect(editMode).toEqual({
      optionalVisibleColumnCount: 2,
      tableColumnSpan: 6,
      memoColumnSpan: 6,
    });
  });
});
