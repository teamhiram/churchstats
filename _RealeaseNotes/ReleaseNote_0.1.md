ChurchStats v 0.1

開発開始日時
2026/02/04 13:10
まずは手動で下書き（spec1.md）を作成し、ChatGPTのちCursorと相談して、spec5.mdを作成。
これを元にシステムを構築してもらった。
15:05 からCursorによる実装が開始された。
15:17 "ビルドは成功しました"というメッセージが表示され、READMEが作成され、TODOが更新された。

---

## 本バージョンでの実装内容（README と重複可）

### 技術スタック

- **フロント:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS
- **バックエンド:** Supabase (Auth, PostgreSQL, RLS)
- **ホスティング:** Vercel（Github 連携想定）

### 環境変数

- `.env.local.example` をコピーして `.env.local` を作成。
- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定（github.md 参照）。

### データベース（Supabase）

- **マイグレーション:** `supabase/migrations/001_initial_schema.sql`
  - テーブル: localities, districts, groups, meetings, members, regular_member_list_items, attendance_records, profiles, reporter_districts, attribute_histories, system_settings, audit_logs, login_logs
  - バプテスマ日: `baptism_year`, `baptism_month`, `baptism_day`, `baptism_date_precision`（year/month/day 3カラム＋precision）
  - profiles: 報告者用に `main_district_id` を 1 カラムで保持
  - system_settings: 欠席アラート週数（`absence_alert_weeks`）を**システム全体の設定**として保持、初期値 4・1〜52
  - RLS 有効化、権限マトリクスに沿ったポリシー
  - 初期データ: 調布地方・調布地区、欠席アラート週数 4
  - auth.users 挿入時に profiles を自動作成するトリガー

### 実装した画面・機能

| 画面 | 内容 |
|------|------|
| ログイン | メール/パスワード、`/auth/callback` でセッション確立 |
| ダッシュボード (/) | 地方数・メンバー数・集会数の概要、集会/名簿/統計へのリンク |
| 集会・出欠 | 集会一覧、集会登録（主日/小組・地区/小組選択）、集会詳細で出席者追加・削除（検索でメンバー追加） |
| 名簿 | メンバー一覧、無所属リスト表示、メンバー追加・詳細 |
| 統計 | 週別出席者数・区分別グラフ、欠席アラート（過去 X 週出席・今週欠席）、**統計グラフの PNG ダウンロード** |
| 設定 | 欠席アラート週数（1〜52、管理者・共同管理者）、ユーザー一覧、**組織設定**（地方・地区・小組の追加、管理者・共同管理者） |
| バックアップ | **アプリ内**で JSON エクスポート/インポート |

- UI: モバイルファースト（タッチターゲット 44px、横スクロールナビ等）、日本語のみ。
- 権限: 閲覧者 / 報告者 / 共同管理者 / 管理者（spec5 の権限マトリクスに準拠）。

### 起動手順（README と同様）

1. `.env.local` に Supabase URL と anon key を設定する。
2. Supabase SQL Editor で `supabase/migrations/001_initial_schema.sql` を実行する。
3. Supabase Authentication でユーザーを 1 件作成し、`profiles` の `role` を `admin` に変更する。
4. `npm install` → `npm run dev` で http://localhost:3000 にアクセスし、ログインする。

### 未実装・今後の拡張候補

- レギュラーメンバーリストの並び順選択（読み仮名順・登録順・信仰順）と集会作成時の自動展開
- 同日・別地区集会への同一メンバー登録時のアラート（仕様 3.2）
- 名簿統合・遡り修正、名簿統合のロールバック
- 年度更新（進級対象者一括更新）
- 初回ログイン時のメール通知・パスワード再送（Supabase Auth または Edge Functions）
- 監査ログ・ログインログの書き込みと閲覧 UI
- バイタルグループのグラフィックビュー
- メンバー編集画面（`/members/[id]/edit`）のフォーム実装


--

## 反省点
- 管理者アカウント情報を渡していなかったので、初期状態でログインするアカウントがない。
→sqlを作成してもらい、supbaseでinisitalを実行した後に実行した。successと出た。

## バグ
- サイトタイトルは出るが、ページ内容は"404 | This page could not be found."のままで、何度リクエストしても治らない。