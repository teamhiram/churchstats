"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";

export function DisplaySettingsSection() {
  const { fullWidth, setFullWidth } = useDisplaySettings();

  return (
    <section>
      <h2 className="font-semibold text-slate-800 mb-4">表示設定</h2>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={fullWidth}
          aria-label="全幅表示"
          onClick={() => setFullWidth(!fullWidth)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
            fullWidth ? "bg-primary-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              fullWidth ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
        <label className="text-sm font-medium text-slate-700 cursor-pointer select-none">
          全幅表示
        </label>
      </div>
      <p className="text-slate-600 text-sm mt-2">
        {fullWidth
          ? "コンテンツが画面幅いっぱいに表示されています。"
          : "コンテンツに左右の余白を付け、読みやすい幅で表示しています。"}
      </p>
    </section>
  );
}
