"use client";

import { Loader2, type LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-600/50",
  accent: "bg-accent-600 text-white hover:bg-accent-700 shadow-sm disabled:bg-accent-600/50",
  success: "bg-success-600 text-white hover:bg-success-700 shadow-sm disabled:bg-success-600/50",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-surface-3 shadow-sm disabled:text-subtle",
  ghost: "text-muted hover:bg-surface-3 hover:text-fg disabled:text-subtle",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-sm disabled:bg-danger-600/50",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-[10px] justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon: Icon, iconRight: IconRight, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const iconSize = size === "sm" ? 15 : size === "lg" ? 19 : 17;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 select-none",
        "disabled:cursor-not-allowed active:translate-y-px",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon ? <Icon size={iconSize} strokeWidth={2} /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={iconSize} strokeWidth={2} /> : null}
    </button>
  );
});
