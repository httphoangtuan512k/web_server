"use client";
/**
 * File này: hộp thoại chọn/nhập tên máy khi Bắt đầu chạy, Chạy tiếp, Chạy thêm máy.
 * Dùng ở: trang Xưởng vận hành (thay prompt() của trang cũ).
 */

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PLC_MACHINES } from "../_shared/plc";

/** Yêu cầu mở hộp: tiêu đề, nhãn ô, chữ nút xác nhận, lỗi khi bỏ trống, giá trị ban đầu, hàm chạy. */
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
      {/* key đổi theo yêu cầu → form được làm mới mỗi lần mở */}
      {request ? <MachineForm key={request.title + (request.initial ?? "")} request={request} suggestions={suggestions} onClose={onClose} /> : null}
    </Modal>
  );
}

/** Nội dung hộp: nút chọn nhanh máy, ô nhập tên máy, nút Hủy / Xác nhận. */
function MachineForm({ request, suggestions, onClose }: { request: MachineDialogRequest; suggestions: string[]; onClose: () => void }) {
  // Tên máy đang chọn, lỗi, trạng thái đang gửi.
  const [value, setValue] = useState(request.initial ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // id riêng cho ô nhập và danh sách gợi ý.
  const listId = useId();
  const inputId = useId();
  // Nút chọn nhanh: Máy 1–4 + tên máy đang dùng (không trùng).
  const quick = Array.from(new Set([...PLC_MACHINES.map((m) => m.label), ...suggestions.filter(Boolean)]));

  // Bấm xác nhận: kiểm tra rỗng, chạy yêu cầu, thành công thì đóng hộp.
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
      {/* Lưới nút chọn nhanh (2 cột trên điện thoại, 4 cột trên máy tính); nút đang chọn có viền xanh */}
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
      {/* Ô nhập tên máy, có danh sách gợi ý */}
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
      {/* Chân hộp: nút Hủy và nút xác nhận */}
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
