# 召会生活統計システム (ChurchStats)

spec5.md に基づく、召会のメンバー管理・出欠・統計の Web アプリです。

## 技術スタック

- **フロント:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS
- **バックエンド:** Supabase (Auth, PostgreSQL, RLS)
- **ホスティング:** Vercel（Github 連携）

## セットアップ

### 1. 環境変数

```bash
cp .env.local.example .env.local
```

`.env.local` に Supabase の URL と anon key を設定（github.md 参照）。

### 2. データベース

Supabase ダッシュボードの **SQL Editor** で、`supabase/migrations/001_initial_schema.sql` の内容を実行してください。  
これでテーブル・RLS・初期データ（調布地方・調布地区・欠席アラート週数 4）が作成されます。

### 3. 初回ユーザー（管理者）

1. Supabase Dashboard → **Authentication** → **Users** で「Add user」からメール・パスワードでユーザーを作成する。
2. **Table Editor** → `profiles` を開き、そのユーザーの `role` を `admin` に変更する。

**西村達也さんを管理者にする場合（氏名・メイン地区・担当地区を一括設定）:**

※ **先に「2. データベース」で `001_initial_schema.sql` を実行し、テーブルが作成されていること。**  
※ **SQL は「Authentication でユーザーを追加したあと」に実行すること。** ユーザーがまだいない状態で実行すると 0 件更新になり、あとからユーザーを追加した場合は SQL を**もう一度**実行する。

1. 上記のとおり **Authentication → Add user** で  
   - メール: `tatsuya.n@gmail.com`  
   - パスワード: （受け取ったもの）  
   でユーザーを作成する。
2. **SQL Editor** で「New query」を開き、以下をそのまま貼り付けて **Run** する。

```sql
-- 稲城地区を追加（調布地方の下）
INSERT INTO districts (id, locality_id, name)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '稲城地区'
)
ON CONFLICT (id) DO NOTHING;

-- プロファイルを管理者に更新（氏名・メイン地区）
UPDATE profiles
SET
  role = 'admin',
  full_name = '西村達也',
  main_district_id = '33333333-3333-3333-3333-333333333333'
WHERE id = (SELECT id FROM auth.users WHERE email = 'tatsuya.n@gmail.com' LIMIT 1);

-- 担当地区：調布地区・稲城地区
INSERT INTO reporter_districts (user_id, district_id)
SELECT u.id, d.id
FROM auth.users u
CROSS JOIN districts d
WHERE u.email = 'tatsuya.n@gmail.com'
  AND d.name IN ('調布地区', '稲城地区')
ON CONFLICT (user_id, district_id) DO NOTHING;
```

   → 稲城地区の追加、`profiles` の role・氏名・メイン地区、担当地区（調布地区・稲城地区）が設定される。

**ユーザーを追加したあとで属性を編集する（管理者にする等）:**

- **方法A:** 上記 SQL を**もう一度** SQL Editor で実行する（そのメールのユーザーがいる場合だけ `profiles` と `reporter_districts` が更新される）。
- **方法B:** Supabase **Table Editor** → **profiles** を開き、該当ユーザーの行の **role** を `admin` に変更し、**full_name**・**main_district_id** を必要に応じて編集して保存する。担当地区は **reporter_districts** テーブルで行を追加・削除する。

※ 本アプリでは「管理者」は **profiles.role = 'admin'** で判定します。Supabase の `is_super_admin` 等は使っていません。

**「new row violates row-level security policy for table members」が出る場合**

- メンバー登録は **報告者以上**（admin / co_admin / reporter）のみ可能です。ログイン中のユーザーの **profiles.role** が `viewer` のままだとこのエラーになります。
- **対処:** Supabase **Table Editor** → **profiles** で、そのユーザーの **role** を `admin`（または `co_admin` / `reporter`）に変更して保存する。または上記「西村達也さんを管理者にする場合」の SQL を**ユーザー追加後に**もう一度実行する。

### 4. 起動

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開き、ログイン後ダッシュボードが表示されればOKです。

**「This page could not be found」が出る場合**

- 一度 dev サーバーを止めてから、キャッシュを消して再起動する:
  ```bash
  rm -rf .next
  npm run dev
  ```
- ログイン画面は **http://localhost:3000/login** を直接開く。
- `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されているか確認する。

## 主な機能

- **ダッシュボード:** 地方・メンバー数・集会数の概要
- **集会・出欠:** 集会の登録、出席者の追加・削除（検索でメンバー追加）
- **名簿:** メンバー一覧、無所属リスト、メンバー追加・編集
- **統計:** 週別出席者数・区分別グラフ、欠席アラート、グラフの PNG ダウンロード
- **設定:** 欠席アラート週数（1〜52）、ユーザー一覧（管理者・共同管理者向け）
- **バックアップ:** データの JSON エクスポート／インポート

## 権限

- **閲覧者:** 統計・名簿の閲覧のみ
- **報告者:** 集会作成・出欠報告・小組名簿の追加・削除・レギュラーメンバーリスト
- **共同管理者:** 上記＋組織・小組設定・ユーザー管理（管理者の変更は不可）
- **管理者:** 全て

## モバイル

UI はモバイルファーストで、スマホでも操作しやすいようにしています。

## 本番デプロイ

1. リポジトリを GitHub に push する。
2. Vercel で「Import Project」から当該リポジトリを選択し、環境変数に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してデプロイする。

### プライベートリポジトリに push する場合（権限・認証）

リポジトリがプライベートのとき、「Repository not found」が出る場合は **権限** と **ローカル認証** の両方が必要です。

**1. GitHub で権限を追加する**

- https://github.com/teamhiram/churchstats → **Settings** → **Collaborators**（または **Manage access**）
- **Add people** で、push する GitHub アカウントを追加し、**Write** 以上の権限を付与する。
- 招待された側はメールまたは GitHub の通知から **Accept** する。

**2. ローカルで Git の認証を通す**

- **SSH を使う場合（推奨）:** リモートが `git@github.com:teamhiram/churchstats.git` になっていれば、GitHub に登録済みの SSH キーで push できる。SSH キーがまだなら [GitHub: SSH キー追加](https://docs.github.com/ja/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) を参照。
- **HTTPS を使う場合:** `gh auth login`（GitHub CLI）でログインするか、Personal Access Token (PAT) を作成し、push 時にパスワードの代わりに PAT を入力する。

上記のあと、以下で push できる。

```bash
git push -u origin main
```
