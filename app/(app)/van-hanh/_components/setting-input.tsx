"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Ô nhập số lưu khi rời ô / bấm Enter (giống onchange của trang cũ).
 * Khi đang gõ thì không bị dữ liệu tự làm mới ghi đè. Esc = bỏ thay đổi.
 * `onCommit` trả về Promise<boolean> (true = đã lưu). Không có khung riêng – kiểu dáng do `className` quyết định
 * (ô trên sơ đồ SCADA trong suốt, ô trong bảng có viền như bản gốc).
 */
export function DraftInput({
  value,
  format,
  onCommit,
  disabled,
  title,
  className,
  "aria-label": ariaLabel,
}: {
  value: number | null | undefined;
  format: (v: number | null | undefined) => string;
  onCommit: (raw: string) => Promise<boolean>;
  disabled?: boolean;
  title?: string;
  className?: string;
  "aria-label": string;
}) {
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
      setTimeout(() => setSaved(false), 1200);
    }
  }

  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      title={title}
      disabled={disabled || saving}
      value={draft ?? shown}
      data-saved={saved || undefined}
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
      className={cn("transition-[background-color,box-shadow] duration-300", saving && "animate-pulse", className)}
    />
  );
}
