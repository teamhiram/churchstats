"use client";

import { createContext, useContext } from "react";
import type { LocalRole } from "@/types/database";

type LocalAdminContextValue = {
  localityId: string | null;
  localRole: LocalRole | null;
  isLocalAdmin: boolean;
};

const LocalAdminContext = createContext<LocalAdminContextValue | null>(null);

export function LocalAdminProvider({
  localityId,
  localRole,
  children,
}: {
  localityId: string | null;
  localRole: LocalRole | null;
  children: React.ReactNode;
}) {
  const isLocalAdmin = localRole === "local_admin";
  return (
    <LocalAdminContext.Provider value={{ localityId, localRole, isLocalAdmin }}>
      {children}
    </LocalAdminContext.Provider>
  );
}

export function useLocalAdmin(): LocalAdminContextValue {
  const ctx = useContext(LocalAdminContext);
  if (!ctx) throw new Error("useLocalAdmin must be used within LocalAdminProvider");
  return ctx;
}

