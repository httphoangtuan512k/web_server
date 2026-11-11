"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Ô thông tin trong chi tiết đơn. Super Admin bấm bút chì để sửa trực tiếp (thay cho contenteditable cũ):
 * Enter / ✓ để lưu, Esc / ✕ để hủy.
 */
export function DetailField({
  label,
  display,
  value,
  editable,
  type = "text",
  multiline,
  className,
  onSave,
}: {
  label: string;
  /** Nội dung hiển thị (đã định dạng). */
  display: React.ReactNode;
  /** Giá trị thô đưa vào ô nhập khi sửa. */
  value?: string;
  editable?: boolean;
  type?: "text" | "number" | "date";
  multiline?: boolean;
  className?: string;
  /** Trả về true nếu lưu thành công. */
  onSave?: (next: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = draft !== null;

  async function commit() {
    if (draft === null || !onSave) return;
    if (draft.trim() === (value ?? "").trim()) return setDraft(null);
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) setDraft(null);
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Không để <dialog> bắt Esc và đóng cả modal.
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
    } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
  };

  const control =
    "w-full rounded-lg border border-brand-500 bg-surface px-2.5 py-1.5 text-sm text-fg shadow-sm focus:outline-none focus:ring-3 focus:ring-brand-500/15";

  return (
    <div className={cn("group min-w-0 rounded-xl border border-line bg-surface-2 px-3 py-2.5", editable && !editing && "hover:border-line-strong", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
        {editable && !editing ? (
          <button
            type="button"
            onClick={() => setDraft(value ?? "")}
            className="-my-1 rounded-md p-1 text-subtle opacity-70 transition hover:bg-surface-3 hover:text-brand-600 group-hover:opacity-100"
            aria-label={`Sửa ${label}`}
            title={`Sửa ${label}`}
          >
            <Pencil size={13} />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-1.5 flex items-start gap-1.5">
          {multiline ? (
            <textarea autoFocus value={draft} rows={3} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} className={control} disabled={saving} />
          ) : (
            <input
              autoFocus
              type={type}
              step={type === "number" ? "any" : undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              className={cn(control, type === "number" && "num")}
              disabled={saving}
            />
          )}
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
            aria-label="Lưu"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setDraft(null)}
            disabled={saving}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong text-muted hover:bg-surface-3"
            aria-label="Hủy"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="mt-1 text-sm break-words whitespace-pre-line text-fg">{display}</div>
      )}
    </div>
  );
}
