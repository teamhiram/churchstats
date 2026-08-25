-- 多地方運用対応: RLS ヘルパーと locality スコープ付きポリシー
-- get_my_accessible_locality_ids() / get_my_effective_role(locality_id) を追加し、
-- 既存テーブルのポリシーを「アクセス可能 locality + effective role」ベースに変更する。
-- 既存ユーザー（global_role 未設定かつ user_localities なし）は全地方アクセス可として扱う（後方互換）。

-- 0) lordsday_meeting_records に locality_id が無い環境用（020 未適用時）。020 済みなら No-op
ALTER TABLE lordsday_meeting_records ADD COLUMN IF NOT EXISTS locality_id UUID REFERENCES localities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lordsday_meeting_records_locality_id ON lordsday_meeting_records(locality_id);

-- 1) アクセス可能な locality id の一覧を返す（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION public.get_my_accessible_locality_ids()
RETURNS SETOF uuid AS $$
  DECLARE
    grole global_role_enum;
    ul_count int;
  BEGIN
    SELECT global_role INTO grole FROM public.profiles WHERE id = auth.uid();
    -- グローバル admin / national_viewer → 全地方
    IF grole IN ('admin', 'national_viewer') THEN
      RETURN QUERY SELECT id FROM public.localities;
      RETURN;
    END IF;
    -- regional_viewer → user_areas に紐づく地域の地方
    IF grole = 'regional_viewer' THEN
      RETURN QUERY
        SELECT DISTINCT l.id FROM public.localities l
        INNER JOIN public.user_areas ua ON l.area_id = ua.area_id
        WHERE ua.user_id = auth.uid();
      RETURN;
    END IF;
    -- global_role が null → user_localities があればそれのみ、なければ後方互換で全地方
    SELECT COUNT(*) INTO ul_count FROM public.user_localities WHERE user_id = auth.uid();
    IF ul_count > 0 THEN
      RETURN QUERY SELECT locality_id FROM public.user_localities WHERE user_id = auth.uid();
    ELSE
      RETURN QUERY SELECT id FROM public.localities;
    END IF;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2) 指定地方での実効ロールを返す（role_enum）。NULL はアクセス不可。
CREATE OR REPLACE FUNCTION public.get_my_effective_role(p_locality_id uuid)
RETURNS role_enum AS $$
  DECLARE
    grole global_role_enum;
    lrole local_role_enum;
    prole role_enum;
  BEGIN
    SELECT global_role, role INTO grole, prole FROM public.profiles WHERE id = auth.uid();
    IF grole = 'admin' THEN
      RETURN 'admin'::role_enum;
    END IF;
    IF grole = 'national_viewer' THEN
      RETURN 'viewer'::role_enum;
    END IF;
    IF grole = 'regional_viewer' THEN
      IF EXISTS (
        SELECT 1 FROM public.localities l
        INNER JOIN public.user_areas ua ON l.area_id = ua.area_id AND ua.user_id = auth.uid()
        WHERE l.id = p_locality_id
      ) THEN
        RETURN 'viewer'::role_enum;
      END IF;
      RETURN NULL;
    END IF;
    -- global_role が null → local_roles を参照、なければ従来の profiles.role で後方互換
    SELECT role INTO lrole FROM public.local_roles WHERE user_id = auth.uid() AND locality_id = p_locality_id;
    IF lrole IS NOT NULL THEN
      RETURN CASE lrole
        WHEN 'local_admin' THEN 'admin'::role_enum
        WHEN 'local_reporter' THEN 'reporter'::role_enum
        WHEN 'local_viewer' THEN 'viewer'::role_enum
      END;
    END IF;
    -- 後方互換: その地方に local_roles が無い場合は profiles.role（co_admin → admin 扱いで許容）
    IF prole = 'co_admin' THEN RETURN 'admin'::role_enum; END IF;
    RETURN prole;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3) 指定 locality にアクセス可能か
CREATE OR REPLACE FUNCTION public.can_access_locality(p_locality_id uuid)
RETURNS boolean AS $$
  SELECT p_locality_id IN (SELECT get_my_accessible_locality_ids());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4) localities: アクセス可能な地方のみ見える、変更は effective role が admin/co_admin のとき
