/**
 * 氏名・フリガナの表示用ヘルパー。
 * リスト表示は "last_name + 半角スペース + first_name" に統一する。
 */

/** 姓と名の間の区切り（半角スペース） */
export const NAME_SEP = " ";

export type MemberNameLike = {
  last_name?: string | null;
  first_name?: string | null;
};

export type MemberFuriganaLike = {
  last_furigana?: string | null;
  first_furigana?: string | null;
};

/**
 * 表示用の氏名を組み立てる。"last_name + 半角スペース + first_name"。
 * どちらかが空の場合は片方のみ返す。
 */
export function formatMemberName(m: MemberNameLike): string {
  const last = (m.last_name ?? "").trim();
  const first = (m.first_name ?? "").trim();
  if (!last && !first) return "";
  if (!last) return first;
  if (!first) return last;
  return `${last}${NAME_SEP}${first}`;
}

/**
 * 表示用のフリガナを組み立てる。"last_furigana + 半角スペース + first_furigana"。
 * どちらかが空の場合は片方のみ返す。
 */
export function formatMemberFurigana(m: MemberFuriganaLike): string {
  const last = (m.last_furigana ?? "").trim();
  const first = (m.first_furigana ?? "").trim();
  if (!last && !first) return "";
  if (!last) return first;
  if (!first) return last;
  return `${last}${NAME_SEP}${first}`;
}
