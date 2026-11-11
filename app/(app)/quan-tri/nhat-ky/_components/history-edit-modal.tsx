"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fromVnInputValue, toVnInputValue } from "../../_shared/utils";
import type { HistoryPatch, HistoryRow } from "./types";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** Ô số: rỗng → null, số hợp lệ → number, còn lại giữ chuỗi để server báo lỗi. */
const numOrRaw = (v: string): number | string | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : t;
};

/** Sửa bản ghi lịch sử đơn hàng – PATCH /api/history/:id (chỉ Super Admin). */
export function HistoryEditModal({ row, onClose, onSaved }: { row: HistoryRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(() => ({
    order_number: str(row.order_number),
    machine_name: str(row.machine_name),
    user_name: str(row.user_name),
    action: str(row.action),
    old_value: str(row.old_value),
    new_value: str(row.new_value),
    created_at: toVnInputValue(row.created_at),
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const createdAt = fromVnInputValue(f.created_at);
    if (!f.order_number.trim() || !f.user_name.trim() || !f.action.trim() || !createdAt) {
      return setError("Số đơn, người thao tác, hành động và thời gian không được để trống.");
    }
    setError("");
    const body: HistoryPatch = {
      order_number: f.order_number.trim(),
      machine_name: f.machine_name.trim(),
      user_name: f.user_name.trim(),
      action: f.action.trim(),
      old_value: numOrRaw(f.old_value),
      new_value: numOrRaw(f.new_value),
      created_at: createdAt,
    };
    setSaving(true);
    try {
      await api.patch(`/api/history/${row.id}`, { ...body });
      toast.success("Đã cập nhật bản ghi lịch sử.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Sửa lịch sử #${row.id}`}
      description="Thay đổi được ghi vào nhật ký quản trị (EDIT_HISTORY)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="history-edit-form" icon={Save} loading={saving}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <form id="history-edit-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Số đơn hàng" required>
          <Input value={f.order_number} onChange={set("order_number")} autoFocus />
        </Field>
        <Field label="Máy">
          <Input value={f.machine_name} onChange={set("machine_name")} />
        </Field>
        <Field label="Người thao tác" required>
          <Input value={f.user_name} onChange={set("user_name")} />
        </Field>
        <Field label="Hành động" required>
          <Input value={f.action} onChange={set("action")} />
        </Field>
        <Field label="Giá trị cũ">
          <Input inputMode="decimal" className="num" value={f.old_value} onChange={set("old_value")} />
        </Field>
        <Field label="Giá trị mới">
          <Input inputMode="decimal" className="num" value={f.new_value} onChange={set("new_value")} />
        </Field>
        <Field label="Thời gian (giờ Việt Nam)" required className="sm:col-span-2" error={error}>
          <Input type="datetime-local" step={1} value={f.created_at} onChange={set("created_at")} />
        </Field>
      </form>
    </Modal>
  );
}