DROP POLICY IF EXISTS "localities_select_authenticated" ON localities;
DROP POLICY IF EXISTS "localities_all_admin_coadmin" ON localities;
CREATE POLICY "localities_select_accessible" ON localities FOR SELECT TO authenticated
  USING (can_access_locality(id));
CREATE POLICY "localities_all_effective_admin" ON localities FOR ALL TO authenticated
  USING (can_access_locality(id) AND get_my_effective_role(id) IN ('admin', 'co_admin'));

-- 5) districts: locality がアクセス可能なもののみ
DROP POLICY IF EXISTS "districts_select_authenticated" ON districts;
DROP POLICY IF EXISTS "districts_all_admin_coadmin" ON districts;
CREATE POLICY "districts_select_accessible" ON districts FOR SELECT TO authenticated
  USING (can_access_locality(locality_id));
CREATE POLICY "districts_all_effective_admin" ON districts FOR ALL TO authenticated
  USING (can_access_locality(locality_id) AND get_my_effective_role(locality_id) IN ('admin', 'co_admin'));

-- 6) groups: district 経由で locality がアクセス可能なもののみ
DROP POLICY IF EXISTS "groups_select_authenticated" ON groups;
DROP POLICY IF EXISTS "groups_insert_delete_admin_coadmin" ON groups;
DROP POLICY IF EXISTS "groups_insert_delete_admin_coadmin2" ON groups;
DROP POLICY IF EXISTS "groups_update_admin_coadmin_reporter" ON groups;
CREATE POLICY "groups_select_accessible" ON groups FOR SELECT TO authenticated
  USING (
    district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids()))
  );
CREATE POLICY "groups_insert_effective" ON groups FOR INSERT TO authenticated
  WITH CHECK (
    district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids()))
    AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter')
  );
CREATE POLICY "groups_update_effective" ON groups FOR UPDATE TO authenticated
  USING (
    district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids()))
    AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter')
  );
CREATE POLICY "groups_delete_effective_admin" ON groups FOR DELETE TO authenticated
  USING (
    district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids()))
    AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin')
  );

-- 7) members: locality_id がアクセス可能なもののみ
DROP POLICY IF EXISTS "members_select_authenticated" ON members;
DROP POLICY IF EXISTS "members_insert_reporter_above" ON members;
DROP POLICY IF EXISTS "members_update_reporter_above" ON members;
CREATE POLICY "members_select_accessible" ON members FOR SELECT TO authenticated
  USING (locality_id IS NULL OR can_access_locality(locality_id));
