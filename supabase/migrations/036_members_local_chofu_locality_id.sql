-- 名簿のうち is_local = TRUE のメンバーをすべて調布の locality_id に統一する
-- 調布の locality_id: 00000000-0000-0000-0000-000000132080（035 で org_code ベースに変更後の値）

UPDATE members
SET locality_id = '00000000-0000-0000-0000-000000132080'
WHERE is_local = TRUE
  AND (locality_id IS NULL OR locality_id <> '00000000-0000-0000-0000-000000132080');
