"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "churchstats-display-full-width";

type DisplaySettingsContextValue = {
  /** 全幅表示（true = 全幅、false = 余白あり）デフォルトは余白あり */
  fullWidth: boolean;
  setFullWidth: (value: boolean) => void;
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(
  null
);

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function DisplaySettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [fullWidth, setFullWidthState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFullWidthState(readStored());
    setMounted(true);
  }, []);

  const setFullWidth = useCallback((value: boolean) => {
    setFullWidthState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  return (
    <DisplaySettingsContext.Provider
      value={{
        fullWidth: mounted ? fullWidth : false,
        setFullWidth,
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
