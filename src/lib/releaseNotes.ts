import { promises as fs } from "node:fs";
import path from "node:path";

type ReleaseNoteEntry = {
  version: string;
  pushDate: string | null;
  purpose: string | null;
  benefits: string[];
};

const RELEASE_NOTES_DIR = path.join(process.cwd(), "_ReleaseNotes");
const VERSION_FILE_RE = /^(\d+\.\d+\.\d+)(?:[_-].+)?\.md$/;
const TECHNICAL_TERMS_RE =
  /(supabase|sql|migration|schema|table|index|ci|github actions|playwright|vitest|テスト基盤|package-lock|vercel|node|warning|ebadengine|api|env|ロックファイル)/i;

const benefitRules: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /(速度|高速|応答|パフォーマンス|リージョン)/i,
    message: "画面表示やデータ読み込みが、これまでよりスムーズになります。",
  },
  {
    pattern: /(重複|検知|ミス|整合)/i,
    message: "入力ミスや重複登録を早く見つけやすくなり、運用の手戻りを減らせます。",
  },
  {
    pattern: /(表示設定|表示|見やす|レイアウト|UI)/i,
    message: "必要な情報を見やすく確認しやすくなり、日々の操作負担を減らせます。",
  },
  {
    pattern: /(ロール|権限|管理者|アクセス)/i,
    message: "役割に応じた安全な運用がしやすくなり、権限管理の不安を減らせます。",
  },
  {
    pattern: /(名簿|プロフィール|個人ページ|氏名)/i,
    message: "名簿管理や個人ページの更新がしやすくなり、情報メンテナンスの時間を短縮できます。",
  },
  {
    pattern: /(バックアップ|リストア|復元)/i,
    message: "万一のときに備えたデータ保全がしやすくなり、安心して運用できます。",
  },
  {
    pattern: /(不具合|安定|テスト|デプロイ|警告|エラー)/i,
    message: "動作の安定性が上がり、日常利用での予期せぬ不具合リスクを下げられます。",
  },
];

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map((v) => Number(v));
  const pb = b.split(".").map((v) => Number(v));
  for (let i = 0; i < 3; i += 1) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function extractPurpose(lines: string[]): string | null {
  const purposeLine = lines.find((line) => /^Purpose:\s*/i.test(line.trim()));
  if (!purposeLine) return null;
  return purposeLine.replace(/^Purpose:\s*/i, "").trim() || null;
}

function extractPushDate(lines: string[]): string | null {
  const dateLine = lines.find((line) => /^Push date:\s*/i.test(line.trim()));
  if (!dateLine) return null;
  return dateLine.replace(/^Push date:\s*/i, "").trim() || null;
}

function normalizeBullet(line: string): string {
  const withoutListMarker = line.replace(/^\s*[-*]\s+/, "").trim();
  return stripMarkdownInline(withoutListMarker);
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function collectBulletCandidates(lines: string[]): { preferred: string[]; fallback: string[] } {
  const preferredHeadings = /(期待される改善|主な改善|利用者向け|メリット|できるように|使いやす|改善)/i;
  const excludedHeadings = /(追加・変更ファイル|設定|テストコード|npm scripts|実行結果|注意点|内部|実装|技術)/i;

  const preferred: string[] = [];
  const fallback: string[] = [];
  let currentHeading = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("#")) {
      currentHeading = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (!/^\s*[-*]\s+/.test(line)) continue;

    const bullet = normalizeBullet(line);
    if (!bullet || bullet.length < 8 || bullet.includes("`")) continue;
    if (TECHNICAL_TERMS_RE.test(bullet)) continue;

    if (preferredHeadings.test(currentHeading)) {
      preferred.push(bullet);
      continue;
    }
    if (!excludedHeadings.test(currentHeading)) {
      fallback.push(bullet);
    }
  }

  return { preferred, fallback };
}

function deriveBenefitsFromText(source: string): string[] {
  const messages: string[] = [];
  for (const rule of benefitRules) {
    if (rule.pattern.test(source)) {
      messages.push(rule.message);
    }
  }
  return messages;
}

function uniqueLimited(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function buildBenefits(content: string, purpose: string | null): string[] {
  const lines = content.split(/\r?\n/);
  const { preferred, fallback } = collectBulletCandidates(lines);
  const curatedBullets = uniqueLimited(preferred.length > 0 ? preferred : fallback, 3);

  const converted = curatedBullets.map((bullet) =>
    bullet.endsWith("。") ? bullet : `${bullet}。`
  );

  const derived = deriveBenefitsFromText([purpose ?? "", content].join("\n"));
  const combined = uniqueLimited([...converted, ...derived], 3);

  if (combined.length > 0) return combined;

  if (purpose) {
    return [purpose.endsWith("。") ? purpose : `${purpose}。`];
  }

  return ["日々の運用で使いやすさと安定性が上がる改善を行いました。"];
}

export async function getBetaReleaseNotes(): Promise<ReleaseNoteEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(RELEASE_NOTES_DIR);
  } catch (error) {
    console.error("Failed to read _ReleaseNotes directory", error);
    return [];
  }
  const versionFiles = names
    .map((name) => ({ name, match: name.match(VERSION_FILE_RE) }))
    .filter((entry): entry is { name: string; match: RegExpMatchArray } => Boolean(entry.match))
    .map((entry) => ({ file: entry.name, version: entry.match[1] }))
    .sort((a, b) => compareVersionsDesc(a.version, b.version));

  const entries: ReleaseNoteEntry[] = [];
  for (const item of versionFiles) {
    try {
      const fullPath = path.join(RELEASE_NOTES_DIR, item.file);
      const content = await fs.readFile(fullPath, "utf8");
      const lines = content.split(/\r?\n/);
      const purpose = extractPurpose(lines);
      entries.push({
        version: item.version,
        pushDate: extractPushDate(lines),
        purpose,
        benefits: buildBenefits(content, purpose),
      });
    } catch (error) {
      console.error(`Failed to parse release note: ${item.file}`, error);
    }
  }

  return entries;
}
