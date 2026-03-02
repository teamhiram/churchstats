"use client";

import { EditPencilIcon } from "@/components/icons/EditPencilIcon";

type Props = {
  "aria-label": string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  /** "iconOnly" = 枠なし・アイコンのみ（カード1行目用） */
  variant?: "default" | "iconOnly";
};

/** 編集を開くための鉛筆ボタン。サイト共通資産。個人ページのプロフィール編集ボタンと同じ見た目。 */
export function PencilButton({
  "aria-label": ariaLabel,
  onClick,
  type = "button",
  className = "",
  variant = "default",
}: Props) {
  const isIconOnly = variant === "iconOnly";
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className={
        isIconOnly
          ? `flex items-center justify-center p-1 text-slate-500 hover:text-slate-700 touch-target shrink-0 ${className}`.trim()
          : `flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-400 touch-target shrink-0 ${className}`.trim()
      }
    >
      <EditPencilIcon className={isIconOnly ? "w-4 h-4" : "w-4 h-4"} aria-hidden />
    </button>
  );
}
