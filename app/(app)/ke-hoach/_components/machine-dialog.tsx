"use client";
/**
 * File này: hộp hỏi tên máy khi bấm "▶ Chạy", "▶ Chạy tiếp", "▶ Chạy thêm máy".
 * Dùng ở: trang Kế hoạch (thay cho hộp prompt() của trang cũ).
 */

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { BTN_BASE, BTN_SECONDARY } from "./order-bits";
import type { OrderGroup } from "./types";

// 3 kiểu hỏi tên máy: Chạy / Chạy tiếp / Chạy thêm máy.
export type MachineDialogKind = "start" | "resume" | "addMachine";

/** Chữ theo prompt() trang cũ; nút xác nhận cùng chữ & màu với nút trên dòng đơn. */
const TEXT: Record<MachineDialogKind, { title: string; label: string; submit: string; bg: string; empty: string }> = {
  start: { title: "▶ Chạy", label: "Chọn/nhập tên máy bắt đầu chạy", submit: "▶ Chạy", bg: "#2563eb", empty: "Vui lòng nhập tên máy!" },
  resume: { title: "▶ Chạy tiếp", label: "Nhập tên máy tiếp tục chạy", submit: "▶ Chạy tiếp", bg: "#10b981", empty: "Vui lòng nhập tên máy!" },
  addMachine: { title: "▶ Chạy thêm máy", label: "Nhập tên máy mới chạy thêm", submit: "▶ Chạy thêm máy", bg: "#2563eb", empty: "Vui lòng nhập tên máy mới!" },
};

/** Hỏi tên máy cho Chạy / Chạy tiếp / Chạy thêm máy (thay cho prompt() trang cũ). */
export function MachineDialog({
  kind,
  group,
  suggestions,
  busy,
  onClose,
  onSubmit,
}: {
  kind: MachineDialogKind;
  group: OrderGroup;
  suggestions: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (machineName: string) => Promise<boolean>;
}) {
  // Chữ theo kiểu; mã cho danh sách gợi ý và form.
  const t = TEXT[kind];
  const listId = useId();
  const formId = useId();
  // Tên máy đang nhập (Chạy tiếp: điền sẵn máy cũ) và lỗi.
  const [name, setName] = useState(kind === "resume" ? group.machineName || "" : "");
  const [error, setError] = useState("");
  // Các máy đang chạy đơn này.
  const running = group.machineNames.filter(Boolean);

  /** Bấm nút xác nhận: bắt buộc nhập tên máy rồi gửi đi. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setError(t.empty);
    setError("");
    await onSubmit(v);
  }

  return (
    // Hộp nhỏ: tiêu đề "▶ Chạy…", dòng phụ số đơn; chân hộp nút "Hủy" + nút xác nhận màu (xanh dương / xanh lá).
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t.title}
      description={`Đơn ${group.orderNumber}${group.packagingCode ? ` · ${group.packagingCode}` : ""}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn(BTN_SECONDARY, "flex-1 sm:flex-none")}>
            Hủy
          </button>
          <button type="submit" form={formId} disabled={busy} style={{ background: t.bg }} className={cn(BTN_BASE, "flex-1 text-white sm:flex-none")}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {t.submit}
          </button>
        </>
      }
    >
      {/* Ô nhập tên máy (gõ hoặc chọn gợi ý); dưới ô ghi các máy đang chạy. */}
      <form id={formId} onSubmit={submit} className="space-y-3">
        <Field label={t.label} required error={error} hint={running.length ? `Đang chạy trên: ${running.join(", ")}` : undefined}>
          <Input
            autoFocus
            list={listId}
            value={name}
            placeholder="VD: Máy 1"
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
          />
        </Field>
        {/* Danh sách gợi ý thả xuống của ô nhập. */}
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {/* Tối đa 8 nút tên máy gợi ý; bấm để điền nhanh. */}
        {suggestions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-xs text-muted hover:border-[#2563eb] hover:text-[#2563eb]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
