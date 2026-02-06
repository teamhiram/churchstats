-- キャッシュ無効化・コンフリクト検知用に districts / groups に updated_at を追加
ALTER TABLE districts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
