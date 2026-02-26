# 出欠記録関連テーブル一覧

churchstats において「出欠記録」と関連するテーブルを、役割別に整理した一覧です。

---

## 1. 出欠記録の本体（3種類）

| テーブル | 用途 | 紐づき先 | 主なカラム |
|----------|------|----------|-------------|
| **`attendance_records`** | 主日集会の出欠 | `meetings.id` | `meeting_id`, `member_id`, `attended`, `recorded_category`, `recorded_is_baptized`, `memo`, `is_online`, `is_away`, `reported_by_user_id` |
| **`group_meeting_attendance`** | 小組集会の出欠 | `group_meeting_records.id` | `group_meeting_record_id`, `member_id`, `attended`, `memo`, `reported_by_user_id` |
| **`prayer_meeting_attendance`** | 祈りの集会の出欠 | `prayer_meeting_records.id` | `prayer_meeting_record_id`, `member_id`, `attended`, `memo`, `is_online`, `is_away`, `reported_by_user_id` |

- いずれも **`attended`**（true=出席 / false=欠席・メモのみ）で出欠を判定。
- ダッシュボードの出欠マトリクス・個人出欠マトリクスは、上記3テーブルを横断して集計している。

---

## 2. 集会・記録の定義（出欠の「どの集会か」を表す）

| テーブル | 用途 | 備考 |
|----------|------|------|
| **`meetings`** | 主日集会の定義（日付・地区など） | `attendance_records.meeting_id` が参照。`meeting_type` は `main` / `group`（小組は現在は `group_meeting_records` 側で管理）。 |
| **`group_meeting_records`** | 小組集会の「週ごと」記録 | 小組・`week_start` 単位。`group_meeting_attendance` の親。 |
| **`prayer_meeting_records`** | 祈りの集会の「週ごと」記録 | 地区・`week_start` 単位。`prayer_meeting_attendance` の親。 |

---

## 3. 誰の出欠か（名簿・組織）

| テーブル | 用途 |
|----------|------|
| **`members`** | メンバー名簿。全出欠記録の `member_id` がここを参照。 |
| **`groups`** | 小組。小組集会・小組レギュラーリストの単位。 |
| **`districts`** | 地区。主日・祈りの集会・地区レギュラーリストの単位。 |
| **`localities`** |  locality（例：調布）。組織の上位単位。 |

---

## 4. レギュラーリスト（欠席者判定・名簿の母集団）

「誰がレギュラーか」を定義し、出欠集計・欠席アラート・派遣モニターの基準になる。

| テーブル | 用途 |
|----------|------|
| **`regular_member_list_items`** | 主日「その集会」のレギュラーリスト（`meetings.id` 単位）。 |
| **`district_regular_list`** | 地区のレギュラーリスト（主日のレギュラー出席者を地区単位で定義）。 |
| **`group_regular_list`** | 小組のレギュラーリスト（小組のレギュラー出席者を小組単位で定義）。 |
| **`district_semi_regular_list`** | 地区の準レギュラーリスト。 |
| **`group_semi_regular_list`** | 小組の準レギュラーリスト。 |

※ プールリスト用の `district_pool_list` / `group_pool_list` は 022 で追加されている場合あり。

---

## 5. その他（出欠と間接的に関連）

| テーブル | 関連の内容 |
|----------|------------|
| **`profiles`** | 報告者情報。出欠の `reported_by_user_id` が `auth.users` 経由で紐づく。 |
| **`reporter_districts`** | 報告者が編集できる地区。出欠入力権限の範囲に関係。 |
| **`organic_dispatch_records`** | オーガニック派遣記録。欠席者フォロー・訪問者管理で出欠と文脈がつながる。 |

---

## 関係のイメージ（簡略）

```
【主日】
  meetings ← attendance_records → members
  district_regular_list → members（レギュラー定義）
  regular_member_list_items → meetings + members（集会別レギュラー）

【小組】
  group_meeting_records ← group_meeting_attendance → members
  groups → group_meeting_records
  group_regular_list → members

【祈りの集会】
  prayer_meeting_records ← prayer_meeting_attendance → members
  districts → prayer_meeting_records
```

---

## まとめ

- **出欠データそのもの**: `attendance_records`, `group_meeting_attendance`, `prayer_meeting_attendance` の3テーブル。
- **どの集会か**: `meetings`, `group_meeting_records`, `prayer_meeting_records`。
- **誰か**: `members`。組織は `groups`, `districts`, `localities`。
- **欠席者判定の母集団**: `regular_member_list_items`, `district_regular_list`, `group_regular_list` および準レギュラー・プールリスト。

---

## 6. DB 上の地方（locality）による区別

**DB は地方ごとにデータを区別している。**

| 対象 | 区別の仕方 |
|------|------------|
| **地区** | `districts.locality_id` で地方に属する。 |
| **主日集会記録** | `lordsday_meeting_records`（旧 `meetings`）の `district_id` で地区→地方、合同集会時は `locality_id` で地方を直接指定。 |
| **小組・祈り** | `group_meeting_records` は group → district → locality。`prayer_meeting_records` は district → locality。 |
| **名簿** | `members.locality_id`（null=ゲスト）。 |
| **RLS** | 028 で各テーブルが「アクセス可能な locality」のみ見えるようにポリシー設定済み。 |

アプリ側では「現在の地方」を Cookie で保持し、出欠登録・名簿・枠組などはその地方の districts のみ表示。URL に他地方の `district_id` が残っている場合は採用せず、現在地方の default にフォールバックする（`effectiveDistrictIdForCurrentLocality`）。
