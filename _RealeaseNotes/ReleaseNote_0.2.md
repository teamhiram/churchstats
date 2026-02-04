# ChurchStats v0.2

開発終了時間　2026/02/05 1:23

## 本バージョンでの追加・変更内容

### 枠組設定画面の改定

- **対象画面:** 枠組設定（`/settings/organization`）
- **画面名・ナビゲーション:**
  - 「組織設定」を「枠組設定」に変更。サイドメニューに「枠組設定」を追加し、当画面へ直接遷移。
  - 設定画面（`/settings`）から枠組設定のセクション（説明＋「枠組設定を開く」リンク）を削除。
  - 枠組設定画面の「← 設定」リンクを削除。
- **地方:**
  - ユーザーに紐づく地方が複数ある場合はドロップダウンで選択。1件の場合はテキスト表示のみ。
- **地区:**
  - 選択中の地方に属する地区を一覧表示。赤い「＋」ボタンで地区追加モーダルを表示（`?add=district`）。
  - 一覧の各地区に「編集」リンク（`?edit_district=地区ID`）。クリックでインライン編集フォーム（地区名・保存・キャンセル）を表示。保存は Server Action `updateDistrictAction` で `districts.name` を更新。
  - 説明文：「一覧の『編集』で地区名を変更できます。」
- **小組:**
  - 地区ごとにセクション分けして表示（地区名を見出しに、その下に小組一覧）。
  - 赤い「＋」ボタンで小組追加モーダル（`?add=group`）。地区・小組名を入力し Server Action `addGroupAction` で追加。
  - 各小組に「編集」「削除」を表示。「編集」はリンク（`?edit=グループID`）で、クリックでインライン編集フォーム（小組名・所属地区・保存・キャンセル）。保存は `saveEditGroupAction` で `groups` の `name` と `district_id` を更新。
  - 削除は Server Action `deleteGroupAction`（所属メンバーの `group_id` を `null` にしてから小組を削除）。
  - 説明文：「一覧の『編集』で名前・所属地区を変更、『削除』で小組を削除できます（メンバーは無所属に移ります）。」
- **技術メモ:** 追加・編集・削除はすべて Server Action とフォームの `action` で実施（クライアント JS のクリックハンドラに依存しない）。エラー時は `?error=...` 等のクエリでメッセージを表示。

### members テーブル変更対応

- **DB 変更に伴うプログラム対応:**
  - 項目 **vital_group_member_ids** を削除（型定義・参照箇所を削除）。
  - 項目 **current_category** を **age_group** に変更（区分・年齢層の意味は同じ。型は `Category | null` のまま）。
- **対応箇所:** `src/types/database.ts`（Member 型）、名簿一覧・メンバー詳細・メンバー編集・メンバー新規追加、集会出欠（出欠登録・表示）の各画面で `age_group` に統一。

### メンバー追加画面の仕様変更

- **「バプテスマ済み（聖徒）」:** 初期値をチェック入り（`isBaptized` のデフォルトを `true`）に変更。
- **追加後の遷移:** メンバー追加後はメンバー詳細ではなく **名簿一覧（`/members`）** に戻るように変更。

### 白画面対策・表示の安定化

- **ルート・ダッシュボード:** Supabase 等のエラーをすべて catch し、`throw` しない。エラー時はメッセージを表示する画面を返す。
- **インラインスタイル:** ルートレイアウトの body、ルートページ・ダッシュボードレイアウト・global-error の主要ブロックにインラインスタイルを追加し、CSS 未読込時も背景・文字色が表示されるようにした。
- **ルートレイアウト:** 白画面の切り分けのため、GlobalErrorHandler を外し、`body` に `{children}` のみを表示する構成に変更。
- **テスト用ページ:** 白画面の切り分け用に `/test` を追加（静的表示のみ。本番では削除可）。

### パフォーマンス

- **統計ページ:** `StatisticsCharts`（recharts・html-to-image）を `next/dynamic` で遅延読み込み。クライアント用ラッパー `StatisticsChartsDynamic` で `ssr: false` を指定し、統計ページ表示時のみチャート用ライブラリをロード。
- **next.config:** `experimental.optimizePackageImports: ["date-fns", "recharts"]` を追加。

### Vercel デプロイ

- **`.vercelignore` を追加。** `_Archives` と `_RealeaseNotes` を指定し、GitHub にはプッシュするが Vercel のビルド・デプロイには含めないようにした。アーカイブ・リリースノートはリポジトリで管理しつつ、本番ビルドの対象外とする。

---

## データベース（マイグレーション）

v0.2 で適用するマイグレーションは以下のとおり。**001 実行済みの環境**では 002 から順に SQL Editor で実行する。

| ファイル | 内容 |
|----------|------|
| `002_attendance_memo_and_organic_dispatch.sql` | 出欠メモ（`attendance_records.memo`）、有機的派遣用 enum・テーブル（`organic_dispatch_records`）、RLS |
| `003_attendance_is_online.sql` | 出欠に「オンライン」フラグ（`attendance_records.is_online`）追加 |
| `004_members_furigana_gender.sql` | メンバーにフリガナ（`furigana`）追加。`current_category` → `age_group` リネーム（存在時）。性別を male/female のみに変更 |
| `005_members_locality_id.sql` | メンバーに地方（`locality_id`）追加。複数地方の初期データ挿入 |
| `006_category_child_to_preschool.sql` | 年齢層「子供」(child) を「未就学児」(preschool) に enum 変更 |
| `007_attendance_is_away.sql` | 出欠に「他地方で出席」フラグ（`attendance_records.is_away`）追加 |

---

## 起動手順（v0.2）

- **新規セットアップ:** ReleaseNote_0.1 の手順に続き、上記 002〜007 を順に実行する。
- **環境変数・アプリ起動:** v0.1 と同様（`.env.local` に Supabase URL と anon key → `npm run dev`）。

---

## トラブルシューティング（v0.2）

v0.2 で発生した不具合・対処は **Troubleshooting_0.2.md** に記録している。

- 小組編集機能実装後の白画面、環境変数未設定時の白画面
- 小組「編集」ボタン無反応 → URL クエリ（`?edit=...`）での編集に変更
- 編集モードでテキストフィールドに元の値が表示されない → 表示・保存時のフォールバックで対応

---

## 未実装・今後の拡張（v0.1 からの更新）

- **メンバー編集画面**（`/members/[id]/edit`）は v0.1 時点で未実装だったが、v0.2 ではフォーム実装済み。`age_group` 等の項目に対応。
- v0.1 の「未実装・今後の拡張候補」のうち、以下は引き続き未実装：レギュラーメンバーリストの並び順選択、同日・別地区への同一メンバー登録アラート、名簿統合・遡り修正、年度更新（進級一括更新）、初回ログイン通知・パスワード再送、監査ログ・ログインログの閲覧 UI、バイタルグループのグラフィックビューなど。

---

## 今後の記録方針

- 不具合・現象の記録 → **Troubleshooting_0.1.md** / **Troubleshooting_0.2.md**（現象・原因・対処法・対処結果）
- 機能追加・変更の記録 → 当該バージョンの **ReleaseNote_0.x.md**
