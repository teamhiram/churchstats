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
      className={fullWidth ? "w-full" : "w-full max-w-7xl mx-auto"}
    >
      {children}
    </div>
  );
}
