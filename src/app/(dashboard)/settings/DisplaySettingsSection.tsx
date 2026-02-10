"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import { Toggle } from "@/components/Toggle";

export function DisplaySettingsSection() {
  const { fullWidth, setFullWidth } = useDisplaySettings();

  return (
    <section>
      <h2 className="font-semibold text-slate-800 mb-4">表示設定</h2>
      <div className="flex items-center gap-3">
        <Toggle
          checked={fullWidth}
          onChange={() => setFullWidth(!fullWidth)}
          ariaLabel="全幅表示"
          label="全幅表示"
        />
      </div>
      <p className="text-slate-600 text-sm mt-2">
        {fullWidth
          ? "コンテンツが画面幅いっぱいに表示されています。"
          : "コンテンツに左右の余白を付け、読みやすい幅で表示しています。"}
      </p>
    </section>
  );
}
