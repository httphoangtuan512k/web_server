"use client";

import { cn } from "@/lib/cn";

/** Thanh tab dạng segmented: <Tabs value={tab} onChange={setTab} items={[{value:'a',label:'A',count:3}]} /> */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ value: T; label: React.ReactNode; count?: number }>;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface-3 p-1", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span className={cn("num rounded-full px-1.5 text-[11px]", active ? "bg-brand-50 text-brand-700" : "bg-surface text-muted")}>{it.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
