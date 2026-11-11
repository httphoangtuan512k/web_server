"use client";

import { AuthProvider, useAuth } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/card";

/**
 * Khung ứng dụng theo giao diện cũ: KHÔNG có sidebar.
 * Mỗi trang tự vẽ thanh tiêu đề của mình bằng <PageTopbar> (tiêu đề + nút + "← Trang chủ"),
 * trang chủ dùng <HomeTopbar> (logo, người dùng, đăng xuất).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Gate>{children}</Gate>
      </ConfirmProvider>
    </AuthProvider>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Spinner className="min-h-dvh" />;
  if (!me) return <Spinner className="min-h-dvh" label="Đang chuyển tới trang đăng nhập…" />;
  return <div className="min-h-dvh w-full min-w-0">{children}</div>;
}
