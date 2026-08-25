-- lordsday_meeting_records: DELETE を許可（デバッグ「集会重複検知」で重複集会を削除するため）
-- UPDATE と同じく、その地方で effective_role が admin/co_admin/reporter のユーザーのみ削除可
CREATE POLICY "lordsday_meeting_records_delete_effective" ON lordsday_meeting_records FOR DELETE TO authenticated
  USING (
    (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
    OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter'))
  );
