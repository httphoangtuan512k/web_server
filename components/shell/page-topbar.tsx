"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Thanh tiêu đề trang theo giao diện cũ: nền navy, tiêu đề trắng bên trái, nút bên phải, nút "← Trang chủ".
 * Tự xuống dòng trên màn hình hẹp (nút không bị tràn ra ngoài).
 *
 *   <PageTopbar title="Kế hoạch sản xuất" />
 *   <PageTopbar title="Xưởng Vận Hành" color="#1e3a8a" actions={<TopbarLink href="/plc">📊 Dữ liệu PLC</TopbarLink>} />
 *
 * Màu nền theo từng trang cũ: kế hoạch #173e66, vận hành / PLC #1e3a8a, kho #12345a, còn lại #172b3a.
 */
export function PageTopbar({
  title,
  subtitle,
  actions,
  color = "#172b3a",
  backHref = "/",
  backLabel = "← Trang chủ",
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  color?: string;
  backHref?: string | null;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn("no-print sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-white shadow-md sm:px-5", className)}
      style={{ background: color }}
    >
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-white/75">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
        {backHref ? <TopbarLink href={backHref}>{backLabel}</TopbarLink> : null}
      </div>
    </header>
  );
}

const topbarBtn =
  "inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/55 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white hover:text-[#172b3a] disabled:opacity-60";

/** Nút dạng link trên thanh tiêu đề (viền trắng, như nút "← Trang chủ" cũ). */
export function TopbarLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(topbarBtn, className)}>
      {children}
    </Link>
  );
}

/** Nút bấm trên thanh tiêu đề. */
export function TopbarButton({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(topbarBtn, className)} {...rest}>
      {children}
    </button>
  );
}

/** Vùng nội dung bên dưới thanh tiêu đề: rộng toàn màn hình, lề co theo kích thước màn hình. */
export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <main className={cn("mx-auto w-full max-w-[1800px] min-w-0 p-3 sm:p-4 lg:p-5", className)}>{children}</main>;
}
