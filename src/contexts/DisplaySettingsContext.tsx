"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type DisplaySettingsState = {
  fullWidth: boolean;
  showLordsDayOnlineColumn: boolean;
  showLordsDayAwayColumn: boolean;
};

type DisplaySettingKey = keyof DisplaySettingsState;

const DISPLAY_SETTINGS_DEFINITIONS: Record<
  DisplaySettingKey,
  { storageKey: string; defaultValue: boolean }
> = {
  fullWidth: {
    storageKey: "churchstats-display-full-width",
    defaultValue: false,
  },
  showLordsDayOnlineColumn: {
    storageKey: "churchstats-display-lords-day-online-column",
    defaultValue: false,
  },
  showLordsDayAwayColumn: {
    storageKey: "churchstats-display-lords-day-away-column",
    defaultValue: false,
  },
};

const DISPLAY_SETTING_KEYS = Object.keys(DISPLAY_SETTINGS_DEFINITIONS) as DisplaySettingKey[];

const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsState = {
  fullWidth: DISPLAY_SETTINGS_DEFINITIONS.fullWidth.defaultValue,
  showLordsDayOnlineColumn: DISPLAY_SETTINGS_DEFINITIONS.showLordsDayOnlineColumn.defaultValue,
  showLordsDayAwayColumn: DISPLAY_SETTINGS_DEFINITIONS.showLordsDayAwayColumn.defaultValue,
};

type DisplaySettingsContextValue = {
  /** 全幅表示（true = 全幅、false = 余白あり）デフォルトは余白あり */
  fullWidth: boolean;
  setFullWidth: (value: boolean) => void;
  /** 主日集会のオンライン列表示（true = 表示）デフォルトは非表示 */
  showLordsDayOnlineColumn: boolean;
  setShowLordsDayOnlineColumn: (value: boolean) => void;
  /** 主日集会の他地方列表示（true = 表示）デフォルトは非表示 */
  showLordsDayAwayColumn: boolean;
  setShowLordsDayAwayColumn: (value: boolean) => void;
  /** 全表示設定の現在値 */
  settings: DisplaySettingsState;
  /** キー指定で表示設定を更新 */
  setSetting: (key: DisplaySettingKey, value: boolean) => void;
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(
  null
);

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "1" || v === "true";
  } catch {
    return fallback;
  }
}

function readStoredSettings(): DisplaySettingsState {
  const next: DisplaySettingsState = { ...DEFAULT_DISPLAY_SETTINGS };
  for (const key of DISPLAY_SETTING_KEYS) {
    const def = DISPLAY_SETTINGS_DEFINITIONS[key];
    next[key] = readStoredBoolean(def.storageKey, def.defaultValue);
  }
  return next;
}

export function DisplaySettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [storedSettings, setStoredSettings] = useState<DisplaySettingsState>(
    DEFAULT_DISPLAY_SETTINGS
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setStoredSettings(readStoredSettings());
    setMounted(true);
  }, []);

  const setSetting = useCallback((key: DisplaySettingKey, value: boolean) => {
    setStoredSettings((prev) => ({ ...prev, [key]: value }));
    try {
      localStorage.setItem(
        DISPLAY_SETTINGS_DEFINITIONS[key].storageKey,
        value ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, []);

  const setFullWidth = useCallback((value: boolean) => {
    setSetting("fullWidth", value);
  }, [setSetting]);

  const setShowLordsDayOnlineColumn = useCallback((value: boolean) => {
    setSetting("showLordsDayOnlineColumn", value);
  }, [setSetting]);

  const setShowLordsDayAwayColumn = useCallback((value: boolean) => {
    setSetting("showLordsDayAwayColumn", value);
  }, [setSetting]);

  const effectiveSettings = mounted ? storedSettings : DEFAULT_DISPLAY_SETTINGS;

  return (
    <DisplaySettingsContext.Provider
      value={{
        fullWidth: effectiveSettings.fullWidth,
        setFullWidth,
        showLordsDayOnlineColumn: effectiveSettings.showLordsDayOnlineColumn,
        setShowLordsDayOnlineColumn,
        showLordsDayAwayColumn: effectiveSettings.showLordsDayAwayColumn,
        setShowLordsDayAwayColumn,
        settings: effectiveSettings,
        setSetting,
      }}
    >
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export function useDisplaySettings(): DisplaySettingsContextValue {
  const ctx = useContext(DisplaySettingsContext);
  if (!ctx) {
    throw new Error("useDisplaySettings must be used within DisplaySettingsProvider");
  }
  return ctx;
}
