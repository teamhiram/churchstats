# テーブル名整理案

現状の命名の揺れを整理し、一貫したルールにそろえるための案です。

---

## 1. 現状のチグハグ

### 1.1 出欠テーブル（同じ概念なのに語尾が違う）

| 現状 | 用途 | 問題 |
|------|------|------|
| `attendance_records` | 主日出欠 | **records** を使っている |
| `group_meeting_attendance` | 小組出欠 | **attendance** を使っている |
| `prayer_meeting_attendance` | 祈りの集会出欠 | **attendance** を使っている |

→ 「出欠」を表すのに `_records` と `_attendance` が混在。

### 1.2 集会定義テーブル（主語の粒度が違う）

| 現状 | 用途 | 問題 |
|------|------|------|
| `meetings` | 主日集会（日付・地区） | 単なる複数形で**種類が分からない** |
| `group_meeting_records` | 小組集会（週単位） | **_records** 付き・「週ごと記録」であることが名前から分かる |
| `prayer_meeting_records` | 祈りの集会（週単位） | 同上 |

→ 主日だけ `meetings`、他は `*_meeting_records` で、パターンが違う。

### 1.3 レギュラーリスト系（スコープと語尾がバラバラ）

| 現状 | スコープ | 問題 |
|------|----------|------|
| `regular_member_list_items` | 集会単位（meeting_id） | **items** かつ **regular_member** という名前で「主日」が伝わらない |
| `district_regular_list` | 地区 | **_list** のみ（items なし） |
| `group_regular_list` | 小組 | 同上 |
| `district_semi_regular_list` | 地区 | 同上 |
| `group_semi_regular_list` | 小組 | 同上 |
| `district_pool_list` | 地区 | 同上 |
| `group_pool_list` | 小組 | 同上 |

→ 主日だけ `*_list_items`、地区・小組は `*_list`。また「主日」が名前に出てこない。

---

## 2. 命名ルール案（整理後の原則）

- **出欠**: 種別を揃える。`{集会種別}_attendance` に統一するか、`{集会種別}_attendance_records` に統一するか。
- **集会定義**: `{集会種別}_meetings` または `{集会種別}_meeting_records` のどちらかに揃える。
- **リスト**: `{スコープ}_{リスト種別}_list` を基本形にし、集会単位だけ「その集会のリスト項目」なので `_list_entries` などで区別する。

---

## 4. 整理案 B：一貫した命名にそろえる（推奨案）

**方針**: 集会種別を前に出し、パターンを `{集会種別}_{概念}` に統一する。

### 4.1 集会定義

| 現状 | 案 B | 備考 |
|------|------|------|
| `meetings` | `lordsday_meeting_records` | 主日集会であることが名前で分かる。 |
| `group_meeting_records` | `group_meetings` | 現状でも「小組・週ごと記録」と解釈しやすいので、変更なしでも可。 |
| `prayer_meeting_records` | `prayer_meetings` | 同上。 |

### 4.2 出欠

| 現状 | 案 B | 備考 |
|------|------|------|
| `attendance_records` | `lordsday_meeting_attendance` | 主日 + 出欠で一貫。FK は `meeting_id` のまま（参照先を `lordsday_meeting_records` にすれば意味も一致）。 |
| `group_meeting_attendance` | 変更なし | すでに `group_meeting_*` で揃っている。 |
| `prayer_meeting_attendance` | 変更なし | 同上。 |

### 4.3 レギュラー・準レギュラー・プールリスト

| 現状 | 案 B | 備考 |
|------|------|------|
| `regular_member_list_items` | `lordsday_regular_list` | 主日・集会ごとの「レギュラーリスト」であることが分かる。 |
| `district_regular_list` | 変更なし | `district_*` / `group_*` で既に揃っている。 |
| `group_regular_list` | 変更なし | 同上 |
| その他 `district_*_list` / `group_*_list` | 変更なし | 同上 |

---

## 5. 案 B の新旧対応表（リネームする場合）

| 現状 | 案 B（新名） |
|------|----------------|
| `meetings` | `lordsday_meeting_records` |
| `attendance_records` | `lordsday_meeting_attendance` |
| `regular_member_list_items` | `lordsday_regular_list` |
| `group_meeting_records` | （変更なし） |
| `group_meeting_attendance` | （変更なし）|
| `prayer_meeting_records` | （変更なし） |
| `prayer_meeting_attendance` | （変更なし） |
| `district_regular_list` 他 | （変更なし） |

※ 変更するのは **主日まわり 3 テーブル** のみ。小組・祈り・リスト系は現状のまま。

---

## 6. 実装の進め方

### 6.1 リネームをやる場合

1. **DB**: マイグレーションで `ALTER TABLE ... RENAME TO ...` を実行。  
   - 必要なら一時的に `CREATE VIEW 旧名 AS SELECT * FROM 新名` で互換をとる（Supabase の外部参照がある場合は要確認）。
2. **型**: `src/types/database.ts` の型名・コメントを新テーブル名に合わせる。
3. **コード**: `*.from("旧名")` をすべて `*.from("新名")` に置換。  
   - 対象: `attendance_records` → 多数、`meetings` → 多数、`regular_member_list_items` → 複数。
4. **定数**: `DEBUG_TABLE_NAMES` などテーブル名リストを更新。
5. **RLS**: ポリシーはテーブルに紐づくので、リネームでそのまま移る。

### 6.2 リネームをやらない場合（ドキュメントのみ）

- 上記「現状のチグハグ」と「推奨する呼び方」を `docs/attendance-related-tables.md` や開発者向け README に追記する。
- 新規テーブルを足すときだけ、案 B のルール（`{種別}_{概念}`）に従う。

---

## 7. 推奨

- **短期**: リネームは行わず、**ドキュメントで「出欠まわりは attendance_records / *_attendance の2パターンがある」と明記**する。  
- **中期**: 新機能で新テーブルを増やすときは、**案 B のルール**（`lordsday_*`, `group_meeting_*`, `prayer_meeting_*`, `district_*_list`）に合わせる。
- **長期**: メジャーリリースやデータ移行のタイミングで、**主日 3 テーブルだけ** `lordsday_meeting_records` / `lordsday_meeting_attendance` / `lordsday_regular_list` へのリネームを検討する。

これで「テーブル名がチグハグ」な理由と、どこをどう揃えるかの整理案が一通りそろいます。
