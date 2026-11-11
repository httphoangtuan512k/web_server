"use client";

import { ImageOff, PauseCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/card";
import type { Order } from "./types";
import { fmtTons, remainingOf, STATUS_META, statusKey, toNum } from "./utils";

/** Badge trạng thái: Chưa chạy / Đang chạy / Tạm dừng / Hoàn thành. */
export function StatusBadge({ order, className }: { order: Pick<Order, "status" | "isPaused">; className?: string }) {
  const key = statusKey(order);
  const meta = STATUS_META[key];
  return (
    <Badge tone={meta.tone} dot={key !== "paused"} className={cn(key === "running" && "[&>span:first-child]:animate-pulse", className)}>
      {key === "paused" ? <PauseCircle size={12} /> : null}
      {meta.label}
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
  const qty = toNum(order.quantity);
  const produced = toNum(order.actualProduced);
  const pct = qty > 0 ? Math.min(100, (produced / qty) * 100) : produced > 0 ? 100 : 0;
  const key = statusKey(order);
  const bar = key === "completed" || pct >= 100 ? "bg-success-600" : key === "running" || key === "paused" ? "bg-yellow-500" : "bg-subtle";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="num text-fg">
          <span className="font-semibold">{fmtTons(produced)}</span>
          <span className="text-muted"> / {fmtTons(qty)} t</span>
        </span>
        <span className="num text-muted">{Math.round(pct)}%</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
      </div>
      {showRemaining && order.status === "running" ? <p className="num mt-1 text-xs font-medium text-fg">Còn lại: {fmtTons(remainingOf(order))} tấn</p> : null}
    </div>
  );
}

/** Ảnh bao bì thu nhỏ – bấm để phóng to. */
export function OrderThumb({ src, alt, onOpen, size = "md" }: { src: string; alt: string; onOpen?: () => void; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  if (!src)
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-lg border border-dashed border-line-strong bg-surface-2 text-subtle", box)}
        title="Chưa có ảnh"
      >
        <ImageOff size={16} />
      </span>
    );
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      className={cn(
        "shrink-0 overflow-hidden rounded-lg border border-line bg-surface-3 transition hover:border-brand-500 hover:ring-2 hover:ring-brand-500/20",
        box,
      )}
      aria-label={`Xem ảnh ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </button>
  );
}
