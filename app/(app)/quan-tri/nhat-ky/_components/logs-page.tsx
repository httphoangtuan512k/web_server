"use client";
// File này: trang Nhật ký – thẻ có 2 tab: "Nhật ký theo ngày" và "Lịch sử đơn hàng".
// Dùng ở: /quan-tri/nhat-ky, chỉ quản trị viên.

import { useState } from "react";
import { cn } from "@/lib/cn";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar, TopbarLink } from "@/components/shell/page-topbar";
import { OgCard, OgScreen, topbarStack } from "../../_shared/og-button";
import { ActivityLog } from "./activity-log";
import { OrderHistory } from "./order-history";

// Hai tab của trang.
type Tab = "activity" | "history";

/** Lịch sử hoạt động (Audit Log) – giao diện như log.html cũ; thêm tab "Lịch sử đơn hàng". */
export function LogsPage() {
  // Tab đang chọn (mặc định: nhật ký theo ngày).
  const [tab, setTab] = useState<Tab>("activity");
  return (
    // Nền trang cũ + chặn người không phải quản trị viên.
    <OgScreen>
      <PageGuard role="admin">
        {/* Thanh tiêu đề có nút về trang Admin */}
        <PageTopbar className={topbarStack} title="SUPER WHITE" actions={<TopbarLink href="/quan-tri/nguoi-dung">← Về trang Admin</TopbarLink>} />
        <PageBody className="max-w-[1200px]!">
          <OgCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:mb-5">
              {/* Tiêu đề đổi theo tab */}
              <h2 className="text-xl font-bold text-[#1e293b] sm:text-2xl">{tab === "activity" ? "Lịch sử hoạt động (Audit Log)" : "Lịch sử đơn hàng"}</h2>
              {/* Hai nút chuyển tab (tab đang chọn nền trắng chữ đậm) */}
              <div role="tablist" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-1">
                {(
                  [
                    ["activity", "Nhật ký theo ngày"],
                    ["history", "Lịch sử đơn hàng"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={tab === v}
                    onClick={() => setTab(v)}
                    className={cn(
                      "h-8 rounded-md px-3 text-[13px] whitespace-nowrap transition-colors",
                      tab === v ? "bg-white font-bold text-[#172b3a] shadow-sm ring-1 ring-[#dce3e9]" : "text-[#64748b] hover:text-[#172b3a]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Nội dung theo tab đang chọn */}
            {tab === "activity" ? <ActivityLog /> : <OrderHistory />}
          </OgCard>
        </PageBody>
      </PageGuard>
    </OgScreen>
  );
}
