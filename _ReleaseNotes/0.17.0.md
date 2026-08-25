# ChurchStats v0.17

2026/02/26

地方マスタに「海外」「不明」を追加、出欠登録で地方切り替え後に正しい地方で表示・登録されるよう修正、名簿管理の地方区別の不具合解消、DB 上の地方区別のドキュメント追加、同一リクエスト内の localities/areas/prefectures 取得を React cache() で抑止してレンダリングを軽量化したバージョン。


## LINEでのお知らせ

統計システム0.17
2026/02/26
■ 地方マスタ
・「海外」「不明」の選択肢を追加（マイグレーション 037）。地方切り替え・名簿で選択可能。
■ 出欠登録
・地方を切り替えたあと（例: 酒田を選択）に出欠登録を開いても、URL に他地方の地区が残っていても、現在選択中の地方の地区で正しく表示・登録されるように修正。
■ 名簿管理
・地方区別に伴う表示・フィルタの不具合を解消。
■ その他
・同一リクエスト内の地方・地域・都道府県の重複取得を抑止し、画面表示を軽くしました。

## 本バージョンでの追加・変更内容

### 地方マスタに「海外」「不明」を追加

- マイグレーション **037**（`supabase/migrations/037_localities_overseas_unknown.sql`）で、`localities` テーブルに「海外」「不明」を 2 行追加した。
- どちらも `prefecture_id` は NULL（都道府県に属さない特殊地方）。地方切り替えポップアップや名簿で選択可能。
- 同名が既に存在する場合は挿入しないため、マイグレーションの二重実行でも重複しない。

### 出欠登録で地方切り替え後も正しい地方で表示

- **現象**: ナビで酒田などに切り替えても、出欠登録を開くと調布の地区のまま表示されていた。
- **原因**: URL の `district_id` パラメータ（以前開いた調布の地区 ID）を検証せずにそのまま使っており、現在の地方（Cookie）で絞った地区リストに含まれない ID でも表示していた。
- **対応**: `effectiveDistrictIdForCurrentLocality` を追加。URL の `district_id` は「現在地方の districts に含まれる場合のみ」採用し、それ以外は現在地方のデフォルト地区（メイン地区または先頭地区）にフォールバックするようにした。
- 主日出欠・祈りの集会・小組・オーガニック派遣の各ページで、このヘルパーを使って `defaultDistrictId` を決定するように変更。

### 名簿管理の地方区別の解消

- 地方切り替え後の名簿表示・フィルタが正しく現在の地方でスコープされるよう、既存の修正を反映し不具合を解消。

### ドキュメント

- **出欠関連テーブル**（`docs/attendance-related-tables.md`）に「6. DB 上の地方（locality）による区別」を追加。districts / lordsday_meeting_records / 名簿 / RLS が地方でどう区別されているか、およびアプリ側の Cookie と `effectiveDistrictIdForCurrentLocality` の役割を記載。
- **多地方運用記録**（`docs/multi-region-implementation-record.md`）に「1.1 パフォーマンス（rendering / compiling）」を追加。Rendering の cache 抑止（getCachedLocalities / getCachedAreas / getCachedPrefectures の React cache()）と、Compiling の Turbopack 利用案を記載。

### パフォーマンス（Rendering）

- 同一リクエスト内で `getCachedLocalities` / `getCachedAreas` / `getCachedPrefectures` が複数箇所から呼ばれても、DB アクセスが 1 回にまとまるように、React の `cache()` でラップした。
- レイアウト・集会ページ・`getEffectiveCurrentLocalityId` などで重複呼び出しが発生していたが、これにより各データの取得は 1 回に抑止される。

---

## 影響範囲

| 対象 | 変更内容 |
|------|----------|
| `src/lib/cachedData.ts` | `getCachedLocalities` / `getCachedAreas` / `getCachedPrefectures` を `cache()` でラップ。`effectiveDistrictIdForCurrentLocality` を追加。 |
| `src/app/(dashboard)/meetings/sunday/page.tsx` | `effectiveDistrictIdForCurrentLocality` で URL の district_id を検証。 |
| `src/app/(dashboard)/meetings/prayer/page.tsx` | 同上。 |
| `src/app/(dashboard)/meetings/small-group/page.tsx` | 同上（`__all__` 対応）。 |
| `src/app/(dashboard)/meetings/organic/page.tsx` | 同上。 |
| `docs/attendance-related-tables.md` | 「DB 上の地方による区別」セクションを追加。 |
| `docs/multi-region-implementation-record.md` | 「パフォーマンス（rendering / compiling）」セクションを追加。 |
| `supabase/migrations/037_localities_overseas_unknown.sql` | 新規。localities に「海外」「不明」を挿入。 |
