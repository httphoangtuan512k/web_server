"use client";

import { Check, Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Ô nhập số lưu khi rời ô / bấm Enter (giống onchange của trang cũ).
 * Khi đang gõ thì không bị dữ liệu tự làm mới ghi đè. Esc = bỏ thay đổi.
 * `onCommit` trả về Promise<boolean> (true = đã lưu).
 */
export function SettingInput({
  label,
  value,
  unit,
  format,
  onCommit,
  disabled,
  disabledReason,
  size = "md",
  className,
}: {
  label: React.ReactNode;
  value: number | null | undefined;
  unit?: string;
  format: (v: number | null | undefined) => string;
  onCommit: (raw: string) => Promise<boolean>;
  disabled?: boolean;
  disabledReason?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const cancelRef = useRef(false);
  const shown = format(value);

  async function commit() {
    const raw = draft;
    setDraft(null);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    if (raw === null || raw.trim() === shown.trim()) return;
    setSaving(true);
    const ok = await onCommit(raw);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled || saving}
          title={disabled ? disabledReason : undefined}
          value={draft ?? shown}
          onFocus={(e) => {
            setDraft(shown);
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelRef.current = true;
              e.currentTarget.blur();
            }
          }}
          className={cn(
            "num w-full rounded-[10px] border border-line-strong bg-surface pr-10 pl-3 text-right font-semibold text-fg shadow-sm transition-colors",
            "hover:border-subtle focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted",
            size === "sm" ? "h-9 text-sm" : "h-11 text-base",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-success-600" /> : unit}
        </span>
      </div>
    </div>
  );
}
