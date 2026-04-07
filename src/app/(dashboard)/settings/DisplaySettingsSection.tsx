"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import { Toggle } from "@/components/Toggle";

const DISPLAY_SETTING_ITEMS = [
  {
    key: "fullWidth" as const,
    ariaLabel: "全幅表示",
    label: "全幅表示",
    descriptionOn: "コンテンツが画面幅いっぱいに表示されています。",
    descriptionOff: "コンテンツに左右の余白を付け、読みやすい幅で表示しています。",
  },
  {
    key: "showLordsDayOnlineColumn" as const,
    ariaLabel: "主日集会のオンライン列表示",
    label: "主日集会のオンライン列を表示",
    descriptionOn: "主日集会の出席表で「オンライン」列を表示しています。",
    descriptionOff: "主日集会の出席表で「オンライン」列を非表示にしています。",
  },
  {
    key: "showLordsDayAwayColumn" as const,
    ariaLabel: "主日集会の他地方列表示",
    label: "主日集会の他地方列を表示",
    descriptionOn: "主日集会の出席表で「他地方」列を表示しています。",
    descriptionOff: "主日集会の出席表で「他地方」列を非表示にしています。",
  },
] as const;

export function DisplaySettingsSection() {
  const { settings, setSetting } = useDisplaySettings();

  return (
    <section>
      <h2 className="font-semibold text-slate-800 mb-4">表示設定</h2>
      <div className="space-y-3">
        {DISPLAY_SETTING_ITEMS.map((item) => (
          <Toggle
            key={item.key}
            checked={settings[item.key]}
            onChange={() => setSetting(item.key, !settings[item.key])}
            ariaLabel={item.ariaLabel}
            label={item.label}
          />
        ))}
      </div>
      {DISPLAY_SETTING_ITEMS.map((item, index) => (
        <p key={`${item.key}-description`} className={`text-slate-600 text-sm ${index === 0 ? "mt-2" : "mt-1"}`}>
          {settings[item.key] ? item.descriptionOn : item.descriptionOff}
        </p>
      ))}
    </section>
  );
}
