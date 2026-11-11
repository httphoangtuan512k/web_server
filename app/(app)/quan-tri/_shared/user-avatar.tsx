import { cn } from "@/lib/cn";
import { initials } from "./utils";

/** Ảnh đại diện tròn; không có ảnh thì hiện chữ cái đầu. */
export function UserAvatar({ src, name, size = 36, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} style={style} className={cn("shrink-0 rounded-full border border-line bg-surface-3 object-cover", className)} />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      className={cn("grid shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset", className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
