"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/**
 * Bọc nội dung trang theo quyền. API vẫn kiểm tra lại, đây chỉ để hiện thông báo thân thiện (như trang 403 cũ).
 *   <PageGuard page="kho">…</PageGuard>   <PageGuard role="super">…</PageGuard>
 */
export function PageGuard({ page, role, children }: { page?: string; role?: "admin" | "super"; children: React.ReactNode }) {
  const { me, can, isAdmin } = useAuth();
  const ok = !!me && (role === "super" ? me.isSuper : role === "admin" ? isAdmin : page ? can(page) : true);
  if (ok) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <h1 className="text-2xl font-bold text-fg">403 Forbidden</h1>
      <p className="mt-2 text-muted">Bạn không có quyền truy cập trang này.</p>
      <Link href="/" className="mt-5 inline-block rounded-md bg-[#172b3a] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        ← Quay lại trang chủ
      </Link>
    </div>
  );
}
