"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { GlobalRole, Role } from "@/types/database";

const STORAGE_KEY_GLOBAL = "churchstats-role-override-global";
const STORAGE_KEY_LOCAL = "churchstats-role-override-local";

type RoleOverrideState = {
  /** 実ユーザーのロール（DB由来。上書きしない） */
  actual: {
    role: Role;
    globalRole: GlobalRole | null;
  };
  /** 表示・機能制限のための疑似ロール（localStorageで保持） */
  override: {
    role: Role | null;
    globalRole: GlobalRole | null;
  };
  /** 実効ロール（override があればそれ、なければ actual） */
  effective: {
    role: Role;
    globalRole: GlobalRole | null;
  };
  setOverrideRole: (role: Role | null) => void;
  setOverrideGlobalRole: (role: GlobalRole | null) => void;
  clearOverrides: () => void;
  /** システム管理者（実ユーザー）か */
  isSystemAdmin: boolean;
};

const RoleOverrideContext = createContext<RoleOverrideState | null>(null);

function readStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY_LOCAL);
    if (!v) return null;
    if (v === "admin" || v === "co_admin" || v === "reporter" || v === "viewer") return v;
    return null;
  } catch {
    return null;
  }
}

function readStoredGlobalRole(): GlobalRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY_GLOBAL);
    if (!v) return null;
    if (v === "admin" || v === "national_viewer" || v === "regional_viewer") return v;
    return null;
  } catch {
    return null;
  }
}

export function RoleOverrideProvider({
  actualRole,
  actualGlobalRole,
  children,
}: {
  actualRole: Role;
  actualGlobalRole: GlobalRole | null;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [overrideRole, setOverrideRoleState] = useState<Role | null>(null);
  const [overrideGlobalRole, setOverrideGlobalRoleState] = useState<GlobalRole | null>(null);

  useEffect(() => {
    setOverrideRoleState(readStoredRole());
    setOverrideGlobalRoleState(readStoredGlobalRole());
    setMounted(true);
  }, []);

  const setOverrideRole = useCallback((role: Role | null) => {
    setOverrideRoleState(role);
    try {
      if (!role) localStorage.removeItem(STORAGE_KEY_LOCAL);
      else localStorage.setItem(STORAGE_KEY_LOCAL, role);
    } catch {
      // ignore
    }
  }, []);

  const setOverrideGlobalRole = useCallback((role: GlobalRole | null) => {
    setOverrideGlobalRoleState(role);
    try {
      if (!role) localStorage.removeItem(STORAGE_KEY_GLOBAL);
      else localStorage.setItem(STORAGE_KEY_GLOBAL, role);
    } catch {
      // ignore
    }
  }, []);

  const clearOverrides = useCallback(() => {
    setOverrideRole(null);
    setOverrideGlobalRole(null);
  }, [setOverrideRole, setOverrideGlobalRole]);

  const effectiveRole = (mounted ? overrideRole : null) ?? actualRole;
  const effectiveGlobalRole = (mounted ? overrideGlobalRole : null) ?? actualGlobalRole;

  const value = useMemo<RoleOverrideState>(
    () => ({
      actual: { role: actualRole, globalRole: actualGlobalRole },
      override: {
        role: mounted ? overrideRole : null,
        globalRole: mounted ? overrideGlobalRole : null,
      },
      effective: {
        role: effectiveRole,
        globalRole: effectiveGlobalRole,
      },
      setOverrideRole,
      setOverrideGlobalRole,
      clearOverrides,
      isSystemAdmin: actualGlobalRole === "admin",
    }),
    [
      actualRole,
      actualGlobalRole,
      mounted,
      overrideRole,
      overrideGlobalRole,
      effectiveRole,
      effectiveGlobalRole,
      setOverrideRole,
      setOverrideGlobalRole,
      clearOverrides,
    ]
  );

  return <RoleOverrideContext.Provider value={value}>{children}</RoleOverrideContext.Provider>;
}

export function useRoleOverride(): RoleOverrideState {
  const ctx = useContext(RoleOverrideContext);
  if (!ctx) {
    throw new Error("useRoleOverride must be used within RoleOverrideProvider");
  }
  return ctx;
}

