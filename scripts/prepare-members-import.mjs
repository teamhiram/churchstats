/**
 * members インポート用 CSV を整形する。
 * - members.name (NOT NULL) のため、last_name/first_name から name を生成
 * - furigana も last_furigana/first_furigana から生成（任意）
 * - group_id の文字列 "null" は空欄に変換（NULL 扱いにしやすくする）
 *
 * 使い方:
 *   node scripts/prepare-members-import.mjs "<input.csv>" "<output.csv>"
 */

import fs from "fs";
import path from "path";

const INPUT =
  process.argv[2] ??
  path.join(process.cwd(), "_Prep", "ichikawa_churchStats_migration - to-be-imported (5).csv");
const OUTPUT =
  process.argv[3] ??
  path.join(process.cwd(), "_Prep", "ichikawa_churchStats_migration - prepared.csv");

function parseCsvRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // NOTE: この CSV はダブルクォートのエスケープ（""）がほぼ無い前提で簡易対応
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      result.push(current);
      current = "";
      if (c === "\n") break;
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function csvEscape(value) {
  const s = value ?? "";
  if (s === "") return "";
  if (/[,"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatMemberName(last, first) {
  const l = (last ?? "").trim();
  const f = (first ?? "").trim();
  if (!l && !f) return "";
  if (!l) return f;
  if (!f) return l;
  return `${l} ${f}`;
}

function formatMemberFurigana(lastF, firstF) {
  const l = (lastF ?? "").trim();
  const f = (firstF ?? "").trim();
  if (!l && !f) return "";
  return `${l}${f}`;
}

const content = fs.readFileSync(INPUT, "utf-8");
const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
if (lines.length < 2) {
  console.error("CSV has no header or rows.");
  process.exit(1);
}

const header = parseCsvRow(lines[0]).map((h) => h.trim());
const idx = (name) => header.indexOf(name);

const requiredCols = [
  "last_name",
  "first_name",
  "last_furigana",
  "first_furigana",
  "gender",
  "locality_id",
  "district_id",
  "group_id",
  "baptism_year",
  "baptism_month",
  "baptism_day",
  "is_baptized",
  "age_group",
  "memo",
];
for (const c of requiredCols) {
  if (idx(c) < 0) {
    console.error(`Missing required column: ${c}`);
    process.exit(1);
  }
}

const outHeader = ["name", "furigana", ...header];
const outLines = [outHeader.join(",")];

for (let i = 1; i < lines.length; i++) {
  const row = parseCsvRow(lines[i]);
  const get = (c) => (row[idx(c)] ?? "").trim();

  const last = get("last_name");
  const first = get("first_name");
  const lastF = get("last_furigana");
  const firstF = get("first_furigana");

  const name = formatMemberName(last, first);
  if (!name) {
    console.error(`Row ${i + 1}: name is empty (last_name/first_name both empty).`);
    process.exit(1);
  }
  const furigana = formatMemberFurigana(lastF, firstF);

  // group_id の "null" を空欄へ
  if (row[idx("group_id")]?.trim() === "null") {
    row[idx("group_id")] = "";
  }

  const outRow = [name, furigana, ...row].map(csvEscape).join(",");
  outLines.push(outRow);
}

fs.writeFileSync(OUTPUT, outLines.join("\n") + "\n", "utf-8");
console.log(`Wrote: ${OUTPUT}`);

