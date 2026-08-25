# ChurchStats

ChurchStats（召会生活統計）は、召会のメンバー管理、出欠登録、週別集計、チャート確認を一体化した Web アプリです。

地方運用を前提に、ローカル管理者向けの設定、名簿整備、確認導線を備えています。各地の統計担当が入力し、各地の管理者が統計担当アカウントを作成・管理できます。

## AI Collaboration

AI coding agent 向けの作業規約は [AGENTS.md](AGENTS.md) を参照してください。

- ロール詳細: [docs/ai-coding-roles.md](docs/ai-coding-roles.md)
- セキュリティ確認: [docs/security-checklist.md](docs/security-checklist.md)
- Cursor 固有の補足: [.cursorrules](.cursorrules)

## 主な機能

- メンバー名簿（個人ページ、状態管理、ふりがな・属性の更新）
- 集会別の出欠登録（主日集会、祈りの集会、小組集会、派遣）
- 週別集計と可視化（チャート、重複検知、確認用デバッグ画面）
- ロール別運用（グローバルロール / ローカルロール）
- 設定画面のサイドバー管理と、アップデート（ベータ版）閲覧ページ

## 技術スタック

- **Frontend**: Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth / PostgreSQL / RLS)
- **Hosting**: Vercel
- **Testing**: Vitest, Testing Library, Playwright, GitHub Actions

## セットアップ

### 1) 必要環境

- Node.js `20.x`
- npm

### 2) 環境変数

```bash
cp .env.local.example .env.local
```

`.env.local` に必要な Supabase 環境変数を設定します。

### 3) 依存関係インストール

```bash
npm install
```

### 4) 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` を開いて動作確認します。

## データベース初期化

Supabase 側で初期スキーマを適用します。基本は `supabase/migrations/` を順に適用し、必要に応じて `supabase/scripts/` を利用してください。

> 注意: 実運用データ（ダンプ、個人情報、認証情報）はリポジトリに含めない運用にしてください。

## 権限モデル（概要）

- **viewer**: 閲覧中心
- **reporter**: 出欠記録などの報告操作
- **co_admin**: ローカル設定・管理操作
- **admin**: 全機能
- 追加で、グローバルロール / ローカルロールにより表示範囲を制御

詳細な権限・RLS 変更では、実装前に [docs/security-checklist.md](docs/security-checklist.md) を確認してください。

## テスト

```bash
npm run test
npm run test:e2e
npm run test:all
```

Playwright 初回のみ:

```bash
npm run test:e2e:install
```

## 主要 npm scripts

- `npm run dev` - 開発サーバー起動
- `npm run build` - 本番ビルド
- `npm run start` - 本番サーバー起動
- `npm run lint` - Next.js lint
- `npm run test` - Unit テスト
- `npm run test:watch` - Unit テストの watch 実行
- `npm run test:coverage` - Unit テストの coverage 実行
- `npm run test:e2e` - E2E テスト
- `npm run test:e2e:headed` - headed E2E テスト
- `npm run test:e2e:ui` - Playwright UI
- `npm run test:e2e:install` - Playwright browser install
- `npm run test:all` - Unit + E2E テスト
- `npm run split-members-name` - 名簿分割補助スクリプト

## デプロイ（Vercel）

1. GitHub に push
2. Vercel でリポジトリを Import
3. 環境変数を設定してデプロイ

## 運用メモ

- 機密情報（トークン、実ユーザーデータ、ダンプ）はコミットしない
- `gitignore` 対象でも、過去に push 済みなら履歴には残るため注意
- 履歴抹消が必要な場合は、履歴書き換え + force push + チーム再同期をセットで実施
- リリース作業では、バージョン表示、`package.json`、`_ReleaseNotes/` の整合性を確認する

## リポジトリ

- GitHub: [teamhiram/churchstats](https://github.com/teamhiram/churchstats)
