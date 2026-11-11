// File này: hộp thông báo màu (xanh = thông tin, vàng = cảnh báo, đỏ = nguy hiểm) có biểu tượng.
// Dùng ở: các trang Quản trị.
import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// 3 sắc thái hộp được phép dùng.
type Tone = "info" | "warning" | "danger";
// Bảng màu nền/viền + biểu tượng mặc định cho từng sắc thái.
const tones: Record<Tone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-info-600/25 bg-info-50", icon: "text-info-600", Icon: Info },
  warning: { box: "border-warning-600/30 bg-warning-50", icon: "text-warning-600", Icon: TriangleAlert },
  danger: { box: "border-danger-600/30 bg-danger-50", icon: "text-danger-600", Icon: CircleAlert },
};

/** Hộp thông báo/cảnh báo nổi bật: biểu tượng bên trái, tiêu đề + nội dung bên phải. */
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
  // Lấy bộ màu theo sắc thái; có icon riêng thì dùng icon đó.
  const t = tones[tone];
  const Icon = icon ?? t.Icon;
  return (
    // Khung hộp bo góc (role giúp phần mềm đọc màn hình hiểu đây là ghi chú/cảnh báo).
    <div role={tone === "info" ? "note" : "alert"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed", t.box, className)}>
      {/* Biểu tượng bên trái */}
      <Icon size={18} className={cn("mt-0.5 shrink-0", t.icon)} />
      {/* Cột chữ: tiêu đề đậm (nếu có) và nội dung xám (nếu có) */}
      <div className="min-w-0 text-fg">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-muted", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
