"use client";
/**
 * File này: thanh công cụ lọc đơn (+ Tạo đơn, tìm kiếm, tháng, Xóa lọc, ↓ Xuất Excel) và hàng tab trạng thái.
 * Dùng ở: phía trên danh sách đơn của trang Kế hoạch.
 */

import { Info, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { BTN_PRIMARY, BTN_SECONDARY, STATUS_TEXT, SWATCH } from "./order-bits";
import type { StatusFilter, ViewFilter } from "./types";

/** Giá trị các ô lọc: mã bao bì, số đơn, phạm vi, tháng, trạng thái. */
export interface Filters {
  packaging: string;
  orderNumber: string;
  view: ViewFilter;
  month: string;
  status: StatusFilter;
}

// Bộ lọc trống (nút "Xóa lọc" đưa về đây).
export const EMPTY_FILTERS: Filters = { packaging: "", orderNumber: "", view: "active", month: "all", status: "all" };

// Kiểu chung cho ô nhập/ô chọn: viền xám, bấm vào thì viền xanh.
const control =
  "h-[40px] min-w-0 rounded-lg border border-[#9ba8b4] bg-white px-3 text-sm text-[#202832] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition outline-none placeholder:text-[#7a8794] hover:border-[#6f8193] focus:border-[#1759a6] focus:ring-3 focus:ring-[#1759a6]/15 disabled:cursor-not-allowed disabled:bg-[#f1f4f7] disabled:text-[#7a8794]";

/**
 * Thanh công cụ một hàng như trang cũ:
 * `+ Tạo đơn` · tìm mã bao bì · tìm số đơn · phạm vi đơn · tháng/năm · `Xóa lọc` · `↓ Xuất Excel` (· nút phụ trên điện thoại).
 */
export function OrderToolbar({
  value,
  onChange,
  months,
  canCreate,
  onCreate,
  onExport,
  exporting,
  extra,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  /** 'YYYY-MM', mới nhất trước. */
  months: string[];
  canCreate: boolean;
  onCreate: () => void;
  onExport: () => void;
  exporting: boolean;
  /** Nút phụ (lịch sử, in, làm mới) – chỉ hiện trên điện thoại, cuối thanh. */
  extra?: React.ReactNode;
}) {
  // Đổi 1 ô lọc, giữ nguyên các ô khác.
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  // Đang gõ tìm kiếm → tìm cả đơn lưu trữ (khóa ô phạm vi).
  const searching = !!(value.packaging.trim() || value.orderNumber.trim());

  return (
    // Khung trắng bo góc chứa thanh công cụ; ẩn khi in.
    <section className="no-print mb-3 rounded-xl border border-[#d3dbe3] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)] sm:mb-4">
      <div className="flex flex-wrap items-center gap-[9px]">
        {/* Nút "+ Tạo đơn" xanh, chỉ hiện khi có quyền tạo. */}
        {canCreate ? (
          <button type="button" onClick={onCreate} className={BTN_PRIMARY}>
            + Tạo đơn
          </button>
        ) : null}
        {/* Ô tìm mã bao bì (icon kính lúp). */}
        <label className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#7a8794]" aria-hidden />
          <input
            type="text"
            value={value.packaging}
            onChange={(e) => set("packaging", e.target.value)}
            placeholder="Tìm theo mã bao bì..."
            aria-label="Tìm theo mã bao bì"
            className={cn(control, "w-full pl-9")}
          />
        </label>
        {/* Ô tìm số đơn hàng. */}
        <label className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#7a8794]" aria-hidden />
          <input
            type="text"
            value={value.orderNumber}
            onChange={(e) => set("orderNumber", e.target.value)}
            placeholder="Tìm theo số đơn hàng..."
            aria-label="Tìm theo số đơn hàng"
            className={cn(control, "w-full pl-9")}
          />
        </label>
        {/* Chọn phạm vi: đơn đang hoạt động / lịch sử >3 tháng. */}
        <select
          value={value.view}
          onChange={(e) => set("view", e.target.value as ViewFilter)}
          aria-label="Phạm vi đơn"
          disabled={searching}
          title={searching ? "Đang tìm trên cả đơn đang hoạt động và đơn lưu trữ" : undefined}
          className={cn(control, "w-full pr-8 sm:w-auto md:max-w-[290px]")}
        >
          <option value="active">Đơn đang hoạt động</option>
          <option value="history">Lịch sử (đã hoàn thành trên 3 tháng)</option>
        </select>
        {/* Chọn tháng/năm tạo đơn. */}
        <select
          value={value.month}
          onChange={(e) => set("month", e.target.value)}
          aria-label="Tháng tạo đơn"
          className={cn(control, "min-w-[150px] flex-1 pr-8 sm:flex-none")}
        >
          <option value="all">Tất cả tháng/năm</option>
          {months.map((k) => (
            <option key={k} value={k}>
              Tháng {k.slice(5, 7)}/{k.slice(0, 4)}
            </option>
          ))}
        </select>
        {/* Nút "Xóa lọc" xám và "↓ Xuất Excel" xanh. */}
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className={BTN_SECONDARY}>
          Xóa lọc
        </button>
        <button type="button" onClick={onExport} disabled={exporting} className={cn(BTN_PRIMARY, "max-sm:flex-1")}>
          {exporting ? "Đang xuất…" : "↓ Xuất Excel"}
        </button>
        {/* Nút phụ (chỉ điện thoại). */}
        {extra}
      </div>
      {/* Dòng nhắc khi đang tìm kiếm. */}
      {searching ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#475767]">
          <Info size={13} className="shrink-0 text-[#1759a6]" />
          Đang tìm trên cả đơn đang hoạt động và đơn lưu trữ.
        </p>
      ) : null}
    </section>
  );
}

/** Hàng tab lọc theo trạng thái – kiêm chú thích màu dòng (trắng / vàng / xanh lá). */
export function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  // Thứ tự các tab.
  const items: StatusFilter[] = ["all", "new", "running", "paused", "completed"];
  return (
    // Hàng tab cuộn ngang được; ẩn khi in.
    <div className="no-print flex items-center gap-1.5 overflow-x-auto border-b border-[#d3dbe3] bg-[#f7f9fb] px-2.5 py-2 [scrollbar-width:none]" role="tablist">
      {items.map((k) => {
        const active = value === k;
        return (
          // Tab đang chọn: nền navy chữ trắng; tab khác: nền trắng.
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition",
              active ? "border-[#173e66] bg-[#173e66] text-white shadow-sm" : "border-[#d3dbe3] bg-white text-[#334155] hover:border-[#9bb3c5] hover:bg-[#eef3f8]",
            )}
          >
            {/* Ô màu nhỏ (trắng/vàng/xanh) + tên trạng thái + số đơn. */}
            {k === "all" ? null : <span className={cn("h-3 w-3 rounded-sm", SWATCH[k])} aria-hidden />}
            {k === "all" ? "Tất cả" : STATUS_TEXT[k]}
            <span className={cn("num rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-white/20" : "bg-[#e8edf2] text-[#475767]")}>{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
