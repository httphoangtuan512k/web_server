"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";

/**
 * Bọc nội dung trang theo quyền. API vẫn kiểm tra lại, đây chỉ để hiện thông báo thân thiện.
 *   <PageGuard page="kho">…</PageGuard>   <PageGuard role="super">…</PageGuard>
 */
export function PageGuard({ page, role, children }: { page?: string; role?: "admin" | "super"; children: React.ReactNode }) {
  const { me, can, isAdmin } = useAuth();
  const ok = !!me && (role === "super" ? me.isSuper : role === "admin" ? isAdmin : page ? can(page) : true);
  if (ok) return <>{children}</>;
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={Lock}
        title="Bạn chưa được cấp quyền truy cập trang này"
        description="Liên hệ quản trị viên để được cấp quyền."
        action={
          <Link href="/">
            <Button variant="secondary">Về trang tổng quan</Button>
          </Link>
        }
      />
    </Card>
  );
}
