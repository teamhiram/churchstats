/**
 * ひらがなをカタカナに変換する（Unicode ひらがな U+3040–U+309F → カタカナ U+30A0–U+30FF）
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3040-\u309F]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}
