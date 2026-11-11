"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { OrderGroup } from "./types";

export type MachineDialogKind = "start" | "resume" | "addMachine";

const TEXT: Record<MachineDialogKind, { title: string; label: string; submit: string; empty: string }> = {
  start: { title: "Bắt đầu chạy", label: "Tên máy bắt đầu chạy", submit: "Bắt đầu chạy", empty: "Vui lòng nhập tên máy!" },
  resume: { title: "Chạy tiếp", label: "Tên máy tiếp tục chạy", submit: "Chạy tiếp", empty: "Vui lòng nhập tên máy!" },
  addMachine: { title: "Chạy thêm máy", label: "Tên máy mới chạy thêm", submit: "Chạy thêm máy", empty: "Vui lòng nhập tên máy mới!" },
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
  const t = TEXT[kind];
  const listId = useId();
  const formId = useId();
  const [name, setName] = useState(kind === "resume" ? group.machineName || "" : "");
  const [error, setError] = useState("");
  const running = group.machineNames.filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setError(t.empty);
    setError("");
    await onSubmit(v);
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t.title}
      description={`Đơn ${group.orderNumber}${group.packagingCode ? ` · ${group.packagingCode}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t.submit}
          </Button>
        </>
      }
    >
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
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {suggestions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-xs text-muted hover:border-brand-500 hover:text-brand-600"
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
