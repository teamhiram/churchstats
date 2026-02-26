# 多地方運用対応 — 実装記録

本ドキュメントは、多地方運用対応のうち **DB スキーマ・RLS まで実施した内容**を記録する。  
全体の要件・用語・今後のステップは [multi-region-support-plan.md](./multi-region-support-plan.md) を参照。

---

## 1. 概要

- **目的**: 1 DB のまま「地方」単位でデータを分離し、アカウントごとにアクセス可能な地方を付与。地方切り替えで地区・小組・名簿が切り替わる。
- **実施済み**:
  1. バックアップ取得と git commit/push
  2. マイグレーション **027**（スキーマ: areas, user_localities, user_areas, local_roles, member_links, profiles.global_role 等）
  3. マイグレーション **028**（RLS ヘルパーと既存テーブルの locality スコープ付きポリシー）
  4. マイグレーション **031**（profiles の UPDATE を global admin に許可 — ロール管理ページ用）
  5. **ロール管理ページ**（設定 > ユーザー・ロール管理 `/settings/roles`）: 招待（メール）、global_role / user_areas / user_localities / local_roles の編集をアプリ内で完結。global_role = admin のユーザーのみアクセス可。
  6. マイグレーション **033**（都道府県 47 件を固定 UUID で投入。id = 00000000-0000-0000-0000-000000000001 ～ 047）
  7. マイグレーション **034**（既存 localities の prefecture_id を一括設定）
  8. マイグレーション **035**（localities.id を docs/japan_cities.tsv の団体コードベース UUID に変更。東京都(23区)は 130001）
- **未実施**: アプリ層の current_locality（Cookie + コンテキスト + 地方切り替え UI）、全データ取得の locality スコープ、同一人物紐づけ UI。

## 1.1 パフォーマンス（rendering / compiling）

- **Rendering**: 同一リクエスト内で `getCachedLocalities` / `getCachedAreas` / `getCachedPrefectures` の重複呼び出しを抑えるため、React の `cache()` でラップ済み（`cachedData.ts`）。
- **Compiling**: `next dev` は標準で Turbopack。`package.json` で `next dev --webpack` にしている場合は `next dev` にするとコンパイルが軽くなる場合あり。

---

## 2. 用語の対応

| 用語     | 実装での対応 |
|----------|----------------|
| 地方     | **locality**（既存テーブル。調布・札幌など） |
| 地域     | **area**（新規。北海道・東北、南関東など）。regional_viewer はここに属する locality のみ閲覧可 |
| **都道府県** | **prefecture**（030 で追加。東京都・千葉県など）。area に属し、locality は prefecture に属する。 |
| 地区・小組・名簿 | 既存の **districts** / **groups** / **members**（いずれも locality に紐づく） |
| グローバル権限 | **profiles.global_role**: admin / national_viewer / regional_viewer。null = ローカルのみ |
| ローカル権限 | **local_roles**: local_admin / local_reporter / local_viewer（地方ごと） |

