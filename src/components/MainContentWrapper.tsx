"use client";

import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";

export function MainContentWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { fullWidth } = useDisplaySettings();

  return (
    <div
      className={`flex flex-col min-h-0 ${fullWidth ? "w-full" : "w-full max-w-7xl mx-auto"} flex-1 overflow-y-hidden overflow-x-visible`}
    >
      {children}
    </div>
  );
}
