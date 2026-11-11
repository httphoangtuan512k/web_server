"use client";

import { Factory, Inbox } from "lucide-react";
import { fmtNumber } from "@/lib/format";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { StatusLight } from "../_shared/status-light";
import { OrderCard, type OrderHandlers } from "./order-card";
import { remainingOf, type OperatorPerms, type Order } from "./types";

const NO_MACHINE = "Chưa rõ máy";

/** Đơn đang chạy (status running, không tạm dừng) – nhóm theo máy. */
export function RunningBoard({ orders, perms, handlers }: { orders: Order[]; perms: OperatorPerms; handlers: OrderHandlers }) {
  if (!orders.length) {
    return (
      <Card>
        <EmptyState icon={Inbox} title="Hiện không có máy nào đang chạy." description="Đơn bắt đầu chạy hoặc chạy tiếp sẽ hiển thị tại đây, nhóm theo từng máy." />
      </Card>
    );
  }

  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.machineName?.trim() || NO_MACHINE;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const entries = [...groups.entries()].sort(([a], [b]) => (a === NO_MACHINE ? 1 : b === NO_MACHINE ? -1 : a.localeCompare(b, "vi", { numeric: true })));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {entries.map(([machine, list]) => {
        const remaining = list.reduce((s, o) => s + remainingOf(o), 0);
        return (
          <Card key={machine} className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-success-50 text-success-600">
                  <Factory size={18} />
                </span>
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-fg">
                    {machine}
                    <StatusLight tone="success" pulse size="sm" />
                  </h3>
                  <p className="num text-xs text-muted">Còn lại {fmtNumber(remaining)} tấn</p>
                </div>
              </div>
              <Badge tone="brand">{list.length} đơn</Badge>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {list.map((o) => (
                <OrderCard key={o.id} order={o} perms={perms} handlers={handlers} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
