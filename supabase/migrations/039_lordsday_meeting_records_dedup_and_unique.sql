-- 集会重複を大元で防ぐ: 同一 (日付・種別・地区/地方/グループ) の重複行を1本にまとめ、以降は一意制約で新規重複を禁止する。

-- センチネル用 UUID（実データで使わない想定）
DO $$
DECLARE
  sentinel uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- 1) 出席・名簿を「代表行」(同一キーで id が最小の行) に寄せる
  UPDATE lordsday_meeting_attendance AS a
  SET meeting_id = g.kept_id
  FROM (
    SELECT id AS dup_id,
      MIN(id) OVER (
        PARTITION BY event_date, meeting_type,
          COALESCE(district_id, sentinel),
          COALESCE(locality_id, sentinel),
          COALESCE(group_id, sentinel)
      ) AS kept_id
    FROM lordsday_meeting_records
  ) g
  WHERE a.meeting_id = g.dup_id AND g.kept_id <> g.dup_id;

  -- 2) 同一 (meeting_id, member_id) の出席重複を1件に（代表に寄せた結果の重複を削除）
  DELETE FROM lordsday_meeting_attendance a
  USING lordsday_meeting_attendance b
  WHERE a.meeting_id = b.meeting_id AND a.member_id = b.member_id AND a.id > b.id;

  -- 3) 名簿を代表行に寄せる
  UPDATE lordsday_regular_list AS r
  SET meeting_id = g.kept_id
  FROM (
    SELECT id AS dup_id,
      MIN(id) OVER (
        PARTITION BY event_date, meeting_type,
          COALESCE(district_id, sentinel),
          COALESCE(locality_id, sentinel),
          COALESCE(group_id, sentinel)
      ) AS kept_id
    FROM lordsday_meeting_records
  ) g
  WHERE r.meeting_id = g.dup_id AND g.kept_id <> g.dup_id;

  -- 4) 名簿の (meeting_id, member_id) 重複を1件に
  DELETE FROM lordsday_regular_list a
  USING lordsday_regular_list b
  WHERE a.meeting_id = b.meeting_id AND a.member_id = b.member_id AND a.id > b.id;

  -- 5) 代表以外の集会行を削除
  DELETE FROM lordsday_meeting_records a
  USING lordsday_meeting_records b
  WHERE a.event_date = b.event_date AND a.meeting_type = b.meeting_type
    AND COALESCE(a.district_id, sentinel) = COALESCE(b.district_id, sentinel)
    AND COALESCE(a.locality_id, sentinel) = COALESCE(b.locality_id, sentinel)
    AND COALESCE(a.group_id, sentinel) = COALESCE(b.group_id, sentinel)
    AND a.id > b.id;
END $$;

-- 6) 同一 (日付・種別・地区/地方/グループ) の重複を禁止する一意インデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_lordsday_meeting_records_natural_key
  ON lordsday_meeting_records (
    event_date,
    meeting_type,
    COALESCE(district_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(locality_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

COMMENT ON INDEX idx_lordsday_meeting_records_natural_key IS '同一日の同一集会（地区/地方/グループ）の重複登録を防ぐ。挿入が重なった場合は unique_violation になるのでアプリで既存行を取得して利用すること。';
