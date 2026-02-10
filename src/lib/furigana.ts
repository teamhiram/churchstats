/**
 * ひらがなをカタカナに変換する（Unicode ひらがな U+3040–U+309F → カタカナ U+30A0–U+30FF）
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3040-\u309F]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/** 五十音の行ラベル（あ行→か行→…）の表示順 */
export const GOJUON_ROW_LABELS = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "その他"] as const;

/** ひらがな・カタカナの行ごとのコード範囲 [min, max]（清音・濁音・半濁音含む） */
const GOJUON_RANGES: { label: (typeof GOJUON_ROW_LABELS)[number]; hira: [number, number][]; kata: [number, number][] }[] = [
  { label: "あ", hira: [[0x3041, 0x304a]], kata: [[0x30a1, 0x30aa]] },
  { label: "か", hira: [[0x304b, 0x3054]], kata: [[0x30ab, 0x30b4]] },
  { label: "さ", hira: [[0x3055, 0x305e]], kata: [[0x30b5, 0x30be]] },
  { label: "た", hira: [[0x305f, 0x3069]], kata: [[0x30bf, 0x30c9]] },
  { label: "な", hira: [[0x306a, 0x306e]], kata: [[0x30ca, 0x30ce]] },
  { label: "は", hira: [[0x306f, 0x307d]], kata: [[0x30cf, 0x30dd]] },
  { label: "ま", hira: [[0x307e, 0x3082]], kata: [[0x30de, 0x30e2]] },
  { label: "や", hira: [[0x3083, 0x3088]], kata: [[0x30e3, 0x30e8]] },
  { label: "ら", hira: [[0x3089, 0x308d]], kata: [[0x30e9, 0x30ed]] },
  { label: "わ", hira: [[0x308e, 0x3093]], kata: [[0x30ee, 0x30f3]] },
];

function inRange(code: number, ranges: [number, number][]): boolean {
  return ranges.some(([lo, hi]) => code >= lo && code <= hi);
}

/** 文字列の先頭から五十音の行（あ行・か行など）を判定してラベルを返す */
export function getGojuonRowLabel(str: string): (typeof GOJUON_ROW_LABELS)[number] {
  const s = (str || "").trim();
  if (!s) return "その他";
  const code = s[0].charCodeAt(0);
  const isHira = code >= 0x3040 && code <= 0x309f;
  const isKata = code >= 0x30a0 && code <= 0x30ff;
  if (!isHira && !isKata) return "その他";
  const ranges = isHira ? GOJUON_RANGES.map((r) => r.hira) : GOJUON_RANGES.map((r) => r.kata);
  for (let i = 0; i < GOJUON_RANGES.length; i++) {
    if (inRange(code, ranges[i])) return GOJUON_RANGES[i].label;
  }
  return "その他";
}
