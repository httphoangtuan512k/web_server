"use client";
/**
 * File này: khung app (không sidebar) – cấp thông tin đăng nhập + hộp xác nhận, chờ đăng nhập xong mới hiện trang.
 * Dùng ở: app/(app)/layout.tsx. Mỗi trang tự vẽ thanh tiêu đề bằng <PageTopbar>.
 */

import { AuthProvider, useAuth } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/card";

/** Bọc trang trong các Provider dùng chung rồi qua cổng kiểm tra đăng nhập. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Gate>{children}</Gate>
      </ConfirmProvider>
    </AuthProvider>
  );
}

/** Cổng: đang tải hoặc chưa đăng nhập thì hiện vòng xoay, đã đăng nhập thì hiện trang. */
function Gate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Spinner className="min-h-dvh" />;
  if (!me) return <Spinner className="min-h-dvh" label="Đang chuyển tới trang đăng nhập…" />;
  return <div className="min-h-dvh w-full min-w-0">{children}</div>;
}
