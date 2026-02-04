# ChurchStats v0.1 トラブルシューティング記録

実装後の運用で発生した現象・原因・対処法・対処結果を記録する。

---

## 1. ページが見つからない（404）

### 現象
- `http://localhost:3000` や `http://localhost:3000/login` にアクセスすると「404 | This page could not be found.」と表示される。
- タブには「召会生活統計」と出るが、本文は 404 のまま。

### 原因
- ルート `/` に専用の `app/page.tsx` がなく、`(dashboard)/page.tsx` のみだったため、ルート解決が期待どおりにならない環境があった。
- `/login` のルートが正しく解決されないケースがあった。

### 対処法
- **ルート（`/`）で未ログイン時にログイン画面を表示する**ように変更。`app/page.tsx` で認証を確認し、未ログインならログインフォームを表示、ログイン済みなら `/dashboard` へリダイレクト。
- ダッシュボードを `/dashboard` に移し、ナビのリンクを `/dashboard` に変更。
- キャッシュ削除と dev サーバー再起動: `rm -rf .next` のあと `npm run dev`。
- カスタム `app/not-found.tsx` を追加し、404 時に「ログインへ」リンクを表示。

### 対処結果
- `http://localhost:3000` を開くとログイン画面が表示されるようになった。`/login` が 404 になる環境でも、トップからログイン可能。

---

## 2. Supabase の環境変数未設定によるランタイムエラー

### 現象
- 画面に「Unhandled Runtime Error」が表示される。
- メッセージ: `Your project's URL and Key are required to create a Supabase client!`
- エラー発生箇所: `src/lib/supabase/server.ts`（`createServerClient` 呼び出し時）。

### 原因
- `.env.local` が存在しない、または `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が未設定のままサーバー側で Supabase クライアントを生成していた。

### 対処法
- プロジェクト直下に `.env.local` を作成し、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定（値は github.md または `.env.local.example` 参照）。
- 環境変数は dev サーバー起動時に読み込まれるため、**設定後に dev サーバーを一度停止（Ctrl+C）してから `npm run dev` で再起動**する。
- サーバー側の `createClient` で、環境変数が未設定のときに日本語のエラーメッセージを出すように変更。
- ミドルウェアでも環境変数未設定時は例外を出さず通過するように変更（ページ表示はできるがログインは不可）。

### 対処結果
- `.env.local` を用意し、サーバー再起動後にエラーは解消。ログイン・ダッシュボード表示が可能になった。

---

## 3. 管理者アカウント未設定・SQL が「効いていない」ように見える

### 現象
- Authentication にユーザーを追加したが、`profiles` の role が `viewer` のまま。
- 管理者用 SQL（`setup_admin_nishimura.sql` または README 内の SQL）を実行しても「誰も追加されていなかった」「機能していなかった」ように見える。

### 原因
- 管理者用 SQLは **「Authentication にユーザーが存在したあと」** に実行する前提。ユーザー登録**前**に実行すると、`UPDATE profiles` の対象が 0 件になり、変化がない。
- 初回は `001_initial_schema.sql` でテーブルを作成したあと、**そのあと** Authentication でユーザーを追加し、**そのあと** 管理者用 SQL を実行する順序が必要。

### 対処法
- **手順の順序を守る:** (1) 初期スキーマ実行 → (2) Authentication でユーザー追加 → (3) 管理者用 SQL を実行。
- ユーザー追加後に、管理者用 SQL を **もう一度** SQL Editor で実行する。
- または Supabase **Table Editor** → **profiles** で、該当ユーザーの **role** を `admin` に変更し、**full_name**・**main_district_id** を必要に応じて編集。担当地区は **reporter_districts** で行を追加。
- README に「SQL はユーザー追加後に実行する」「ユーザー追加後に SQL を再実行する」旨を追記。

### 対処結果
- ユーザー追加後に SQL を再実行するか、Table Editor で role を `admin` に変更することで、管理者としてログイン・操作可能になった。

---

## 4. パスワードリセット（メールリンク）で otp_expired・誘導先でエラー

### 現象
- Supabase から送られたパスワードリセットメールのリンクを開くと、`http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired` に誘導される。
- 「missing required error components, refreshing...」と表示される。

### 原因
- **otp_expired:** リセットリンクのトークンが期限切れ、またはメールクライアント・セキュリティツールによるリンクの事前アクセス（プレビュー・スキャン）でトークンが消費され、本人がクリックした時点では無効になっている。
- ハッシュ（`#error=...`）付きの URL をアプリ側で適切に処理していないと、エラー表示が分かりにくい。

### 対処法
- **すぐにパスワードを直す場合:** Supabase Dashboard → **Authentication** → **Users** → 対象ユーザー → **Reset password** で新しいパスワードを直接設定。メールリンクは使わない。
- メールリセットを使う場合: Supabase **Authentication** → **URL Configuration** で **Site URL** を `http://localhost:3000`、**Redirect URLs** に `http://localhost:3000/*` 等を追加。リンクは「コピーしてブラウザのアドレスバーに貼って開く」と、プレビューで踏まれるリスクを減らせる。
- 本番運用では Vercel にデプロイして https の固定 URL を使うと、リセットフローが安定しやすい。

### 対処結果
- Dashboard の ユーザを削除し、再度作成したら、その情報でログインできた。

---

## 5. メンバー登録で RLS ポリシー違反

### 現象
- 名簿で「メンバーを追加」して登録しようとすると、エラーになる。
- メッセージ: `new row violates row-level security policy for table "members"`

