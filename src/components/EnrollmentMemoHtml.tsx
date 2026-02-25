import DOMPurify from "isomorphic-dompurify";

/** テキスト内のURLを <a> タグに変換する（サニタイズ前に実行） */
function linkify(text: string): string {
  const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  return text.replace(urlPattern, (url) => {
    const escaped = url.replace(/"/g, "&quot;");
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
  });
}

/** 在籍メモをHTMLとして表示。HTMLを許可しつつサニタイズし、URLはクリッカブルにする。 */
export function EnrollmentMemoHtml({ memo }: { memo: string | null }) {
  if (memo == null || memo.trim() === "") return <span className="text-slate-400">—</span>;

  const linkified = linkify(memo);
  const sanitized = DOMPurify.sanitize(linkified, {
    ALLOWED_TAGS: ["a", "br", "p", "span", "strong", "em", "b", "i", "ul", "ol", "li", "div"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ADD_ATTR: ["target", "rel"],
  });

  return (
    <span
      className="text-slate-800 break-words [&_a]:text-primary-600 [&_a]:underline [&_a]:hover:text-primary-700"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