**地域（area）の分け方**: [調布に在る教会 諸地方召会](https://church-in-chofu.com/localities/) の地域分けを参考にする。マイグレーション 029 で 6 地域を登録。**030 で都道府県（prefecture）を追加**し、階層は **地域 → 都道府県 → 地方**。**033 で都道府県 47 件を固定 UUID（末尾 01–47）で投入**。**034 で既存 localities の prefecture_id を一括設定**。**035 で localities.id を [japan_cities.tsv](./japan_cities.tsv) の団体コードベースの UUID に変更**（例: 札幌 011002 → 00000000-0000-0000-0000-000000011002。東京都(23区)は 130001）。

---

## 3. 実施前の準備（バックアップ）

- **DB バックアップ**: ターミナルで `pg_dump` を実行し、`~/backup_pre_multi_region_20260226.dump` を取得（約 454KB）。  
  - Database password は Supabase の「Database password」。SQL Editor ではなくターミナルで実行。
  - リストア確認: `pg_restore -l ~/backup_pre_multi_region_20260226.dump` で内容確認済み。
- **プログラム**: git commit および push を実施済み。

---

## 4. マイグレーション 027（スキーマ）

**ファイル**: [supabase/migrations/027_multi_region_schema.sql](../supabase/migrations/027_multi_region_schema.sql)

### 4.1 新規テーブル・列・型

| 対象 | 内容 |
|------|------|
| **areas** | 地域。`id`, `name`（UNIQUE）。RLS 有効。 |
| **localities** | 027 で `area_id` 追加。**032 で `area_id` 削除**。地域は prefecture 経由でのみ参照。 |
| **profiles** | `global_role` 追加（型: `global_role_enum` = admin / national_viewer / regional_viewer、NULL = ローカルのみ）。 |
| **global_role_enum** | 新規 enum。 |
| **local_role_enum** | 新規 enum: local_admin / local_reporter / local_viewer。 |
| **user_localities** | `user_id`, `locality_id`、PK(user_id, locality_id)。ユーザーがアクセス可能な地方。 |
| **user_areas** | `user_id`, `area_id`、PK(user_id, area_id)。regional_viewer が閲覧可能な地域。 |
| **local_roles** | `user_id`, `locality_id`, `role`(local_role_enum)、PK(user_id, locality_id)。地方ごとの役割。 |
| **member_links** | `id`, `member_id_a`, `member_id_b`, `created_at`, `created_by_user_id`。同一人物紐づけ（表示用のみ）。制約: member_id_a < member_id_b、UNIQUE(member_id_a, member_id_b)。 |

### 4.2 データ移行

- `profiles` の既存 `role` が admin または co_admin の行について、`global_role = 'admin'` を設定（`global_role` が NULL のときのみ）。

### 4.3 ヘルパー関数

- **get_my_global_role()**: 現在ユーザーの `profiles.global_role` を返す。`SECURITY DEFINER`、`STABLE`。

### 4.4 RLS（027 で追加したテーブル）

- **areas**: SELECT は認証ユーザー全員、ALL は `get_my_global_role() = 'admin'` のみ。
- **user_localities**: 自分分は SELECT 可、INSERT/UPDATE/DELETE は global admin のみ。
- **user_areas**: 同上（DELETE まで global admin）。
- **local_roles**: 自分分は SELECT 可、INSERT/UPDATE/DELETE は global admin のみ。
- **member_links**: 現時点では global admin のみ SELECT/INSERT/DELETE。計画では「link のいずれかの member の locality で local_admin なら可」に拡張可能（get_my_effective_role 実装後にポリシーを拡張）。

---

## 5. マイグレーション 028（RLS ヘルパーとポリシー書き換え）

**ファイル**: [supabase/migrations/028_multi_region_rls_helpers.sql](../supabase/migrations/028_multi_region_rls_helpers.sql)

### 5.0 lordsday_meeting_records の locality_id（028 での補足）

028 の先頭で、**lordsday_meeting_records** に `locality_id` を `ADD COLUMN IF NOT EXISTS` で追加している。  
マイグレーション 020 で `meetings` に追加された `locality_id` は、020 未適用の環境では存在しないため、028 の RLS で `locality_id` を参照すると「column locality_id does not exist」で失敗する。そのため 028 内で「無ければ追加」するようにした。020 適用済み環境では No-op となる。

### 5.1 後方互換の考え方

- **既存ユーザー**（`global_role` が NULL かつ `user_localities` に 1 件もない）: 「全地方にアクセス可能」として扱う。  
  → 単一地方運用や、まだ user_localities を設定していない reporter/viewer がそのまま動作する。
- **実効ロール**: その地方に `local_roles` の行が無い場合は、従来の `profiles.role` を使用（co_admin → admin にマッピング）。

### 5.2 新規ヘルパー関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| **get_my_accessible_locality_ids()** | SETOF uuid | 現在ユーザーがアクセス可能な locality の id 一覧。admin/national_viewer → 全 locality。regional_viewer → user_areas に紐づく area の localities。それ以外 → user_localities の locality_id（0 件なら後方互換で全 locality）。SECURITY DEFINER, STABLE。 |
| **get_my_effective_role(p_locality_id uuid)** | role_enum | 指定した地方での「実効ロール」。admin → admin、national_viewer → viewer、regional_viewer かつその地方が user_areas の area に属する → viewer。それ以外は local_roles を参照し、無ければ profiles.role（co_admin → admin）。アクセス不可の場合は NULL。SECURITY DEFINER, STABLE。 |
| **can_access_locality(p_locality_id uuid)** | boolean | `p_locality_id IN (SELECT get_my_accessible_locality_ids())`。SECURITY DEFINER, STABLE。 |

### 5.3 ポリシー変更の概要

既存の「認証ユーザー全員」「admin/co_admin/reporter 以上」などのポリシーを、  
「**アクセス可能 locality に属する行のみ**」かつ「**その locality での effective role が条件を満たす場合にのみ変更許可**」に変更。

- **SELECT**: 行が属する locality が `get_my_accessible_locality_ids()` に含まれること。
- **INSERT/UPDATE/DELETE**: 上記に加え、その locality での `get_my_effective_role(locality_id)` が admin/co_admin または reporter 以上（テーブルごとに定義）であること。

### 5.4 対象テーブルとポリシー名（028 で DROP → CREATE したもの）

| テーブル | 旧ポリシー（DROP） | 新ポリシー（CREATE） |
|----------|--------------------|------------------------|
| localities | localities_select_authenticated, localities_all_admin_coadmin | localities_select_accessible, localities_all_effective_admin |
| districts | districts_select_authenticated, districts_all_admin_coadmin | districts_select_accessible, districts_all_effective_admin |
| groups | groups_select_authenticated, groups_insert_delete_*, groups_update_* | groups_select_accessible, groups_insert_effective, groups_update_effective, groups_delete_effective_admin |
| members | members_select_authenticated, members_insert_reporter_above, members_update_reporter_above | members_select_accessible, members_insert_effective, members_update_effective |
| lordsday_meeting_records | meetings_select_authenticated, meetings_insert_reporter_above, meetings_update_reporter_above | lordsday_meeting_records_select_accessible, *_insert_effective, *_update_effective |
| lordsday_meeting_attendance | attendance_records_* | lordsday_attendance_select_accessible, *_insert_effective, *_update_effective, *_delete_effective |
| lordsday_regular_list | regular_member_list_items_* | lordsday_regular_list_select_accessible, lordsday_regular_list_all_effective |
| group_meeting_records | group_meeting_records_* | group_meeting_records_select_accessible, *_insert_effective, *_update_effective, *_delete_effective |
| group_meeting_attendance | group_meeting_attendance_* | group_meeting_attendance_* |
| prayer_meeting_records | prayer_meeting_records_* | prayer_meeting_records_select_accessible, *_insert_effective, *_update_effective, *_delete_effective |
| prayer_meeting_attendance | prayer_meeting_attendance_* | prayer_meeting_attendance_* |
| district_regular_list | district_regular_list_* | district_regular_list_select_accessible, district_regular_list_all_effective |
| group_regular_list | group_regular_list_* | group_regular_list_* |
| district_semi_regular_list / group_semi_regular_list | 同上パターン | *_select_accessible, *_all_effective |
| district_pool_list / group_pool_list | 同上パターン | 同上 |
| organic_dispatch_records | organic_dispatch_* | organic_dispatch_select_accessible, organic_dispatch_all_effective |
| member_local_enrollment_periods | mlep_* | mlep_select_accessible, mlep_all_effective |
| attribute_histories | attribute_histories_select_authenticated, attribute_histories_insert_system | attribute_histories_select_accessible, attribute_histories_insert_effective |
| reporter_districts | reporter_districts_select_own, reporter_districts_admin_coadmin | reporter_districts_select_own（維持）, reporter_districts_all_effective_admin |

※ 026 で `meetings` → `lordsday_meeting_records`、`attendance_records` → `lordsday_meeting_attendance`、`regular_member_list_items` → `lordsday_regular_list` にリネーム済みのため、028 ではリネーム後のテーブル名に対してポリシーを定義している。

### 5.5 locality の紐づけ方（テーブルごと）

- **locality 直**: localities（id）、districts（locality_id）、members（locality_id、NULL 許容）
- **district 経由**: groups → districts.locality_id、lordsday_meeting_records（district_id または locality_id）、prayer_meeting_*（district_id）、district_regular_list / district_semi_regular_list / district_pool_list
- **group 経由**: group_meeting_records / group_meeting_attendance、group_regular_list / group_semi_regular_list / group_pool_list、organic_dispatch_records
- **meeting 経由**: lordsday_meeting_attendance、lordsday_regular_list（lordsday_meeting_records の district_id / locality_id でスコープ）
- **member 経由**: member_local_enrollment_periods、attribute_histories（member.locality_id でスコープ）
- **reporter_districts**: district_id → districts.locality_id。自分の行は SELECT 可。編集は「自分」または「その district の locality で effective admin かつアクセス可能」の場合に許可。

---

## 6. 028 で触っていないテーブル

- **profiles**: 既存の RLS のまま。locality スコープ外。他ユーザーの**参照**は従来どおり admin/co_admin で全件可。**更新**はマイグレーション **031** で「global admin のみ他ユーザーの profiles を UPDATE 可」とするポリシー `profiles_update_global_admin` を追加済み（ロール管理ページ用）。
- **system_settings, audit_logs, login_logs**: 計画どおり locality スコープ外。閲覧・編集は global admin のみとする場合は別途ポリシー追加。

---

## 7. 型定義（アプリ側）

**ファイル**: `src/types/database.ts`

- **GlobalRole** / **LocalRole** 型、**Area** / **UserLocality** / **UserArea** / **LocalRoleRow** / **MemberLink** の型を追加。
- **Locality** に `area_id`、**Profile** に `global_role` を追加。
- **GLOBAL_ROLE_LABELS** / **LOCAL_ROLE_LABELS** を追加（表示用ラベル）。

---

## 8. 適用方法

- 027・028 は順に適用する。Supabase の「Migrations」で自動適用される場合と、手動で SQL Editor に貼って実行する場合がある。
- 本番適用前には、ステージングまたはローカルで 028 まで適用し、既存の reporter/viewer でログインして一覧・編集が問題なくできることを確認すること。

---

## 9. ロール管理ページの実装（031 + アプリ）

- **マイグレーション 031**: `profiles` に `profiles_update_global_admin` ポリシーを追加。`get_my_global_role() = 'admin'` のユーザーが他ユーザーの profiles を UPDATE 可能。
- **ページ**: 設定 > ユーザー・ロール管理（`/settings/roles`）。**global_role = admin** のユーザーのみアクセス可。未満の場合は `/settings` にリダイレクト。
- **機能**:
  - **招待**: メールアドレス入力で Supabase Auth の `inviteUserByEmail` を呼び出し（要 `SUPABASE_SERVICE_ROLE_KEY`）。招待後に profiles.global_role / user_areas / user_localities / local_roles を初期設定可能。
  - **グローバル権限の編集**: ユーザー選択後、global_role（admin / national_viewer / regional_viewer / なし）の保存。
  - **地域（user_areas）**: regional_viewer のとき、閲覧可能な地域を複数選択して保存。
  - **アクセス可能な地方（user_localities）**: グローバル権限なしのとき、切り替え候補となる地方を複数選択して保存。
  - **ローカル権限（local_roles）**: 同上のとき、地方ごとに local_admin / local_reporter / local_viewer を設定して保存。
  - **報告者の編集可能地区（reporter_districts）**: 地方の報告者はすべての地区にアクセス可能でよいため、ロール管理では区別しない（UI・編集機能は持たない）。
- **未実装（計画 2.5 の残り）**: 特になし。
- **関連ファイル**: `src/app/(dashboard)/settings/roles/page.tsx`、`RoleManagementClient.tsx`、`actions.ts`、`src/lib/supabase/server.ts`（createAdminClient）、`src/lib/cachedData.ts`（getCurrentUserWithProfile に global_role 追加）。

---

## 10. 今後の作業（計画からの抜粋）

1. **アプリ層の「現在の地方」**: Cookie `current_locality_id` + React Context / サーバー用ヘルパー。地方切り替え UI の追加。
2. **全データ取得の locality スコープ**: getCachedLocalities、getMeetingsLayoutData、members、meetings、attendance、organization-lists、dashboard、settings 等、すべての読み書きで `current_locality_id` でフィルタ。API・Server Actions でも同様にスコープし、他地方の id が渡されたら 403。
3. ~~**ロール管理ページ**~~: ✅ 実施済み（設定 > ユーザー・ロール管理、招待・global_role / user_areas / user_localities / local_roles の編集）。
4. **同一人物紐づけ**: member_links 用の管理者画面と、メンバー詳細での「他地方の同一人物」表示。
5. **テスト・ドキュメント**: 単一地方・複数地方・グローバル/地域/ローカル権限の組み合わせで、他地方のデータが見えないこと・正しい権限で操作できることを確認。リリースノートや運用ドキュメントの更新。

---

## 11. 未対応（今後の拡張候補）

027・028 および「現在の地方」Cookie + 地方切り替え UI の実装後も、**current_locality_id で明示的にスコープしていない**箇所が残っている。RLS により「アクセス可能な地方」のデータには制限されているが、**表示は「現在選択中の地方」に絞る**方針でいく場合は、以下の対応が必要になる。

### 10.1 api/meetings-list（週別集計 API）

| 項目 | 内容 |
|------|------|
| **役割** | 週別集計ページ用に、年・地方・localOnly を指定して週ごとの出欠・欠席アラートなどを返す。 |
| **現状** | 地方の決定は「クエリの `locality`」または**プロフィールの main_district の locality_id**。admin のみ `?locality=xxx` で任意の地方を指定可能。Cookie の `current_locality_id` は参照していない。 |
| **拡張案** | クエリに `locality` が無いときは **getEffectiveCurrentLocalityId()**（＝Cookie またはデフォルト地方）を使う。`?locality=all` は admin のみ許可するか、廃止するか方針を決める。 |

### 10.2 api/organization-lists（枠組設定用一覧 API）

| 項目 | 内容 |
|------|------|
| **役割** | 枠組設定画面で、地区・小組ごとの「レギュラー/非レギュラー/プール名一覧」を一括取得する。 |
| **現状** | RLS で見える districts / groups のみ取得。権限は「admin/co_admin なら全地区・小組」「それ以外は reporter_districts + main_district の locality に属するもののみ」。**現在選択中の地方**は見ていない。 |
| **拡張案** | **getEffectiveCurrentLocalityId()** を呼び、その地方に属する districts（locality_id = current）のみを対象にし、groups もその district 群に限定する。これにより「地方切り替えで枠組設定の対象がその地方だけになる」。 |

### 10.3 settings/organization（枠組設定ページ）

| 項目 | 内容 |
|------|------|
| **役割** | 地区・小組のレギュラー名・非レギュラー名・プール名の編集。localities / districts / groups を一覧して編集する。 |
| **現状** | localities / districts / groups を RLS 任せで取得。reporter の場合は reporter_districts から導いた locality のみ表示。**Cookie の current_locality_id は使っていない**。 |
| **拡張案** | 初期表示で **getEffectiveCurrentLocalityId()** を使い、「現在の地方」に属する localities（1件）・districts・groups だけを渡す。地方が複数ある場合はヘッダーの地方切り替えで current を変え、ページを再取得するとその地方の枠組だけ表示・編集されるようにする。 |

### 10.4 getDispatchMonitorData / getAttendanceMatrixData（ダッシュボード用 Server Actions）

| 項目 | 内容 |
|------|------|
| **役割** | ダッシュボードの「今週の派遣モニター」「出欠マトリクス」用データ。主日・小組・祈祷会の出欠と派遣記録を集計する。 |
| **現状** | createClient でクエリするだけで、**locality でフィルタしていない**。RLS により「アクセス可能な地方」のデータだけが返る。そのため、複数地方にアクセスできるユーザーは**全アクセス可能地方の合算**が表示される。 |
| **拡張案** | 各関数の冒頭で **getEffectiveCurrentLocalityId()** を取得し、その地方に属する district_id / group_id / lordsday_meeting_records（district または locality_id）のみを対象にクエリする。members も locality_id でスコープする。これで「現在選択中の地方」だけの派遣・出欠マトリクスになる。 |

---

### まとめ

- **RLS のみ**: 他地方（アクセス不可）のデータは返らないので**セキュリティ上の漏れはない**。
- **未対応の意味**: 「**表示を現在の地方に揃える**」という UX が、上記の API・ページ・actions ではまだ未実装というだけ。
- 対応する場合は、いずれも **getEffectiveCurrentLocalityId()**（Cookie ベースの「現在の地方」）を参照し、クエリや返却データをその locality に絞ればよい。

---

## 12. 関連ファイル一覧

| 種類 | パス |
|------|------|
| 計画書 | [docs/multi-region-support-plan.md](./multi-region-support-plan.md) |
| マイグレーション 027 | [supabase/migrations/027_multi_region_schema.sql](../supabase/migrations/027_multi_region_schema.sql) |
| マイグレーション 028 | [supabase/migrations/028_multi_region_rls_helpers.sql](../supabase/migrations/028_multi_region_rls_helpers.sql) |
| マイグレーション 029 | [supabase/migrations/029_areas_sort_order_and_seed.sql](../supabase/migrations/029_areas_sort_order_and_seed.sql)（地域の表示順・初期データ） |
| マイグレーション 030 | [supabase/migrations/030_prefectures.sql](../supabase/migrations/030_prefectures.sql)（都道府県テーブル・localities.prefecture_id・初期データ） |
| マイグレーション 031 | [supabase/migrations/031_profiles_update_global_admin.sql](../supabase/migrations/031_profiles_update_global_admin.sql)（ロール管理ページ用: global admin が他ユーザーの profiles を UPDATE 可能に） |
| マイグレーション 032 | [supabase/migrations/032_localities_drop_area_id.sql](../supabase/migrations/032_localities_drop_area_id.sql)（localities から area_id 削除。地域は prefecture 経由のみ。未設定地方は「その他」都道府県に紐づけ） |
| マイグレーション 033 | [supabase/migrations/033_prefectures_47_seed.sql](../supabase/migrations/033_prefectures_47_seed.sql)（都道府県 47 件を固定 UUID で投入） |
| マイグレーション 034 | [supabase/migrations/034_localities_prefecture_id_bulk.sql](../supabase/migrations/034_localities_prefecture_id_bulk.sql)（localities の prefecture_id 一括設定） |
| マイグレーション 035 | [supabase/migrations/035_localities_id_use_org_code.sql](../supabase/migrations/035_localities_id_use_org_code.sql)（localities.id を団体コードベース UUID に変更） |
| 型定義 | `src/types/database.ts` |
| バックアップ（例） | `~/backup_pre_multi_region_20260226.dump`（ユーザー環境） |

---

*最終更新: 2026-02-26（033・034・035 適用済みを反映）*
