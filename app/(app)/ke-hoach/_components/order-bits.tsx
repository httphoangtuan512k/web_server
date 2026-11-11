"use client";
/**
 * File này: các mảnh nhỏ dùng chung trang Kế hoạch – màu dòng, kiểu nút, chữ trạng thái, thanh tiến độ, ảnh thu nhỏ.
 * Dùng ở: danh sách đơn, chi tiết đơn, thanh công cụ.
 */

import { Loader2, PauseCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/card";
import type { Order } from "./types";
import { fmtTons, remainingOf, STATUS_META, statusKey, toNum, type StatusKey } from "./utils";

/* ------------------------------------------------------------------ */
/* Màu & nút theo trang cũ (kehoach.html)                              */
/* ------------------------------------------------------------------ */

/**
 * Màu dòng theo quy ước đã chốt với xưởng (đậm như trang cũ):
 *  - Trắng #fff    : chưa chạy (mới tạo)
 *  - Vàng  #ffd23f : đang chạy / tạm dừng (đơn còn dở dang)
 *  - Xanh  #70ca7a : đã chạy xong (hoàn thành)
 */
export const ROW_BG: Record<StatusKey, string> = {
  new: "bg-white",
  running: "bg-[#ffd23f]",
  paused: "bg-[#ffd23f]",
  completed: "bg-[#70ca7a]",
};

/** Ô màu nhỏ (chú thích / tab) cùng màu dòng. */
export const SWATCH: Record<StatusKey, string> = {
  new: "bg-white ring-1 ring-[#9ba8b4]",
  running: "bg-[#ffd23f] ring-1 ring-[#d9a900]",
  paused: "bg-[#ffd23f] ring-1 ring-[#d9a900]",
  completed: "bg-[#70ca7a] ring-1 ring-[#3f9a4a]",
};

/** Chữ trạng thái như trang cũ. */
export const STATUS_TEXT: Record<StatusKey, string> = {
  new: "Mới tạo",
  running: "Đang chạy",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
};

/** Nút lớn của thanh công cụ / hộp thoại (`.btn.primary` = #1759a6, `.btn.secondary` = #d5dee7). */
export const BTN_BASE =
  "inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-[13px] py-2 text-sm font-bold shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";
// Nút xanh chính và nút xám phụ.
export const BTN_PRIMARY = cn(BTN_BASE, "bg-[#1759a6] text-white");
export const BTN_SECONDARY = cn(BTN_BASE, "bg-[#d5dee7] text-[#1f2a35] shadow-none hover:brightness-95");

/** Nút thao tác nhỏ trên dòng đơn (`.small` trang cũ: chữ đậm 11px, viền #657483) – nền theo từng nút. */
export function SmallButton({
  bg,
  dark,
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { bg: string; dark?: boolean; loading?: boolean }) {
  return (
    // Nút nhỏ viền xám, nền theo `bg`, chữ trắng nếu `dark`; có vòng xoay khi loading.
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      style={{ background: bg }}
      className={cn(
        "inline-flex min-h-[30px] items-center justify-center gap-1 rounded-md border border-[#657483] px-[8px] py-[5px] text-[11px] leading-tight font-bold whitespace-nowrap shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition",
        "hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(15,23,42,0.18)] hover:brightness-110 active:translate-y-0 disabled:cursor-wait disabled:opacity-70",
        dark ? "text-white" : "text-[#202832]",
        className,
      )}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/** Ô "Trạng thái" như trang cũ: Mới tạo / Đang chạy | Tạm dừng + "Còn lại: x tấn" / Hoàn thành. */
export function StatusText({ order, className }: { order: Pick<Order, "status" | "isPaused" | "quantity" | "actualProduced">; className?: string }) {
  // Mã trạng thái hiển thị (new/running/paused/completed).
  const key = statusKey(order);
  return (
    // Dòng 1: chấm cam nhấp nháy (đang chạy) + chữ trạng thái; dòng 2: "Còn lại: x tấn" khi đang chạy.
    <div className={cn("leading-snug", className)}>
      <div className="inline-flex items-center gap-1.5">
        {key === "running" ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#b45309]" aria-hidden /> : null}
        {STATUS_TEXT[key]}
      </div>
      {order.status === "running" ? (
        <div className="num mt-1.5 font-bold whitespace-nowrap text-[#172b4d]">Còn lại: {fmtTons(remainingOf(order))} tấn</div>
      ) : null}
    </div>
  );
}

/** Badge trạng thái (dùng trong hộp thoại chi tiết / danh sách máy). */
export function StatusBadge({ order, className }: { order: Pick<Order, "status" | "isPaused">; className?: string }) {
  const key = statusKey(order);
  const meta = STATUS_META[key];
  return (
    // Nhãn tròn màu; tạm dừng thì có icon ⏸ thay cho chấm.
    <Badge tone={meta.tone} dot={key !== "paused"} className={cn(key === "running" && "[&>span:first-child]:animate-pulse", className)}>
      {key === "paused" ? <PauseCircle size={12} /> : null}
      {STATUS_TEXT[key]}
    </Badge>
  );
}

/** Thanh tiến độ sản lượng / số lượng đặt. */
export function ProductionProgress({
  order,
  showRemaining = true,
  className,
}: {
  order: Pick<Order, "status" | "isPaused" | "quantity" | "actualProduced">;
  showRemaining?: boolean;
  className?: string;
}) {
  // Tính % đã sản xuất (tối đa 100%).
  const qty = toNum(order.quantity);
  const produced = toNum(order.actualProduced);
  const pct = qty > 0 ? Math.min(100, (produced / qty) * 100) : produced > 0 ? 100 : 0;
  const key = statusKey(order);
  // Màu thanh: xanh lá = xong, vàng = đang chạy/tạm dừng, xám = chưa chạy.
  const bar = key === "completed" || pct >= 100 ? "bg-[#3f9a4a]" : key === "running" || key === "paused" ? "bg-[#e0a800]" : "bg-subtle";
  return (
    // Dòng số "đã làm / đặt t" + %, bên dưới thanh tiến độ.
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="num text-fg">
          <span className="font-semibold">{fmtTons(produced)}</span>
          <span className="text-muted"> / {fmtTons(qty)} t</span>
        </span>
        <span className="num text-muted">{Math.round(pct)}%</span>
      </div>
      {/* Thanh tiến độ: phần màu dài theo %. */}
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
      </div>
      {/* "Còn lại: x tấn" khi đang chạy. */}
      {showRemaining && order.status === "running" ? <p className="num mt-1 text-xs font-medium text-fg">Còn lại: {fmtTons(remainingOf(order))} tấn</p> : null}
    </div>
  );
}

/** Ảnh bao bì thu nhỏ như trang cũ (45×40, viền #ccc, nền trắng) – bấm để xem lớn. Không có ảnh → "-". */
export function OrderThumb({ src, alt, onOpen, className }: { src: string; alt: string; onOpen?: () => void; className?: string }) {
  // Không có ảnh → hiện dấu "-".
  if (!src) return <span className={cn("inline-block text-[#202832]", className)}>-</span>;
  return (
    // Ảnh nhỏ 45×40; bấm để xem lớn (không mở chi tiết dòng); rê chuột thì phóng nhẹ.
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      className={cn(
        "inline-grid h-10 w-[45px] shrink-0 cursor-zoom-in place-items-center overflow-hidden rounded border border-[#ccc] bg-white align-middle shadow-sm transition hover:scale-110 hover:border-[#1759a6] hover:shadow-md",
        className,
      )}
      aria-label={`Xem ảnh ${alt}`}
      title="Bấm để xem ảnh lớn"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
    </button>
  );
}
