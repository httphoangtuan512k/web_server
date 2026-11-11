"use client";
/**
 * File này: ô nhập số tự lưu khi rời ô / Enter (DraftInput).
 * Dùng ở: ô phễu, tồn silo, hệ số trên sơ đồ SCADA và ô trong bảng vận hành.
 */

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
  // draft: chữ đang gõ (null = không gõ, hiện giá trị thật).
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // saved: vừa lưu xong → nháy nền xanh.
  const [saved, setSaved] = useState(false);
  // Đánh dấu bấm Esc để bỏ lưu.
  const cancelRef = useRef(false);
  const shown = format(value);

  // Lưu giá trị vừa gõ (nếu có thay đổi).
  async function commit() {
    const raw = draft;
    setDraft(null);
    // Bấm Esc → bỏ qua.
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    // Không đổi gì → không lưu.
    if (raw === null || raw.trim() === shown.trim()) return;
    // Gọi lưu, chờ kết quả.
    setSaving(true);
    const ok = await onCommit(raw);
    setSaving(false);
    // Lưu được → nền xanh 1,2 giây.
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
