"use client";

import { Check, ClipboardList, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import type { DailySuggestion } from "./types";

const STATUS: Record<string, { label: string; tone: "success" | "brand" | "neutral" | "warning" }> = {
  running: { label: "Đang chạy", tone: "success" },
  completed: { label: "Hoàn thành", tone: "brand" },
  new: { label: "Mới", tone: "neutral" },
  paused: { label: "Tạm dừng", tone: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-subtle">—</span>;
  const s = STATUS[status];
  return <Badge tone={s?.tone || "neutral"}>{s?.label || status}</Badge>;
}

function SelectButton({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 min-w-[104px] items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : "border-line-strong bg-surface text-fg hover:bg-surface-3",
      )}
    >
      {active ? <Check size={15} /> : <Plus size={15} />}
      {active ? "Đã chọn" : "Chọn đơn"}
    </button>
  );
}

export function SuggestionList({
  suggestions,
  selected,
  onToggle,
  disabled,
}: {
  suggestions: DailySuggestion[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader
        icon={ClipboardList}
        title="Đơn hàng được gợi ý trong ngày"
        description="Tự động lấy theo sự kiện “Bắt đầu chạy”, “Chạy tiếp” hoặc “Chạy thêm máy” của từng đơn và máy."
      />
      {!suggestions.length ? (
        <EmptyState title="Ngày này không có đơn phát sinh thao tác chạy máy." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <tr>
                  <Th>Đơn hàng</Th>
                  <Th>Bao bì</Th>
                  <Th>Cỡ hạt</Th>
                  <Th align="right">Tổng đơn (tấn)</Th>
                  <Th>Máy vận hành trong ngày</Th>
                  <Th>Trạng thái</Th>
                  <Th align="right">Chọn</Th>
                </tr>
              </THead>
              <tbody>
                {suggestions.map((x) => (
                  <Tr key={x.order_key} className={cn(selected.has(x.order_key) && "bg-brand-50/40")}>
                    <Td className="font-semibold">{x.order_number}</Td>
                    <Td>{x.packaging_code || "—"}</Td>
                    <Td>{x.grain_size || "—"}</Td>
                    <Td align="right">{fmtNumber(x.order_total)}</Td>
                    <Td className="max-w-[260px] whitespace-normal">{x.machines.length ? x.machines.join(", ") : <span className="text-subtle">Chưa xác định máy</span>}</Td>
                    <Td>
                      <StatusBadge status={x.status} />
                    </Td>
                    <Td className="text-right">
                      <SelectButton active={selected.has(x.order_key)} disabled={disabled} onClick={() => onToggle(x.order_key)} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {/* Mobile */}
          <ul className="divide-y divide-line md:hidden">
            {suggestions.map((x) => (
              <li key={x.order_key} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fg">{x.order_number}</span>
                    <StatusBadge status={x.status} />
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {[x.packaging_code, x.grain_size].filter(Boolean).join(" · ") || "—"} · <span className="num">{fmtNumber(x.order_total)}</span> tấn
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">{x.machines.length ? x.machines.join(", ") : "Chưa xác định máy"}</p>
                </div>
                <SelectButton active={selected.has(x.order_key)} disabled={disabled} onClick={() => onToggle(x.order_key)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
