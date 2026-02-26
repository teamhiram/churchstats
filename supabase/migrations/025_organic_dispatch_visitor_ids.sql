-- 有機的派遣記録に「訪問者」を追加（名簿メンバーを複数選択可能）
-- visitor_ids: 訪問したメンバーの member_id の配列（members.id を参照）

ALTER TABLE organic_dispatch_records
  ADD COLUMN IF NOT EXISTS visitor_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN organic_dispatch_records.visitor_ids IS '訪問者（名簿のメンバーIDの配列）。複数選択可。';

-- 参照整合性はアプリ層で保証（PostgreSQL は配列要素への FK をネイティブで持たないため）
