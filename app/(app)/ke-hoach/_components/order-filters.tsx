"use client";

import { FilterX, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SearchInput } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import type { StatusFilter, ViewFilter } from "./types";

export interface Filters {
  packaging: string;
  orderNumber: string;
  view: ViewFilter;
  month: string;
  status: StatusFilter;
}

export const EMPTY_FILTERS: Filters = { packaging: "", orderNumber: "", view: "active", month: "all", status: "all" };

/** Thanh lọc: tab trạng thái, tìm theo mã bao bì / số đơn, đơn hoạt động / lưu trữ, tháng tạo đơn. */
export function OrderFilters({
  value,
  onChange,
  months,
  counts,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  /** 'YYYY-MM', mới nhất trước. */
  months: string[];
  counts: Record<StatusFilter, number>;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const searching = !!(value.packaging.trim() || value.orderNumber.trim());
  const dirty = searching || value.view !== "active" || value.month !== "all" || value.status !== "all";

  return (
    <div className="space-y-3 border-b border-line p-4">
      <Tabs<StatusFilter>
        value={value.status}
        onChange={(v) => set("status", v)}
        className="w-full sm:w-auto"
        items={[
          { value: "all", label: "Tất cả", count: counts.all },
          { value: "new", label: "Mới tạo", count: counts.new },
          { value: "running", label: "Đang chạy", count: counts.running },
          { value: "paused", label: "Tạm dừng", count: counts.paused },
          { value: "completed", label: "Hoàn thành", count: counts.completed },
        ]}
      />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_180px_auto]">
        <SearchInput
          value={value.packaging}
          onChange={(e) => set("packaging", e.target.value)}
          placeholder="Tìm theo mã bao bì…"
          aria-label="Tìm theo mã bao bì"
        />
        <SearchInput
          value={value.orderNumber}
          onChange={(e) => set("orderNumber", e.target.value)}
          placeholder="Tìm theo số đơn hàng…"
          aria-label="Tìm theo số đơn hàng"
        />
        <Select value={value.view} onChange={(e) => set("view", e.target.value as ViewFilter)} aria-label="Phạm vi đơn" disabled={searching}>
          <option value="active">Đơn đang hoạt động</option>
          <option value="history">Lưu trữ (hoàn thành &gt; 3 tháng)</option>
        </Select>
        <Select value={value.month} onChange={(e) => set("month", e.target.value)} aria-label="Tháng tạo đơn">
          <option value="all">Tất cả tháng/năm</option>
          {months.map((k) => (
            <option key={k} value={k}>
              Tháng {k.slice(5, 7)}/{k.slice(0, 4)}
            </option>
          ))}
        </Select>
        <Button variant="ghost" icon={FilterX} onClick={() => onChange(EMPTY_FILTERS)} disabled={!dirty} className="sm:col-span-2 xl:col-span-1">
          Xóa lọc
        </Button>
      </div>
      {searching ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Info size={13} className="text-info-600" />
          Đang tìm trên cả đơn đang hoạt động và đơn lưu trữ.
        </p>
      ) : null}
    </div>
  );
}
