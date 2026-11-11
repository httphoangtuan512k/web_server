"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PLC_MACHINES } from "../_shared/plc";

export interface MachineDialogRequest {
  title: string;
  description?: React.ReactNode;
  label: string;
  confirmText: string;
  emptyError: string;
  initial?: string;
  run: (machineName: string) => Promise<void>;
}

/**
 * Hộp chọn/nhập tên máy (thay prompt() của trang cũ) – dùng cho Bắt đầu chạy, Chạy tiếp, Chạy thêm máy.
 * Có nút chọn nhanh Máy 1–4 và gợi ý các tên máy đang dùng.
 */
export function MachineDialog({ request, suggestions, onClose }: { request: MachineDialogRequest | null; suggestions: string[]; onClose: () => void }) {
  return (
    <Modal open={!!request} onClose={onClose} title={request?.title ?? ""} description={request?.description} size="sm">
      {request ? <MachineForm key={request.title + (request.initial ?? "")} request={request} suggestions={suggestions} onClose={onClose} /> : null}
    </Modal>
  );
}

function MachineForm({ request, suggestions, onClose }: { request: MachineDialogRequest; suggestions: string[]; onClose: () => void }) {
  const [value, setValue] = useState(request.initial ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const listId = useId();
  const inputId = useId();
  const quick = Array.from(new Set([...PLC_MACHINES.map((m) => m.label), ...suggestions.filter(Boolean)]));

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const name = value.trim();
    if (!name) {
      setError(request.emptyError);
      return;
    }
    setBusy(true);
    try {
      await request.run(name);
      onClose();
    } catch {
      // Lỗi đã được báo bằng toast ở nơi gọi; giữ hộp thoại để sửa.
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quick.slice(0, 8).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setValue(name);
              setError("");
            }}
            className={cn(
              "h-12 rounded-xl border text-sm font-medium transition-colors",
              value.trim() === name ? "border-brand-500 bg-brand-50 text-fg ring-1 ring-brand-500" : "border-line-strong bg-surface text-fg hover:bg-surface-3",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <Field label={request.label} htmlFor={inputId} error={error} hint="Chọn nhanh ở trên hoặc nhập tên máy khác.">
        <Input
          id={inputId}
          list={listId}
          value={value}
          autoFocus
          placeholder="Ví dụ: Máy 2"
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
        />
        <datalist id={listId}>
          {quick.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button type="submit" loading={busy}>
          {request.confirmText}
        </Button>
      </div>
    </form>
  );
}