CREATE POLICY "members_insert_effective" ON members FOR INSERT TO authenticated
  WITH CHECK (
    locality_id IS NULL OR (can_access_locality(locality_id) AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter'))
  );
CREATE POLICY "members_update_effective" ON members FOR UPDATE TO authenticated
  USING (
    locality_id IS NULL OR (can_access_locality(locality_id) AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter'))
  );

-- 8) lordsday_meeting_records: district_id または locality_id 経由でアクセス可能なもののみ
--    (026 で meetings → lordsday_meeting_records にリネーム済み)
DROP POLICY IF EXISTS "meetings_select_authenticated" ON lordsday_meeting_records;
DROP POLICY IF EXISTS "meetings_insert_reporter_above" ON lordsday_meeting_records;
DROP POLICY IF EXISTS "meetings_update_reporter_above" ON lordsday_meeting_records;
CREATE POLICY "lordsday_meeting_records_select_accessible" ON lordsday_meeting_records FOR SELECT TO authenticated
  USING (
    (district_id IS NOT NULL AND (SELECT locality_id FROM districts WHERE id = district_id) IN (SELECT get_my_accessible_locality_ids()))
    OR (locality_id IS NOT NULL AND can_access_locality(locality_id))
  );
CREATE POLICY "lordsday_meeting_records_insert_effective" ON lordsday_meeting_records FOR INSERT TO authenticated
  WITH CHECK (
    (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
    OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter'))
  );
CREATE POLICY "lordsday_meeting_records_update_effective" ON lordsday_meeting_records FOR UPDATE TO authenticated
  USING (
    (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
    OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter'))
  );

-- 9) lordsday_meeting_attendance: meeting が lordsday_meeting_records にありアクセス可能なら可
DROP POLICY IF EXISTS "attendance_records_select_authenticated" ON lordsday_meeting_attendance;
DROP POLICY IF EXISTS "attendance_records_insert_reporter_above" ON lordsday_meeting_attendance;
DROP POLICY IF EXISTS "attendance_records_update_reporter_above" ON lordsday_meeting_attendance;
DROP POLICY IF EXISTS "attendance_records_delete_reporter_above" ON lordsday_meeting_attendance;
CREATE POLICY "lordsday_attendance_select_accessible" ON lordsday_meeting_attendance FOR SELECT TO authenticated
  USING (
    meeting_id IN (SELECT id FROM lordsday_meeting_records WHERE
      (district_id IS NOT NULL AND (SELECT locality_id FROM districts WHERE id = district_id) IN (SELECT get_my_accessible_locality_ids()))
      OR (locality_id IS NOT NULL AND can_access_locality(locality_id)))
  );
CREATE POLICY "lordsday_attendance_insert_effective" ON lordsday_meeting_attendance FOR INSERT TO authenticated
  WITH CHECK (
    meeting_id IN (SELECT id FROM lordsday_meeting_records WHERE
      (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
      OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter')))
  );
CREATE POLICY "lordsday_attendance_update_effective" ON lordsday_meeting_attendance FOR UPDATE TO authenticated
  USING (
    meeting_id IN (SELECT id FROM lordsday_meeting_records WHERE
      (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
      OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter')))
  );
CREATE POLICY "lordsday_attendance_delete_effective" ON lordsday_meeting_attendance FOR DELETE TO authenticated
  USING (
    meeting_id IN (SELECT id FROM lordsday_meeting_records WHERE
      (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
      OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter')))
  );

-- 10) lordsday_regular_list: meeting がアクセス可能なら可
DROP POLICY IF EXISTS "regular_member_list_items_select_authenticated" ON lordsday_regular_list;
DROP POLICY IF EXISTS "regular_member_list_items_all_reporter_above" ON lordsday_regular_list;
CREATE POLICY "lordsday_regular_list_select_accessible" ON lordsday_regular_list FOR SELECT TO authenticated
  USING (
    meeting_id IN (SELECT id FROM lordsday_meeting_records WHERE
      (district_id IS NOT NULL AND (SELECT locality_id FROM districts WHERE id = district_id) IN (SELECT get_my_accessible_locality_ids()))
      OR (locality_id IS NOT NULL AND can_access_locality(locality_id)))
  );
CREATE POLICY "lordsday_regular_list_all_effective" ON lordsday_regular_list FOR ALL TO authenticated
  USING (
    meeting_id IN (SELECT id FROM lordsday_meeting_records WHERE
      (district_id IS NOT NULL AND (SELECT get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id))) IN ('admin', 'co_admin', 'reporter'))
      OR (locality_id IS NOT NULL AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter')))
  );

-- 11) group_meeting_records / group_meeting_attendance: group の district の locality でスコープ
DROP POLICY IF EXISTS "group_meeting_records_select_authenticated" ON group_meeting_records;
DROP POLICY IF EXISTS "group_meeting_records_insert_reporter_above" ON group_meeting_records;
DROP POLICY IF EXISTS "group_meeting_records_update_reporter_above" ON group_meeting_records;
DROP POLICY IF EXISTS "group_meeting_records_delete_reporter_above" ON group_meeting_records;
CREATE POLICY "group_meeting_records_select_accessible" ON group_meeting_records FOR SELECT TO authenticated
  USING (
    group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE d.locality_id IN (SELECT get_my_accessible_locality_ids()))
  );
CREATE POLICY "group_meeting_records_insert_effective" ON group_meeting_records FOR INSERT TO authenticated
  WITH CHECK (
    group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter'))
  );
CREATE POLICY "group_meeting_records_update_effective" ON group_meeting_records FOR UPDATE TO authenticated
  USING (
    group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter'))
  );
CREATE POLICY "group_meeting_records_delete_effective" ON group_meeting_records FOR DELETE TO authenticated
  USING (
    group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter'))
  );

DROP POLICY IF EXISTS "group_meeting_attendance_select_authenticated" ON group_meeting_attendance;
DROP POLICY IF EXISTS "group_meeting_attendance_insert_reporter_above" ON group_meeting_attendance;
DROP POLICY IF EXISTS "group_meeting_attendance_update_reporter_above" ON group_meeting_attendance;
DROP POLICY IF EXISTS "group_meeting_attendance_delete_reporter_above" ON group_meeting_attendance;
CREATE POLICY "group_meeting_attendance_select_accessible" ON group_meeting_attendance FOR SELECT TO authenticated
  USING (
    group_meeting_record_id IN (
      SELECT gmr.id FROM group_meeting_records gmr
      JOIN groups g ON gmr.group_id = g.id
      JOIN districts d ON g.district_id = d.id
      WHERE d.locality_id IN (SELECT get_my_accessible_locality_ids())
    )
  );
CREATE POLICY "group_meeting_attendance_insert_effective" ON group_meeting_attendance FOR INSERT TO authenticated
  WITH CHECK (
    group_meeting_record_id IN (
      SELECT gmr.id FROM group_meeting_records gmr
      JOIN groups g ON gmr.group_id = g.id
      JOIN districts d ON g.district_id = d.id
      WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );
CREATE POLICY "group_meeting_attendance_update_effective" ON group_meeting_attendance FOR UPDATE TO authenticated
  USING (
    group_meeting_record_id IN (
      SELECT gmr.id FROM group_meeting_records gmr
      JOIN groups g ON gmr.group_id = g.id
      JOIN districts d ON g.district_id = d.id
      WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );
CREATE POLICY "group_meeting_attendance_delete_effective" ON group_meeting_attendance FOR DELETE TO authenticated
  USING (
    group_meeting_record_id IN (
      SELECT gmr.id FROM group_meeting_records gmr
      JOIN groups g ON gmr.group_id = g.id
      JOIN districts d ON g.district_id = d.id
      WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );

-- 12) prayer_meeting_records / prayer_meeting_attendance: district の locality でスコープ
DROP POLICY IF EXISTS "prayer_meeting_records_select_authenticated" ON prayer_meeting_records;
DROP POLICY IF EXISTS "prayer_meeting_records_insert_reporter_above" ON prayer_meeting_records;
DROP POLICY IF EXISTS "prayer_meeting_records_update_reporter_above" ON prayer_meeting_records;
DROP POLICY IF EXISTS "prayer_meeting_records_delete_reporter_above" ON prayer_meeting_records;
CREATE POLICY "prayer_meeting_records_select_accessible" ON prayer_meeting_records FOR SELECT TO authenticated
  USING (district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "prayer_meeting_records_insert_effective" ON prayer_meeting_records FOR INSERT TO authenticated
  WITH CHECK (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "prayer_meeting_records_update_effective" ON prayer_meeting_records FOR UPDATE TO authenticated
  USING (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin', 'reporter'));
CREATE POLICY "prayer_meeting_records_delete_effective" ON prayer_meeting_records FOR DELETE TO authenticated
  USING (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin', 'reporter'));

DROP POLICY IF EXISTS "prayer_meeting_attendance_select_authenticated" ON prayer_meeting_attendance;
DROP POLICY IF EXISTS "prayer_meeting_attendance_insert_reporter_above" ON prayer_meeting_attendance;
DROP POLICY IF EXISTS "prayer_meeting_attendance_update_reporter_above" ON prayer_meeting_attendance;
DROP POLICY IF EXISTS "prayer_meeting_attendance_delete_reporter_above" ON prayer_meeting_attendance;
CREATE POLICY "prayer_meeting_attendance_select_accessible" ON prayer_meeting_attendance FOR SELECT TO authenticated
  USING (
    prayer_meeting_record_id IN (
      SELECT id FROM prayer_meeting_records WHERE district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids()))
    )
  );
CREATE POLICY "prayer_meeting_attendance_insert_effective" ON prayer_meeting_attendance FOR INSERT TO authenticated
  WITH CHECK (
    prayer_meeting_record_id IN (
      SELECT pmr.id FROM prayer_meeting_records pmr
      JOIN districts d ON pmr.district_id = d.id
      WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );
CREATE POLICY "prayer_meeting_attendance_update_effective" ON prayer_meeting_attendance FOR UPDATE TO authenticated
  USING (
    prayer_meeting_record_id IN (
      SELECT pmr.id FROM prayer_meeting_records pmr
      JOIN districts d ON pmr.district_id = d.id
      WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );
CREATE POLICY "prayer_meeting_attendance_delete_effective" ON prayer_meeting_attendance FOR DELETE TO authenticated
  USING (
    prayer_meeting_record_id IN (
      SELECT pmr.id FROM prayer_meeting_records pmr
      JOIN districts d ON pmr.district_id = d.id
      WHERE get_my_effective_role(d.locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );

-- 13) district_regular_list / group_regular_list: district または group 経由で locality スコープ
DROP POLICY IF EXISTS "district_regular_list_select_authenticated" ON district_regular_list;
DROP POLICY IF EXISTS "district_regular_list_insert_reporter_above" ON district_regular_list;
DROP POLICY IF EXISTS "district_regular_list_update_reporter_above" ON district_regular_list;
DROP POLICY IF EXISTS "district_regular_list_delete_reporter_above" ON district_regular_list;
CREATE POLICY "district_regular_list_select_accessible" ON district_regular_list FOR SELECT TO authenticated
  USING (district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "district_regular_list_all_effective" ON district_regular_list FOR ALL TO authenticated
  USING (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin', 'reporter'));

DROP POLICY IF EXISTS "group_regular_list_select_authenticated" ON group_regular_list;
DROP POLICY IF EXISTS "group_regular_list_insert_reporter_above" ON group_regular_list;
DROP POLICY IF EXISTS "group_regular_list_update_reporter_above" ON group_regular_list;
DROP POLICY IF EXISTS "group_regular_list_delete_reporter_above" ON group_regular_list;
CREATE POLICY "group_regular_list_select_accessible" ON group_regular_list FOR SELECT TO authenticated
  USING (group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE d.locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "group_regular_list_all_effective" ON group_regular_list FOR ALL TO authenticated
  USING (
    (SELECT get_my_effective_role((SELECT d.locality_id FROM groups g JOIN districts d ON g.district_id = d.id WHERE g.id = group_id))) IN ('admin', 'co_admin', 'reporter')
  );

-- 14) district_semi_regular_list / group_semi_regular_list
DROP POLICY IF EXISTS "district_semi_regular_list_select_authenticated" ON district_semi_regular_list;
DROP POLICY IF EXISTS "district_semi_regular_list_insert_reporter_above" ON district_semi_regular_list;
DROP POLICY IF EXISTS "district_semi_regular_list_update_reporter_above" ON district_semi_regular_list;
DROP POLICY IF EXISTS "district_semi_regular_list_delete_reporter_above" ON district_semi_regular_list;
CREATE POLICY "district_semi_regular_list_select_accessible" ON district_semi_regular_list FOR SELECT TO authenticated
  USING (district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "district_semi_regular_list_all_effective" ON district_semi_regular_list FOR ALL TO authenticated
  USING (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin', 'reporter'));

DROP POLICY IF EXISTS "group_semi_regular_list_select_authenticated" ON group_semi_regular_list;
DROP POLICY IF EXISTS "group_semi_regular_list_insert_reporter_above" ON group_semi_regular_list;
DROP POLICY IF EXISTS "group_semi_regular_list_update_reporter_above" ON group_semi_regular_list;
DROP POLICY IF EXISTS "group_semi_regular_list_delete_reporter_above" ON group_semi_regular_list;
CREATE POLICY "group_semi_regular_list_select_accessible" ON group_semi_regular_list FOR SELECT TO authenticated
  USING (group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE d.locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "group_semi_regular_list_all_effective" ON group_semi_regular_list FOR ALL TO authenticated
  USING (
    (SELECT get_my_effective_role((SELECT d.locality_id FROM groups g JOIN districts d ON g.district_id = d.id WHERE g.id = group_id))) IN ('admin', 'co_admin', 'reporter')
  );

-- 15) district_pool_list / group_pool_list
DROP POLICY IF EXISTS "district_pool_list_select_authenticated" ON district_pool_list;
DROP POLICY IF EXISTS "district_pool_list_insert_reporter_above" ON district_pool_list;
DROP POLICY IF EXISTS "district_pool_list_update_reporter_above" ON district_pool_list;
DROP POLICY IF EXISTS "district_pool_list_delete_reporter_above" ON district_pool_list;
CREATE POLICY "district_pool_list_select_accessible" ON district_pool_list FOR SELECT TO authenticated
  USING (district_id IN (SELECT id FROM districts WHERE locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "district_pool_list_all_effective" ON district_pool_list FOR ALL TO authenticated
  USING (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin', 'reporter'));

DROP POLICY IF EXISTS "group_pool_list_select_authenticated" ON group_pool_list;
DROP POLICY IF EXISTS "group_pool_list_insert_reporter_above" ON group_pool_list;
DROP POLICY IF EXISTS "group_pool_list_update_reporter_above" ON group_pool_list;
DROP POLICY IF EXISTS "group_pool_list_delete_reporter_above" ON group_pool_list;
CREATE POLICY "group_pool_list_select_accessible" ON group_pool_list FOR SELECT TO authenticated
  USING (group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE d.locality_id IN (SELECT get_my_accessible_locality_ids())));
CREATE POLICY "group_pool_list_all_effective" ON group_pool_list FOR ALL TO authenticated
  USING (
    (SELECT get_my_effective_role((SELECT d.locality_id FROM groups g JOIN districts d ON g.district_id = d.id WHERE g.id = group_id))) IN ('admin', 'co_admin', 'reporter')
  );

-- 16) organic_dispatch_records: group の locality でスコープ
DROP POLICY IF EXISTS "organic_dispatch_select_authenticated" ON organic_dispatch_records;
DROP POLICY IF EXISTS "organic_dispatch_insert_reporter_above" ON organic_dispatch_records;
DROP POLICY IF EXISTS "organic_dispatch_update_reporter_above" ON organic_dispatch_records;
DROP POLICY IF EXISTS "organic_dispatch_delete_reporter_above" ON organic_dispatch_records;
CREATE POLICY "organic_dispatch_select_accessible" ON organic_dispatch_records FOR SELECT TO authenticated
  USING (
    group_id IN (SELECT g.id FROM groups g JOIN districts d ON g.district_id = d.id WHERE d.locality_id IN (SELECT get_my_accessible_locality_ids()))
  );
CREATE POLICY "organic_dispatch_all_effective" ON organic_dispatch_records FOR ALL TO authenticated
  USING (
    (SELECT get_my_effective_role((SELECT d.locality_id FROM groups g JOIN districts d ON g.district_id = d.id WHERE g.id = group_id))) IN ('admin', 'co_admin', 'reporter')
  );

-- 17) member_local_enrollment_periods: member の locality でスコープ
DROP POLICY IF EXISTS "mlep_select_authenticated" ON member_local_enrollment_periods;
DROP POLICY IF EXISTS "mlep_insert_reporter_above" ON member_local_enrollment_periods;
DROP POLICY IF EXISTS "mlep_update_reporter_above" ON member_local_enrollment_periods;
DROP POLICY IF EXISTS "mlep_delete_reporter_above" ON member_local_enrollment_periods;
CREATE POLICY "mlep_select_accessible" ON member_local_enrollment_periods FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE locality_id IS NULL OR can_access_locality(locality_id)));
CREATE POLICY "mlep_all_effective" ON member_local_enrollment_periods FOR ALL TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE locality_id IS NOT NULL AND can_access_locality(locality_id)
        AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );

-- 18) attribute_histories: member の locality でスコープ
DROP POLICY IF EXISTS "attribute_histories_select_authenticated" ON attribute_histories;
DROP POLICY IF EXISTS "attribute_histories_insert_system" ON attribute_histories;
CREATE POLICY "attribute_histories_select_accessible" ON attribute_histories FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE locality_id IS NULL OR can_access_locality(locality_id)));
CREATE POLICY "attribute_histories_insert_effective" ON attribute_histories FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE locality_id IS NOT NULL AND can_access_locality(locality_id)
        AND get_my_effective_role(locality_id) IN ('admin', 'co_admin', 'reporter')
    )
  );

-- 19) reporter_districts: 自分の行のみ SELECT、編集は effective admin かつ その district の locality がアクセス可能な場合
DROP POLICY IF EXISTS "reporter_districts_select_own" ON reporter_districts;
DROP POLICY IF EXISTS "reporter_districts_admin_coadmin" ON reporter_districts;
CREATE POLICY "reporter_districts_select_own" ON reporter_districts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reporter_districts_all_effective_admin" ON reporter_districts FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR (get_my_effective_role((SELECT locality_id FROM districts WHERE id = district_id)) IN ('admin', 'co_admin')
        AND can_access_locality((SELECT locality_id FROM districts WHERE id = district_id)))
  );
