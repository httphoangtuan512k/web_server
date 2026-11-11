"use client";

import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Thành phần giao diện theo đúng mã màu / kiểu nút của các trang quản trị cũ.
 *  - admin.html / log.html: primary (navy #172b3a), default (trắng viền #cbd5e1), danger (chữ đỏ #b42318, viền #efc4c0), success (chữ xanh #16794b).
 *  - superdata.html: blue (#1746a2), soft (#e9eef5 / #334155), red (#b42318).
 */
export type OgVariant = "primary" | "default" | "danger" | "success" | "blue" | "soft" | "red";

const variants: Record<OgVariant, string> = {
  primary: "border-[#172b3a] bg-[#172b3a] text-white hover:border-[#244d68] hover:bg-[#244d68]",
  default: "border-[#cbd5e1] bg-white text-[#1e293b] hover:bg-[#edf2f6]",
  danger: "border-[#efc4c0] bg-white text-[#b42318] hover:bg-[#fff0ef]",
  success: "border-[#cbd5e1] bg-white text-[#16794b] hover:bg-[#ecfdf3]",
  blue: "border-[#1746a2] bg-[#1746a2] font-bold text-white hover:border-[#12398a] hover:bg-[#12398a]",
  soft: "border-[#e9eef5] bg-[#e9eef5] font-bold text-[#334155] hover:bg-[#dde4ee]",
  red: "border-[#b42318] bg-[#b42318] font-bold text-white hover:border-[#9b1c13] hover:bg-[#9b1c13]",
};

const sizes = {
  md: "min-h-[39px] rounded-md px-[13px] py-2 text-[13px]",
  sm: "min-h-8 rounded-md px-2.5 py-1 text-xs",
} as const;

export interface OgButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: OgVariant;
  size?: keyof typeof sizes;
  loading?: boolean;
}

/** Nút theo kiểu trang cũ. */
export const OgButton = forwardRef<HTMLButtonElement, OgButtonProps>(function OgButton(
  { variant = "default", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 border whitespace-nowrap shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9bbbd2] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" /> : null}
      {children}
    </button>
  );
});

/** Nền trang (như `body { background: #f2f5f8 }` cũ). */
export function OgScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f2f5f8] text-[#1e293b]">{children}</div>;
}

/** Thẻ trắng bo góc như `.card` cũ (viền #dce3e9, bóng nhẹ). */
export const OgCard = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function OgCard({ className, children, ...rest }, ref) {
  return (
    <section
      ref={ref}
      className={cn("min-w-0 rounded-xl border border-[#dce3e9] bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.035)] sm:p-6", className)}
      {...rest}
    >
      {children}
    </section>
  );
});

/** Tiêu đề thẻ (h2 20px đậm) + dòng gợi ý + nút bên phải. */
export function OgCardTitle({ title, help, actions, className }: { title: React.ReactNode; help?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5 sm:mb-5", className)}>
      <div className="min-w-0">
        <h2 className="text-lg leading-snug font-bold text-[#1e293b] sm:text-xl">{title}</h2>
        {help ? <div className="mt-1 text-xs leading-relaxed text-[#64748b]">{help}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Nhãn tròn (`.badge` cũ): xanh nhạt/navy; `off` = hồng/đỏ. */
export function OgPill({ tone = "default", className, children }: { tone?: "default" | "off" | "ok" | "warn" | "muted"; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-[5px] text-xs leading-none whitespace-nowrap",
        tone === "default" && "bg-[#eaf1f6] text-[#172b3a]",
        tone === "off" && "bg-[#fce8e6] text-[#a12622]",
        tone === "ok" && "bg-[#ecfdf3] text-[#166534]",
        tone === "warn" && "bg-[#fff7e6] text-[#92400e]",
        tone === "muted" && "bg-[#eef2f7] text-[#475569]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Ô nhập theo giao diện cũ (cao 42px, viền #cbd5e1, focus #9bbbd2). */
export const ogInput =
  "block w-full min-h-[42px] rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] transition-shadow " +
  "focus:border-[#9bbbd2] focus:ring-3 focus:ring-[#9bbbd2]/35 focus:outline-none disabled:bg-[#f1f5f9] disabled:text-[#64748b]";

/** Khung bảng: cuộn ngang/dọc trong khung (không làm tràn trang), header dính. */
export function OgTable({ className, maxHeight, minWidth, children }: { className?: string; maxHeight?: string; minWidth?: number; children: React.ReactNode }) {
  return (
    <div className={cn("w-full min-w-0 overflow-auto rounded-lg border border-[#e2e8f0]", className)} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-sm" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function OgTh({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "sticky top-0 z-[2] border-b border-[#dce3e9] bg-[#f8fafc] px-[11px] py-3 text-left text-[13px] font-bold whitespace-nowrap text-[#172b3a] first:pl-4 last:pr-4",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function OgTd({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-[#edf0f4] px-[11px] py-3 align-middle text-[#1e293b] first:pl-4 last:pr-4", className)} {...rest}>
      {children}
    </td>
  );
}

export function OgTr({ className, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors hover:bg-[#f8fafc] [&:last-child>td]:border-b-0", className)} {...rest}>
      {children}
    </tr>
  );
}

/** Dòng trạng thái trống/đang tải/lỗi trong bảng. */
export function OgEmptyRow({ colSpan, children, tone }: { colSpan: number; children: React.ReactNode; tone?: "error" }) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("px-4 py-8 text-center text-sm text-[#64748b]", tone === "error" && "text-[#b42318]")}>
        {children}
      </td>
    </tr>
  );
}

/** Hộp trạng thái trống dùng cho danh sách dạng thẻ (điện thoại). */
export function OgEmptyBox({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <p className={cn("rounded-lg border border-dashed border-[#dce3e9] px-4 py-8 text-center text-sm text-[#64748b]", tone === "error" && "text-[#b42318]")}>
      {children}
    </p>
  );
}

/**
 * className cho <PageTopbar> trên điện thoại: tiêu đề chiếm trọn một dòng, các nút xuống dòng dưới và căn trái
 * (như header cũ), tránh tiêu đề bị cắt "SUPE…" khi nút chiếm chỗ.
 */
export const topbarStack = "max-sm:[&>div:first-child]:basis-full max-sm:[&>div:last-child]:justify-start";
