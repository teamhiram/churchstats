-- 041_locality_rls_use_profile_locality_id.sql
-- 040 で追加した profiles.locality_id を RLS に反映。
-- global_role が null かつ user_localities が空のとき、profile.locality_id が設定されていればその地方のみアクセス可とする。
-- （直接作成で defaultLocalityId のみ設定したユーザーが、他地方を選べないようにする）

CREATE OR REPLACE FUNCTION public.get_my_accessible_locality_ids()
RETURNS SETOF uuid AS $$
  DECLARE
    grole global_role_enum;
    ul_count int;
    profile_locality uuid;
  BEGIN
    SELECT global_role, locality_id INTO grole, profile_locality FROM public.profiles WHERE id = auth.uid();
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
    -- global_role が null → user_localities があればそれのみ
    SELECT COUNT(*) INTO ul_count FROM public.user_localities WHERE user_id = auth.uid();
    IF ul_count > 0 THEN
      RETURN QUERY SELECT locality_id FROM public.user_localities WHERE user_id = auth.uid();
    ELSIF profile_locality IS NOT NULL THEN
      -- user_localities は空だが profile.locality_id が設定されている（直接作成でデフォルト地方のみ指定したユーザーなど）
      RETURN QUERY SELECT profile_locality;
    ELSE
      -- 後方互換: どちらもなければ全地方
      RETURN QUERY SELECT id FROM public.localities;
    END IF;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
