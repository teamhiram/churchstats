-- members の物理削除は、対象地方で effective admin の場合のみ許可する
DROP POLICY IF EXISTS "members_delete_effective_admin" ON members;

CREATE POLICY "members_delete_effective_admin" ON members FOR DELETE TO authenticated
  USING (
    locality_id IS NOT NULL
    AND can_access_locality(locality_id)
    AND get_my_effective_role(locality_id) IN ('admin', 'co_admin')
  );
