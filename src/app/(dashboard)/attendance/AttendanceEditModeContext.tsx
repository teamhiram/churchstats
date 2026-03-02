"use client";

import { createContext, useContext, useState } from "react";

type ContextValue = {
  editMode: boolean;
  setEditMode: (value: boolean) => void;
};

const AttendanceEditModeContext = createContext<ContextValue>({
  editMode: false,
  setEditMode: () => {},
});

export function AttendanceEditModeProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  return (
    <AttendanceEditModeContext.Provider value={{ editMode, setEditMode }}>
      {children}
    </AttendanceEditModeContext.Provider>
  );
}

export function useAttendanceEditMode(): ContextValue {
  return useContext(AttendanceEditModeContext);
}