### 原因
- `members` テーブルへの INSERT は、RLS により **報告者以上**（`admin` / `co_admin` / `reporter`）のみ許可されている。
- ログイン中のユーザーの **profiles.role** が **viewer** のままだと、INSERT が拒否される。

### 対処法
- Supabase **Table Editor** → **profiles** で、ログイン中のユーザーの **role** を `admin`（または `co_admin` / `reporter`）に変更して保存。
- または「西村達也さんを管理者にする場合」の SQL を、**ユーザー追加後に**もう一度 SQL Editor で実行する。
- README に「members の RLS エラーが出た場合は profiles.role を報告者以上にすること」を追記。

### 対処結果
- 該当ユーザーの `profiles.role` を `admin` に変更後、メンバー登録ができるようになった。

---

## 6. 名簿の「編集」で 404

### 現象
- 名簿でメンバー詳細を開き「編集」を押すと、「ページが見つかりません」「404 | This page could not be found.」となる。

### 原因
- メンバー詳細ページから `/members/[id]/edit` へのリンクはあったが、**編集ページ（`/members/[id]/edit`）が未実装**だった。

### 対処法
- `src/app/(dashboard)/members/[id]/edit/page.tsx` を追加。メンバー情報を取得し、編集フォームを表示する。
- `src/app/(dashboard)/members/[id]/edit/EditMemberForm.tsx` を追加。氏名・性別・ローカル/ゲスト・地区・小組・区分・バプテスマ済みを編集し、保存で UPDATE、キャンセルで詳細へ戻る。

### 対処結果
- 「編集」から編集画面が開き、保存すると詳細に戻るようになった。

---

## 7. 初期スキーマ実行前に管理者用 SQL を実行した場合

### 現象
- 管理者用 SQL を実行すると、エラーになる。
- メッセージ例: `relation "districts" does not exist`

### 原因
- 管理者用 SQL は **`districts` 等のテーブルが存在する**ことが前提。`001_initial_schema.sql` を実行する前に実行すると、テーブルがないためエラーになる。

### 対処法
- 必ず **「2. データベース」で `001_initial_schema.sql` を先に実行**し、テーブル・RLS・初期データを作成してから、管理者用 SQL を実行する。
- README に「先に 001_initial_schema.sql を実行すること」を明記。

### 対処結果
- 初期スキーマ実行後に管理者用 SQL を実行することで、稲城地区の追加と profiles・reporter_districts の設定が完了する。

---

## 8. 編集ページ追加後にサイト全体が真っ白になる

### 現象
- 名簿の編集ページ（/members/[id]/edit）を追加したあと、サイト全体が真っ白になる。
- サイトタイトル（タブの「召会生活統計」）すら表示されない。

### 原因
- クライアント側で Supabase クライアント作成時に環境変数（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）が未設定だと例外が発生し、React の描画が止まって白画面になる。
- 編集ページの `initial` に DB から null/undefined や想定外の型が渡ると、クライアントでハイドレーションやフォーム初期化時に不具合が起きる可能性がある。
- エラーバウンダリがなかったため、例外時に「エラー画面」ではなく真っ白なままになる。

### 対処法
- **app/error.tsx** を追加し、セグメント内のエラーをキャッチしてメッセージと「再試行」を表示する。
- **app/global-error.tsx** を追加し、ルートレイアウトを含む重大なエラー時にタイトル付きでエラー内容を表示する。
- **lib/supabase/client.ts** で環境変数が未設定のときは、Supabase を呼ぶ前に日本語のエラーメッセージを throw するように変更（エラーバウンダリで表示される）。
- **members/[id]/edit/page.tsx** の `initial` を防御的にする。`member` の各フィールドを `String()` / `Boolean()` で正規化し、`gender` は "male" | "female" | "other" に限定して渡す。
- `.env.local` がプロジェクト直下にあるか確認し、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定したうえで、dev サーバーを一度止めてから `npm run dev` で再起動する。ブラウザをハードリロード（キャッシュ無視）する。

**追加対応（途中でまた真っ白になった場合）:**
- **components/GlobalErrorHandler.tsx** を追加。`window` の `error` と `unhandledrejection` を監視し、未捕捉のエラー発生時にメッセージと「再読み込み」を表示する。
- **app/layout.tsx** で `body` の子を `<GlobalErrorHandler>` でラップし、React 外の例外でも白画面にならないようにする。
- **lib/supabase/client.ts** を変更。環境変数未設定時は **throw しない**。空文字で `createBrowserClient` を呼び、初回 API 呼び出しで失敗するようにする。`hasSupabaseEnv()` を export し、呼び出し側で環境変数有無を判定できるようにする。
- **app/login/LoginForm.tsx** でログイン送信前に `hasSupabaseEnv()` を確認し、未設定なら「環境変数が未設定です。.env.local を確認し、サーバーを再起動してください。」と表示する。

### 対処結果
- エラー時は「エラーが発生しました」とメッセージが表示され、真っ白にならない。環境変数未設定時はその旨が表示される。編集ページの `initial` を正規化したことで、DB の値の揺れによる不具合を防ぐ。
- 追加対応後、未捕捉エラーは GlobalErrorHandler で表示され、Supabase クライアントは例外を出さないため初回描画で落ちなくなる。ログイン前の環境変数チェックで未設定時もフォーム上で案内できる。**サイトが再び表示されるようになった。**
