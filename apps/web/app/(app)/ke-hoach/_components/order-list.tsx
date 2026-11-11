"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { OrderActionButtons, type OrderActionKind } from "./order-actions";
import { OrderThumb, ProductionProgress, StatusBadge } from "./order-bits";
import type { OrderGroup, OrderPerms } from "./types";
import { fmtTons, statusKey } from "./utils";

interface ListProps {
  groups: OrderGroup[];
  perms: OrderPerms;
  pending: string | null;
  onOpen: (g: OrderGroup) => void;
  onAction: (kind: OrderActionKind, g: OrderGroup) => void;
  onOpenImage: (src: string, title: string) => void;
}

const rowTint = (g: OrderGroup) => {
  const k = statusKey(g);
  return k === "running" ? "bg-brand-50/50" : k === "paused" ? "bg-warning-50/60" : undefined;
};

const accent = (g: OrderGroup) => {
  const k = statusKey(g);
  return k === "running" ? "bg-brand-500" : k === "paused" ? "bg-warning-600" : k === "completed" ? "bg-success-600" : "bg-info-600";
};

/** Danh sách đơn: bảng trên desktop (≥ md), thẻ trên điện thoại. Khi in luôn dùng bảng. */
export function OrderList(props: ListProps) {
  return (
    <>
      <div className="hidden md:block print:block">
        <OrderTable {...props} />
      </div>
      <div className="md:hidden print:hidden">
        <OrderCards {...props} />
      </div>
    </>
  );
}

function OrderTable({ groups, perms, pending, onOpen, onAction, onOpenImage }: ListProps) {
  return (
    <Table className="max-h-[calc(100dvh-220px)] min-h-40 print:max-h-none print:overflow-visible">
      <THead>
        <tr>
          <Th className="w-16">Ảnh</Th>
          <Th>Mã bao bì / Đơn hàng</Th>
          <Th>Cỡ hạt</Th>
          <Th align="right">Số lượng (tấn)</Th>
          <Th className="min-w-44">Tiến độ sản lượng</Th>
          <Th>Máy · Người chạy</Th>
          <Th>Trạng thái</Th>
          <Th>Ngày hoàn thành</Th>
          <Th className="no-print">Thao tác</Th>
        </tr>
      </THead>
      <tbody>
        {groups.map((g) => (
          <Tr key={g.key} onClick={() => onOpen(g)} className={rowTint(g)}>
            <Td className="relative">
              <span className={cn("absolute inset-y-1.5 left-0 w-1 rounded-r-full", accent(g))} aria-hidden />
              <OrderThumb src={g.imageData} alt={`Đơn ${g.orderNumber}`} onOpen={() => onOpenImage(g.imageData, `Đơn ${g.orderNumber}`)} size="sm" />
            </Td>
            <Td className="max-w-64">
              <p className="truncate font-semibold text-fg">{g.packagingCode || "—"}</p>
              <p className="truncate text-xs text-muted">
                Đơn {g.orderNumber || "—"} · {g.itemCode || "—"}
              </p>
            </Td>
            <Td className="max-w-48">
              <span className="line-clamp-2 text-[13px]">{g.grainSize || "—"}</span>
            </Td>
            <Td align="right" className="font-semibold">
              {fmtTons(g.quantity)}
            </Td>
            <Td>
              <ProductionProgress order={g} />
            </Td>
            <Td className="max-w-52 text-[13px]">
              <p className="truncate text-fg">{g.machineNames.join(", ") || "—"}</p>
              <p className="truncate text-xs text-muted">{g.runnerNames.join(" + ") || "—"}</p>
            </Td>
            <Td>
              <StatusBadge order={g} />
            </Td>
            <Td className="num text-[13px] whitespace-nowrap text-muted">{fmtDate(g.completedAt)}</Td>
            <Td className="no-print">
              <OrderActionButtons group={g} perms={perms} onAction={onAction} pending={pending} compact className="flex-nowrap" />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function OrderCards({ groups, perms, pending, onOpen, onAction, onOpenImage }: ListProps) {
  return (
    <ul className="divide-y divide-line">
      {groups.map((g) => (
        <li key={g.key} className={cn("relative px-4 py-3.5", rowTint(g))}>
          <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", accent(g))} aria-hidden />
          <div className="flex items-start gap-3">
            <OrderThumb src={g.imageData} alt={`Đơn ${g.orderNumber}`} onOpen={() => onOpenImage(g.imageData, `Đơn ${g.orderNumber}`)} />
            <button
              type="button"
              onClick={() => onOpen(g)}
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
              aria-label={`Xem chi tiết đơn ${g.orderNumber}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-fg">{g.packagingCode || "—"}</p>
                  <StatusBadge order={g} />
                </div>
                <p className="truncate text-xs text-muted">
                  Đơn {g.orderNumber || "—"} · {g.itemCode || "—"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {g.grainSize || "—"} · <span className="num font-medium text-fg">{fmtTons(g.quantity)} tấn</span>
                </p>
              </div>
              <ChevronRight size={18} className="mt-1 shrink-0 text-subtle" />
            </button>
          </div>
          <ProductionProgress order={g} className="mt-3" />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
            {g.machineNames.length ? <span>Máy: {g.machineNames.join(", ")}</span> : null}
            {g.runnerNames.length ? <span>Người chạy: {g.runnerNames.join(" + ")}</span> : null}
            {g.completedAt ? <span>Hoàn thành: {fmtDate(g.completedAt)}</span> : null}
          </div>
          <OrderActionButtons group={g} perms={perms} onAction={onAction} pending={pending} compact hideEmpty className="mt-3" />
        </li>
      ))}
    </ul>
  );
}
