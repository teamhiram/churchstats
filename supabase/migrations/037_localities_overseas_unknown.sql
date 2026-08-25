-- locality に「海外」「不明」の選択肢を追加（prefecture に属さない特殊地方）

INSERT INTO localities (name, prefecture_id)
SELECT n, NULL
FROM (VALUES ('海外'), ('不明')) AS t(n)
WHERE NOT EXISTS (SELECT 1 FROM localities l WHERE l.name = t.n);
