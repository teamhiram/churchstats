---
name: 複数回派遣・フォーム改善
overview: 派遣記録を「1週1件」から「1週複数件」にし、マトリクス・派遣回数表示を複数レコード対応にする。個人ページの対象週廃止・日付ピッカーは v0.22.0 で実装済み。
todos: []
isProject: false
---

# 複数回派遣対応・派遣記録フォーム改善 プラン

## 前提

- **DB**: 1派遣 = 1レコードのまま。同じ (member_id, group_id, week_start) で複数行を許すため UNIQUE 制約のみ削除する。
- **派遣回数**: レコード数でカウントする。
- **マトリクスメモ**: 同一週の複数メモは改行＋仕切り線で連結して表示。スクエア色は「濃い方優先」（対面 > 電話 > メッセージ）。

---

## 1. DB マイグレーション

**新規ファイル**: `supabase/migrations/0XX_organic_dispatch_allow_multiple_per_week.sql`

- `organic_dispatch_records` の `UNIQUE(member_id, group_id, week_start)` を削除する。
- PostgreSQL の制約名は通常 `organic_dispatch_records_member_id_group_id_week_start_key`。未確定なら `\d organic_dispatch_records` または `information_schema.table_constraints` で確認してから DROP する。
- 例:  
  `ALTER TABLE organic_dispatch_records DROP CONSTRAINT IF EXISTS organic_dispatch_records_member_id_group_id_week_start_key;`

参照: [supabase/migrations/002_attendance_memo_and_organic_dispatch.sql](supabase/migrations/002_attendance_memo_and_organic_dispatch.sql) 24行目で定義されている UNIQUE。

---

## 2. 派遣回数 = レコード数

**対象**: [src/app/(dashboard)/dashboard/attendanceMatrixActions.ts](src/app/(dashboard)/dashboard/attendanceMatrixActions.ts)

- **getMemberLifeOverview**（538行付近）:
  - 現在: 集計対象週のうち `dispatch[ws] === true` の週数を `dispatchCount` にしている（708–713行）。
  - 変更: 集計対象週に含まれる「完了している派遣レコード」の件数にする。  
    例: `dispatchCount = completeDispatches.filter((d) => inScopeWeekStarts.includes(d.week_start)).length`  
    （`completeDispatches` は既存の filter 済み配列。集計対象は `inScopeWeekStarts`。）

集会一覧の週別派遣件数（[meetings/list/actions.ts](src/app/(dashboard)/meetings/list/actions.ts) 240–246行）は既にレコード単位で加算しているため変更不要。

---

## 3. 個人出欠マトリクス: 複数メモ・色

**対象**: [src/app/(dashboard)/dashboard/attendanceMatrixActions.ts](src/app/(dashboard)/dashboard/attendanceMatrixActions.ts) の `getMemberAttendanceMatrixData`

- **dispatchMemos**（520–527行）:
  - 現在: `dispatchMemos[d.week_start] = (d.dispatch_memo as string).trim()` で上書きし、1週1文字列。
  - 変更: 同一 `week_start` の複数レコードの `dispatch_memo` を集約する。  
    順序は `dispatch_date` 昇順など一貫した並びにし、区切りは改行＋仕切り線（例: `"\n---\n"` または `"\n―――\n"`）で連結した 1 文字列を `dispatchMemos[week_start]` に代入する。型は `Record<string, string>` のまま。

- **dispatchTypes**（スクエア色）:
  - 現在: 同じ週の最後のレコードの `dispatch_type` で上書き。
  - 変更: その週の complete レコードの `dispatch_type` のうち、**濃い方優先**で 1 つ採用する。  
    優先順位: `in_person` > `phone` > `message`（[DISPATCH_TYPE_SQUARE_COLORS](src/types/database.ts) の violet-500 / 300 / 200 に相当）。  
    例: 週ごとに `["message","phone","in_person"].find(t => その週に type === t のレコードがある)` の逆順で「一番濃い type」を選ぶ。

**表示側**: [MemberAttendanceMatrix.tsx](src/app/(dashboard)/members/[id]/MemberAttendanceMatrix.tsx) はツールチップで `tooltipState.memo` を `whitespace-pre-wrap` で表示しているため、改行と仕切り線はそのまま表示される。変更不要でよい。

---

## 4. 集会画面（有機的派遣フォーム）の扱い

- **現状**: [OrganicDispatchForm.tsx](src/app/(dashboard)/meetings/organic/OrganicDispatchForm.tsx) は `dispatchMap: Map<string, DispatchRow>` で「1メンバー1レコード」前提。同一週に複数レコードがあると取得時の `map.set(r.member_id, r)` で上書きされ、最後の1件しか表示されない。
- **本プラン**: 個人ページとマトリクス・派遣回数の変更を先行して完了させる。集会画面の「1メンバー複数レコード」対応（`Map<string, DispatchRow[]>` 化と UI のリスト表示・追加・編集・削除）は **別タスク / 別 PR** とする。DB 制約削除後は集会画面では「同じ週に同じメンバーで2件以上登録すると一覧では1件しか見えない」状態が残るが、データは正しく保存され、個人ページ・マトリクス・派遣回数では複数件が反映される。

---

## 5. 実装順序の提案

1. マイグレーション作成・適用（UNIQUE 削除）
2. `attendanceMatrixActions.ts`: `getMemberLifeOverview` の `dispatchCount` をレコード数に変更、`getMemberAttendanceMatrixData` の `dispatchMemos` 集約と `dispatchTypes` の濃い方優先
3. 集会画面の「1メンバー複数レコード」対応は別タスクのまま

---

## 6. 既知の不具合（次に修正）

**1) 個人ページの派遣記録編集で日付が更新されない**

- **現象**: 派遣記録の編集モーダルで日付を変更して「更新」しても、エラーは出ないが日付が保存されない（一覧に反映されない）。出欠→有機的派遣の編集モーダルも同じ。
- **経緯**: クライアントの Supabase update → `.select().single()` で「Cannot coerce...」→ `.select()` を外すと「変更後の週に同じ小組の記録が…」→ メッセージを整理して Server Action（`dispatchActions.ts` の `updateDispatchRecordAction`）に移行したが、まだ日付は更新されない。
- **次回対応**: 更新が 0 件になっている原因（RLS・セッション・カラム指定など）を切り分けし、日付が確実に persist するように修正する。

**2) 個人ページの個人出欠マトリクス：派遣回数集計が誤る**

- **現象**: マトリクスのスクエア表示は正常だが、上部の「派遣回数」の集計が正しくない。例: 実際は 3 回あるのに 0 回と表示される。
- **次回対応**: 派遣回数をレコード数で集計するよう修正する（本プラン「2. 派遣回数 = レコード数」の対象と同じ。`getMemberLifeOverview` の `dispatchCount` をレコード数ベースに変更）。

---

## 7. 確認・テスト観点

- 同一メンバー・同一小組・同一週で 2 件以上 insert できること
- 個人ページの「派遣回数」がレコード数になっていること（例: 2週で各2件なら 4 回）
- 個人出欠マトリクスで、同一週に複数メモがあるセルでツールチップが「メモ1 --- メモ2」のように改行と仕切り線で表示されること
- 同一週にメッセージと対面がある場合、スクエア色が対面（濃い紫）になること
