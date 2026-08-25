-- ロール管理ページ用: global admin が他ユーザーの profiles を更新可能にする
-- docs/multi-region-support-plan.md 2.5 / 実装記録 6. profiles の扱い

-- profiles の UPDATE: 自分の行は既存の profiles_update_own、他ユーザーは global admin のみ
CREATE POLICY "profiles_update_global_admin" ON profiles FOR UPDATE TO authenticated
  USING (get_my_global_role() = 'admin');
