# 権限モデル整理メモ（plan）

## 用語の違い

### `profile.role`
- **所在**: `profiles.role`
- **意味**: “地方に依存しない”アプリ内の基本ロール（例: `admin / co_admin / reporter / viewer`）。
- **用途**: UI表示・機能制限など、グローバル（=地方別でない）な権限制御に使う。
- **注意**: これを「ローカル設定が使えるか」の判定に直接使うと、地方ロールとズレやすい。

### `profile.local_role`（※存在する場合）
- **所在**: `profiles.local_role` のような単一列を想定
- **意味**: “プロフィールに地方ロールも持たせたい”という発想の列。
- **根本問題**: **どの地方のロールか表現できない**ため、複数地方を扱う設計と相性が悪い。
- **結論**: `local_roles` を採用しているなら、`profiles.local_role` は **二重管理になりやすく不合理**。

### `local_roles.role`
- **所在**: `local_roles` テーブルの `role`
- **意味**: **(user_id, locality_id) に紐づく地方別ロール**（例: `local_admin / local_reporter / local_viewer`）。
- **用途**: 「市川では local_admin、調布では local_viewer」など、地方ごとの権限制御に使える。

## システム構成上の不合理（指摘）
- **地方ロールを `profiles` で持つ（`profile.local_role`）のは破綻しやすい**
  - 複数地方がある時点で「どの地方？」が曖昧になり、結局 `local_roles` が必要になって二重化する。
- **権限判定ロジックが散らばると必ず不整合が出る**
  - ある箇所は `profiles.role !== viewer` を条件にし、別箇所は `local_roles` を見ている、など。
  - さらに「システム管理者は全地方で許可」という特例もあるため、分散した条件式は漏れの温床。

## あるべき整理（提案）
- **権限のソースを分離して固定する**
  - **全体権限**: `profiles.global_role`（例: `admin`）と `profiles.role`
  - **地方権限**: `local_roles (user_id, locality_id, role)`
- **判定関数を1箇所に集約する**
  - 例: `canUseLocalSettings(user, localityId)` / `canManageLocalUsers(user, localityId)` のような関数を作り、
    UI表示・サーバーガード・サーバーアクションが同じロジックを参照する。
- **`profiles.local_role` は原則廃止（または厳密に役割を定義）**
  - もし持つなら「現在選択中地方のロールのキャッシュ」等だが、ズレの温床になりやすいため非推奨。

