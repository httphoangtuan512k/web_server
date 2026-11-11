// File này: ảnh đại diện tròn của tài khoản (không có ảnh thì hiện chữ cái đầu của tên).
// Dùng ở: danh sách tài khoản, phiên đăng nhập.
import { cn } from "@/lib/cn";

/** Ảnh đại diện tròn như admin.html cũ (42px); không có ảnh thì hiện chữ cái đầu trên nền #eaf1f6. */
export function UserAvatar({ src, name, size = 42, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  // Có ảnh → hiện ảnh tròn.
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} style={style} className={cn("shrink-0 rounded-full bg-[#eaf1f6] object-cover", className)} />
    );
  }
  // Không có ảnh → vòng tròn chứa chữ cái đầu (in hoa), tên trống thì "?".
  return (
    <span
      style={{ ...style, fontSize: Math.max(12, Math.round(size * 0.36)) }}
      className={cn("grid shrink-0 place-items-center rounded-full bg-[#eaf1f6] font-bold text-[#172b3a]", className)}
      aria-hidden
    >
      {(String(name || "").trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
