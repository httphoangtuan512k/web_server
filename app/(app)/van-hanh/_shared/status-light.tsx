"use client";
/**
 * File này: đèn trạng thái tròn (StatusLight) và viên "PLC Online · 3 giây trước" (PlcConnectionPill).
 * Dùng ở: đầu trang Xưởng vận hành, thẻ máy, trang PLC.
 */

import { cn } from "@/lib/cn";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { useTick } from "./hooks";

type LightTone = "success" | "danger" | "warning" | "neutral" | "brand";

// Màu nền cho từng tông đèn.
const toneBg: Record<LightTone, string> = {
  success: "bg-success-600",
  danger: "bg-danger-600",
  warning: "bg-warning-600",
  neutral: "bg-subtle",
  brand: "bg-brand-500",
};

/** Đèn trạng thái tròn; `pulse` = nhấp nháy lan tỏa (đang hoạt động). */
export function StatusLight({ tone, pulse, size = "md", className }: { tone: LightTone; pulse?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  // Kích thước đèn theo size.
  const dim = size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return (
    <span className={cn("relative inline-flex shrink-0", dim, className)} aria-hidden>
      {/* Vòng mờ lan tỏa (chỉ khi pulse) */}
      {pulse ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", toneBg[tone])} /> : null}
      {/* Chấm tròn chính */}
      <span className={cn("relative inline-flex rounded-full", dim, toneBg[tone])} />
    </span>
  );
}

/**
 * Viên trạng thái kết nối PLC (dùng ở đầu trang Xưởng vận hành).
 * Tự vẽ lại mỗi giây để "x giây trước" luôn đúng.
 */
export function PlcConnectionPill({ connected, receivedAt, error, loaded }: { connected: boolean; receivedAt: string; error: string; loaded: boolean }) {
  useTick(1000);
  // Chưa tải → xám; lỗi → vàng; online → xanh; offline → đỏ.
  const tone: LightTone = !loaded ? "neutral" : error ? "warning" : connected ? "success" : "danger";
  const label = !loaded ? "Đang kiểm tra kết nối" : error ? "Lỗi tải dữ liệu PLC" : connected ? "PLC Online" : "PLC Offline";
  return (
    <div
      className="inline-flex h-10 items-center gap-2.5 rounded-[10px] border border-line-strong bg-surface px-3 text-sm shadow-sm"
      title={receivedAt ? `Nhận dữ liệu cuối: ${fmtDateTime(receivedAt)}` : undefined}
    >
      {/* Đèn + chữ trạng thái */}
      <StatusLight tone={tone} pulse={loaded && connected && !error} />
      <span className="font-medium text-fg">{label}</span>
      {/* "· 3 giây trước" – ẩn trên điện thoại */}
      <span className="hidden text-muted sm:inline">·</span>
      <span className="num hidden text-[13px] text-muted sm:inline">{receivedAt ? fmtRelative(receivedAt) : "chưa nhận dữ liệu"}</span>
    </div>
  );
}
