-- 042_age_group_young_middle_senior.sql
-- 年代選択肢の追加: Young(青年), Middle(中年), LateMiddle(壮年), Senior(年長)
-- ラベルはアプリ側 CATEGORY_LABELS で定義。Adult は過渡期のため残し、ラベルは「社会人(年代不詳)」にアプリで変更。
-- 中学生・高校生のマージ（JuniorHigh/中高生）はアプリ側のみ対応（DB の enum は現状維持）。

ALTER TYPE category_enum ADD VALUE IF NOT EXISTS 'young';
ALTER TYPE category_enum ADD VALUE IF NOT EXISTS 'middle';
ALTER TYPE category_enum ADD VALUE IF NOT EXISTS 'late_middle';
ALTER TYPE category_enum ADD VALUE IF NOT EXISTS 'senior';
