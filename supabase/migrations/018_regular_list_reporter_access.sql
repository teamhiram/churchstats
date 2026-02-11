-- Phase 3: RLS 権限の拡張
-- district_regular_list / group_regular_list の INSERT/UPDATE/DELETE を報告者にも許可

DROP POLICY IF EXISTS "district_regular_list_insert_admin_coadmin" ON district_regular_list;
DROP POLICY IF EXISTS "district_regular_list_update_admin_coadmin" ON district_regular_list;
DROP POLICY IF EXISTS "district_regular_list_delete_admin_coadmin" ON district_regular_list;

CREATE POLICY "district_regular_list_insert_reporter_above" ON district_regular_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "district_regular_list_update_reporter_above" ON district_regular_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "district_regular_list_delete_reporter_above" ON district_regular_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));

DROP POLICY IF EXISTS "group_regular_list_insert_admin_coadmin" ON group_regular_list;
DROP POLICY IF EXISTS "group_regular_list_update_admin_coadmin" ON group_regular_list;
DROP POLICY IF EXISTS "group_regular_list_delete_admin_coadmin" ON group_regular_list;

CREATE POLICY "group_regular_list_insert_reporter_above" ON group_regular_list FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_regular_list_update_reporter_above" ON group_regular_list FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "group_regular_list_delete_reporter_above" ON group_regular_list FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'co_admin', 'reporter'));
