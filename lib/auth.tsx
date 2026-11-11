"use client";
/**
 * File này: lưu "ai đang đăng nhập" + hàm kiểm tra quyền, chia sẻ cho cả app qua Context (kho dữ liệu chung).
 * Dùng ở: AppShell bọc <AuthProvider>; component nào cần thì gọi useAuth().
 */

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

/** Những gì useAuth() trả về. */
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

// Kho dữ liệu chung về đăng nhập.
const AuthContext = createContext<AuthState | null>(null);

/** Tải người dùng hiện tại và cung cấp cho mọi component bên trong. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Người dùng (null = chưa đăng nhập) và cờ đang tải.
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Tải lại người dùng từ máy chủ (vd sau khi đổi ảnh đại diện).
  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/api/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Khi app mở: hỏi máy chủ ai đang đăng nhập (bỏ qua kết quả nếu đã rời trang).
  useEffect(() => {
    let alive = true;
    api
      .get<Me>("/api/me")
      .then((m) => alive && setMe(m))
      .catch(() => alive && setMe(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Đăng xuất rồi về trang /login.
  const logout = useCallback(async () => {
    await api.post("/api/logout").catch(() => undefined);
    // Tải lại toàn trang để xóa mọi state của phiên cũ.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, []);

  // Gói dữ liệu + hàm quyền (admin/super luôn có mọi quyền).
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

/** Lấy thông tin đăng nhập/quyền ở bất kỳ component nào. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return ctx;
}
