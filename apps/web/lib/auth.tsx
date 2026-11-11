"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

/** Người dùng hiện tại – dạng trả về của GET /api/me. */
export interface Me {
  id: number;
  username: string;
  fullName: string;
  position: string;
  avatar: string;
  role: "user" | "admin" | string;
  isSuper: boolean;
  active: boolean;
  /** kehoach | vanhanh | kcs | xuathang | kho | kho_edit | baotri */
  pagePermissions: string[];
  /** new | edit | vanhanh | xacnhan */
  orderPermissions: string[];
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  /** Có quyền trang (admin/super luôn có). */
  can: (page: string) => boolean;
  /** Có quyền thao tác đơn hàng: new | edit | vanhanh | xacnhan (admin/super luôn có). */
  canOrder: (perm: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/api/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post("/api/logout").catch(() => undefined);
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthState>(() => {
    const isAdmin = !!me && (me.isSuper || me.role === "admin");
    return {
      me,
      loading,
      refresh,
      logout,
      isAdmin,
      can: (page) => isAdmin || !!me?.pagePermissions?.includes(page),
      canOrder: (perm) => isAdmin || !!me?.orderPermissions?.includes(perm),
    };
  }, [me, loading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return ctx;
}
