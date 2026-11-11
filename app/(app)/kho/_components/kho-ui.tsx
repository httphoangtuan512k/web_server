"use client";
/**
 * File này: nút, thẻ, ô nhập, bảng… dùng chung cho trang Kho (màu giống bản cũ).
 * Dùng ở: mọi tab của trang /kho.
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Bộ khối giao diện riêng của trang Kho – giữ màu/chữ của kho.html cũ
 * (navy #12345a, xanh #2867a5, xanh lá #16845b, đỏ #c24141…) nhưng gọn và hiện đại.
 */

// Màu cho 5 kiểu nút: xanh chính, xám phụ, xanh lá, đỏ nhạt, đỏ xóa.
const BTN: Record<"primary" | "secondary" | "green" | "red" | "danger", string> = {
  primary: "border-transparent bg-[#2867a5] text-white hover:bg-[#235d96]",
  secondary: "border-[#dce5ef] bg-[#eef3f8] text-[#12345a] hover:bg-[#e3ebf4]",
  green: "border-transparent bg-[#16845b] text-white hover:bg-[#137650]",
  red: "border-[#f4d2d2] bg-[#fff0f0] text-[#c24141] hover:bg-[#ffe4e4]",
  danger: "border-[#ffc9c5] bg-[#fff1f0] text-[#c62828] hover:border-[#ef9a92] hover:bg-[#ffe2df]",
};

// Nút bấm của kho: chọn màu (variant), cỡ (size), loading = hiện vòng xoay và khóa nút.
export function KBtn({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: "md" | "sm"; loading?: boolean }) {
  // Nút bị khóa khi disabled hoặc đang loading.
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[9px] border font-bold whitespace-nowrap transition duration-150",
        "hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "min-h-10 px-[15px] py-2 text-sm" : "min-h-8 px-[11px] py-1.5 text-xs",
        BTN[variant],
        className,
      )}
      {...rest}
    >
      {/* Vòng xoay khi đang xử lý. */}
      {loading ? <Loader2 size={size === "md" ? 16 : 13} className="animate-spin" /> : null}
      {/* Chữ trên nút. */}
      {children}
    </button>
  );
}

/** Thẻ trắng bo góc (.card + .head của trang cũ). */
export function KCard({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-[14px] border border-[#e4eaf2] bg-white p-[15px] shadow-[0_8px_24px_rgba(18,52,90,0.055)] sm:px-[21px] sm:py-5", className)}>
      {/* Đầu thẻ: tiêu đề + mô tả bên trái, nút bên phải. */}
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3.5 sm:items-center">
          <div className="min-w-0">
            {title ? <h2 className="text-[17px] leading-snug font-bold text-[#12345a]">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-relaxed text-[#66758a]">{description}</p> : null}
          </div>
          {/* Cụm nút (điện thoại: xuống dòng, chiếm cả hàng). */}
          {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
        </div>
      ) : null}
      {/* Nội dung thẻ. */}
      {children}
    </section>
  );
}

/** Ô ghi chú xanh nhạt (.notice). */
// tone "success" = xanh lá (thành công), "info" = xanh dương.
export function KNotice({ tone = "info", className, children }: { tone?: "info" | "success"; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mb-3.5 rounded-[10px] border px-[15px] py-3 text-xs leading-relaxed",
        tone === "success" ? "border-[#cfe9dc] bg-[#eaf7f0] text-[#13734d]" : "border-[#d8e8f8] bg-[#f0f6fd] text-[#345b83]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Khung bảng: bo góc, cuộn ngang trong khung, header dính khi cuộn dọc. */
export function KTable({
  minWidth = 900,
  maxHeight = "70vh",
  fixed,
  className,
  children,
}: {
  minWidth?: number;
  maxHeight?: string;
  /** table-layout: fixed (dùng với <colgroup> để cột thẳng hàng như bản gốc). */
  fixed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("w-full overflow-auto overscroll-x-contain rounded-xl border border-[#dce5ef] bg-white", className)} style={{ maxHeight }}>
      {/* Bảng không hẹp hơn minWidth; màn hình nhỏ thì cuộn ngang. */}
      <table className={cn("w-full border-separate border-spacing-0 bg-white", fixed && "table-fixed")} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

// Kiểu chữ dùng chung: ô tiêu đề cột (dính trên khi cuộn), ô dữ liệu, hàng.
export const kTh =
  "sticky top-0 z-[1] border-b border-[#e3eaf2] bg-[#eef3f8] px-2.5 py-3 text-[13px] leading-tight font-bold text-[#294766] whitespace-nowrap";
export const kTd = "border-b border-[#edf1f5] px-2.5 py-3 align-middle text-[13px] text-[#1d2939] [overflow-wrap:anywhere]";
export const kTr = "transition-colors hover:bg-[#f8fbfe] [&:last-child>td]:border-b-0";

// Hàng báo "không có dữ liệu", trải ngang cả bảng.
export function KEmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-[13px] text-[#66758a]">
        {children}
      </td>
    </tr>
  );
}

/** Ô nhập / chọn theo kiểu .input cũ. */
export const kInput =
  "min-h-10 w-full min-w-0 rounded-[9px] border border-[#d5deea] bg-white px-3 py-2 text-sm text-[#1d2939] outline-none transition focus:border-[#7eadd9] focus:ring-3 focus:ring-[#d8eaff] disabled:bg-[#f4f7fb] disabled:text-[#66758a]";

// Nhãn chữ nhỏ đặt trên một ô nhập.
export function KField({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-xs font-bold text-[#53657b]">{label}</span>
      {children}
    </label>
  );
}

/** Nhãn tròn xanh lá (.pill). */
export function KPill({ tone = "green", children }: { tone?: "green" | "red" | "blue" | "amber"; children: React.ReactNode }) {
  // Chọn màu theo tone.
  const t = {
    green: "bg-[#eaf7f0] text-[#13734d]",
    red: "bg-[#fff0f0] text-[#b42323]",
    blue: "bg-[#edf4fb] text-[#173e67]",
    amber: "bg-[#fff6e8] text-[#9a5b0b]",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-[9px] py-1 text-xs font-bold whitespace-nowrap", t)}>{children}</span>;
}
