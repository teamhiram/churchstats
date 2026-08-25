-- localities の id を docs/japan_cities.tsv の団体コードに基づく UUID に変更
-- UUID = 00000000-0000-0000-0000-000000 + 団体コード(6桁)。東京都(23区)のみ 130001（東京都の prefecture 相当）
-- 手順: 新 id で行を挿入 → 参照を更新 → 旧行を削除（FK のため一地方ずつ実行）

DO $$
DECLARE
  rec RECORD;
  old_id UUID;
  new_id UUID;
  org_codes JSONB := '{
    "08b9ad97-1a61-427f-bf8b-0917104bc49f": "232076",
    "0e005455-baf4-4c08-a9ac-521f04709b1b": "132012",
    "11111111-1111-1111-1111-111111111111": "132080",
    "14054bfa-4a5e-4711-900d-888906e7d3b2": "231002",
    "1aecb836-e31a-4b9c-8d02-d057736df8c6": "132098",
    "1f6427b2-47a2-416a-a65e-3dadf2fb1b76": "011002",
    "2f22f83f-5642-4d21-b092-e1ec3d41f5b5": "041009",
    "2fea6867-6ae3-4834-9547-8f351def4f77": "261009",
    "3163aab1-3bfb-4dfa-9012-0ca986641420": "221007",
    "34592367-0498-4ba2-83e7-958900dd4354": "212016",
    "3c6c0399-3490-475d-a9ca-84dc9b4d3c1b": "272272",
    "3f65ffb5-40c1-4bf6-b71a-032ee32bf61e": "122190",
    "4acfd2d7-1224-47d0-8240-3a3b5df36330": "130001",
    "4ba43c79-1c2e-46a6-b9a8-db26e969bbb7": "132128",
    "4c4ea462-245c-404a-a23d-5fdbc14fd14e": "401005",
    "4dc473a0-65ce-4770-ae33-baa61776ebea": "082201",
    "53a121d3-3ce3-480d-8504-368d3ad24e45": "121002",
    "54c01eb2-58ae-47d6-9845-fdcffc635187": "122114",
    "59decc36-6106-4ad6-9148-465f4cbde858": "151009",
    "615b2821-15d6-4334-912d-cefdfc937bdb": "162019",
    "61dfea17-3f86-4fcc-82dd-e224b6d3b331": "242071",
    "6785f3a9-58a7-440e-87f7-1c03896728a0": "141003",
    "6b1770d9-1125-4d30-b519-9d8370b6d329": "112038",
    "86ad121f-bbb6-4808-b0f6-6cb8f58868aa": "132292",
    "90b5c2e3-a959-48e2-9fe3-fc694897be7c": "122165",
    "91556301-86ca-4c14-b509-34df456df353": "142069",
    "a72bed03-fe85-4ea4-854c-75a50b86a034": "112330",
    "b63132d2-e4b7-4395-a7ed-410119dc320b": "362018",
    "ba7f5def-eef2-4312-ae99-334ae08862ee": "111007",
    "bb9f1a3d-f3a2-4022-9166-d33a537f66d9": "472018",
    "c0353f99-b81c-4891-8d8f-85626e8bb563": "141500",
    "c48a74dc-8102-4f1a-aea6-9184066c1c4b": "142051",
    "c4bb709c-b144-4a63-b14c-06ba1f42c2b2": "292010",
    "c82e1798-d580-48e7-8958-86728754a8db": "222135",
    "cc5eebf3-3f27-4666-aefb-d4cfba1e4fad": "401307",
    "cca9047d-a719-44e5-b699-3a250aec77a5": "062057",
    "d298a250-5b26-4109-a7a5-3513e811a339": "132110",
    "d58b4c0b-4655-4ca0-9fb6-31ce8f16959e": "082104",
    "e3b69eec-fa94-4c90-9ee8-3e1a6cb97780": "062049",
    "e3d0da5c-6f0a-42dd-af2a-a3100e850332": "281000",
    "e52a51a3-8dda-44ba-be58-0bbf8055558f": "341002",
    "e61eebf3-909a-4a81-9d93-2bf29728b458": "271004",
    "fae5f223-83f8-4b93-98a4-e4f30417465f": "122033",
    "fe78a057-f046-4496-8ef1-e506d3a18cee": "122076"
  }'::JSONB;
BEGIN
  FOR rec IN SELECT id::text AS old_id FROM localities
  LOOP
    IF org_codes ? rec.old_id THEN
      old_id := rec.old_id::UUID;
      new_id := ('00000000-0000-0000-0000-000000' || (org_codes ->> rec.old_id))::UUID;
      INSERT INTO localities (id, name, prefecture_id)
        SELECT new_id, name, prefecture_id FROM localities WHERE id = old_id;
      UPDATE districts SET locality_id = new_id WHERE locality_id = old_id;
      UPDATE members SET locality_id = new_id WHERE locality_id = old_id;
      UPDATE user_localities SET locality_id = new_id WHERE locality_id = old_id;
      UPDATE local_roles SET locality_id = new_id WHERE locality_id = old_id;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lordsday_meeting_records' AND column_name = 'locality_id') THEN
        UPDATE lordsday_meeting_records SET locality_id = new_id WHERE locality_id = old_id;
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'locality_id') THEN
        UPDATE meetings SET locality_id = new_id WHERE locality_id = old_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sunday_meeting_modes') THEN
        UPDATE sunday_meeting_modes SET locality_id = new_id WHERE locality_id = old_id;
      END IF;
      DELETE FROM localities WHERE id = old_id;
    END IF;
  END LOOP;
END $$;
