"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-subtle shadow-sm transition-colors " +
  "hover:border-subtle focus:border-brand-500 focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:bg-surface-3 disabled:text-muted";

/** Nhãn + control + gợi ý/lỗi. `children` là Input/Select/Textarea. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg">
          {label}
          {required ? <span className="ml-0.5 text-danger-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs text-danger-600">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-10", rest.type === "number" && "num", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-10 pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-[88px] py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Checkbox({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={rest.id || id} className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-fg select-none", className)}>
      <input id={rest.id || id} type="checkbox" className="h-4 w-4 rounded border-line-strong accent-brand-600" {...rest} />
      {label}
    </label>
  );
}

/** Ô tìm kiếm có icon. */
export function SearchInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <svg className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" className={cn(control, "h-10 pl-9")} {...rest} />
    </div>
  );
}
