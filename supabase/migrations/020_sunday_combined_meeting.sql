-- Phase 5: 合同集会
-- 主日の合同集会用に meetings に locality_id を追加し、合同集会モードを管理するテーブルを追加

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS locality_id UUID REFERENCES localities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_locality_id ON meetings(locality_id);
COMMENT ON COLUMN meetings.locality_id IS '合同集会時のみ使用。district_id が NULL でこの値が設定されている場合、地方全体の合同集会を示す';

-- 主日の合同集会モード（日付・地方ごとに ON/OFF）
CREATE TABLE IF NOT EXISTS sunday_meeting_modes (
  event_date DATE NOT NULL,
  locality_id UUID NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
  is_combined BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (event_date, locality_id)
);
COMMENT ON TABLE sunday_meeting_modes IS '主日の合同集会モード。is_combined=true のとき、その地方は1集会として登録する';
