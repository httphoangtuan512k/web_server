"use client";
/**
 * File này: kiểm tra quyền xem trang; không có quyền thì hiện "403 Forbidden" + nút "← Quay lại trang chủ".
 * Dùng ở: mọi trang chức năng bọc nội dung trong <PageGuard>.
 */

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/**
 * Bọc nội dung trang theo quyền. API vẫn kiểm tra lại, đây chỉ để hiện thông báo thân thiện (như trang 403 cũ).
 *   <PageGuard page="kho">…</PageGuard>   <PageGuard role="super">…</PageGuard>
 */
export function PageGuard({ page, role, children }: { page?: string; role?: "admin" | "super"; children: React.ReactNode }) {
  const { me, can, isAdmin } = useAuth();
  // Được xem nếu: đã đăng nhập và đúng role yêu cầu / có quyền trang / không yêu cầu gì.
  const ok = !!me && (role === "super" ? me.isSuper : role === "admin" ? isAdmin : page ? can(page) : true);
  if (ok) return <>{children}</>;
  // Không có quyền: khung báo 403 ở giữa.
  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <h1 className="text-2xl font-bold text-fg">403 Forbidden</h1>
      <p className="mt-2 text-muted">Bạn không có quyền truy cập trang này.</p>
      {/* Nút xanh đen về trang chủ. */}
      <Link href="/" className="mt-5 inline-block rounded-md bg-[#172b3a] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        ← Quay lại trang chủ
      </Link>
    </div>
  );
}
