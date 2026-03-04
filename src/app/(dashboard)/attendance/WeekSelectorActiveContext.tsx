"use client";

import { createContext, useContext, useState } from "react";

type WeekSelectorActiveContextValue = {
  weekSelectorActive: boolean;
  setWeekSelectorActive: (value: boolean) => void;
};

const WeekSelectorActiveContext = createContext<WeekSelectorActiveContextValue>({
  weekSelectorActive: false,
  setWeekSelectorActive: () => {},
});

export function WeekSelectorActiveProvider({ children }: { children: React.ReactNode }) {
  const [weekSelectorActive, setWeekSelectorActive] = useState(false);
  return (
    <WeekSelectorActiveContext.Provider value={{ weekSelectorActive, setWeekSelectorActive }}>
      {children}
    </WeekSelectorActiveContext.Provider>
  );
}

export function useWeekSelectorActive(): WeekSelectorActiveContextValue {
  return useContext(WeekSelectorActiveContext);
}
