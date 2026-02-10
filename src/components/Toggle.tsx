"use client";

type Props = {
  checked: boolean;
  onChange: () => void;
  ariaLabel?: string;
  /** ラベル。クリックでもトグルできる */
  label?: React.ReactNode;
  disabled?: boolean;
  /** ON時の背景色クラス（例: bg-primary-600）。未指定時は primary */
  checkedClassName?: string;
};

/**
 * 汎用トグルスイッチ。サイト全体で統一デザイン（h-5 w-9）。
 * ベストプラクティスに従い、左右 2px の等しい余白を確保。
 */
export function Toggle({ checked, onChange, ariaLabel, label, disabled = false, checkedClassName }: Props) {
  const checkedBg = checkedClassName ?? "bg-primary-600";
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onChange}
      className={`relative inline-flex items-center justify-center flex-shrink-0 h-5 w-9 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 shadow-inner ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? checkedBg : "bg-slate-200"}`}
    >
      <span
        className={`pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)" }}
      />
    </button>
  );
  if (label == null) return button;
  return (
    <div className="flex items-center gap-1 min-h-5">
      {button}
      <label
        className={`flex items-center text-sm font-medium text-slate-700 touch-target select-none leading-none shrink-0 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        onClick={disabled ? undefined : onChange}
      >
        {label}
      </label>
    </div>
  );
}
