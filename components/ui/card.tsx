/**
 * File này: các khối giao diện cơ bản – thẻ (Card), nhãn màu (Badge), ô số liệu, trạng thái rỗng, vòng xoay tải.
 * Dùng ở: hầu hết các trang.
 */
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Thẻ trắng bo góc, viền mảnh, bóng nhẹ. */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

/** Đầu thẻ: icon + tiêu đề + mô tả bên trái, nút bên phải. */
export function CardHeader({
  title,
  description,
  actions,
  icon: Icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {/* Ô icon vuông nền xanh nhạt (nếu có). */}
        {Icon ? (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon size={17} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {/* Các nút bên phải (nếu có). */}
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Phần thân thẻ, có lề trong. */
export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

/** Tiêu đề trang: tiêu đề + mô tả + hành động bên phải. */
export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// Bảng màu nhãn: xám, xanh, cam, xanh lá, vàng, đỏ, xanh dương.
type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted ring-line-strong",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  accent: "bg-accent-50 text-accent-700 ring-accent-100",
  success: "bg-success-50 text-success-700 ring-success-600/20",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/25",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/20",
  info: "bg-info-50 text-info-600 ring-info-600/20",
};

/** Nhãn tròn nhỏ có màu (vd trạng thái); dot = chấm tròn phía trước. */
export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tones[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Ô số liệu: nhãn, giá trị lớn, phụ chú. */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = "brand",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "brand" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  // Màu ô icon theo tone.
  const iconTone = {
    brand: "bg-brand-50 text-brand-600",
    accent: "bg-accent-50 text-accent-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600",
  }[tone];
  return (
    // Thẻ: nhãn + icon trên, số lớn + đơn vị giữa, ghi chú dưới.
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon ? (
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", iconTone)}>
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <p className="num mt-2 text-2xl font-semibold tracking-tight text-fg">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

/** Khi không có dữ liệu: icon tròn + dòng chữ + nút hành động (nếu có). */
export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-3 text-subtle">
          <Icon size={22} />
        </span>
      ) : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Vòng xoay + chữ "Đang tải…". */
export function Spinner({ label = "Đang tải…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted", className)}>
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}

/** Khối xám nhấp nháy giữ chỗ khi đang tải. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-3", className)} />;
}
