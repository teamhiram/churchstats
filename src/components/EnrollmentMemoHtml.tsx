"use client";

import { useEffect, useState } from "react";

/** サーバー・初回レンダー用: タグを除去してエスケープした安全なテキスト（DOMPurify を読まない） */
function getSafeFallbackText(memo: string): string {
  const stripped = memo.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** テキスト内のURLを <a> タグに変換する（サニタイズ前に実行） */
function linkify(text: string): string {
  const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  return text.replace(urlPattern, (url) => {
    const escaped = url.replace(/"/g, "&quot;");
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
  });
}

/** 在籍メモをHTMLとして表示。HTMLを許可しつつサニタイズし、URLはクリッカブルにする。
 * サーバーでは DOMPurify を読まないため、初回は安全なプレーンテキストを表示し、
 * クライアントで dompurify を動的インポートしてサニタイズ後に差し替える（本番 ESM/require 問題を回避）。 */
export function EnrollmentMemoHtml({ memo }: { memo: string | null }) {
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (memo == null || memo.trim() === "") return;
    import("dompurify").then(({ default: DOMPurify }) => {
      const linkified = linkify(memo);
      const sanitized = DOMPurify.sanitize(linkified, {
        ALLOWED_TAGS: ["a", "br", "p", "span", "strong", "em", "b", "i", "ul", "ol", "li", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
        ADD_ATTR: ["target", "rel"],
      });
      setSanitizedHtml(sanitized);
    });
  }, [memo]);

  if (memo == null || memo.trim() === "") return <span className="text-slate-400">—</span>;

  if (sanitizedHtml === null) {
    return (
      <span className="text-slate-800 break-words">
        {getSafeFallbackText(memo)}
      </span>
    );
  }

  return (
    <span
      className="text-slate-800 break-words [&_a]:text-primary-600 [&_a]:underline [&_a]:hover:text-primary-700"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
