import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warning" | "danger";
const tones: Record<Tone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-info-600/25 bg-info-50", icon: "text-info-600", Icon: Info },
  warning: { box: "border-warning-600/30 bg-warning-50", icon: "text-warning-600", Icon: TriangleAlert },
  danger: { box: "border-danger-600/30 bg-danger-50", icon: "text-danger-600", Icon: CircleAlert },
};

/** Hộp thông báo/cảnh báo nổi bật trong trang. */
export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const t = tones[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div role={tone === "info" ? "note" : "alert"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed", t.box, className)}>
      <Icon size={18} className={cn("mt-0.5 shrink-0", t.icon)} />
      <div className="min-w-0 text-fg">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-muted", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
