"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { afterImageOf, faultImageOf, type MaintenanceInput, type MaintenanceRecord } from "./types";

/** Ghi nhận mới (record = null) hoặc Super Admin sửa bản ghi đã lưu. */
export function RecordFormModal({ record, onClose, onSaved }: { record: MaintenanceRecord | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const initial: MaintenanceInput = {
    equipment: record?.equipment || "",
    faultDescription: record?.fault_description || "",
    faultImage: record ? faultImageOf(record) : "",
    repairContent: record?.repair_content || "",
    afterStatus: record?.after_status || "",
    afterImage: record ? afterImageOf(record) : "",
  };
  const [f, setF] = useState<MaintenanceInput>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(initial) as (keyof MaintenanceInput)[]).some((k) => initial[k] !== f[k]);
  const set = <K extends keyof MaintenanceInput>(k: K, v: MaintenanceInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function requestClose() {
    if (saving) return;
    if (dirty && !(await confirm({ title: record ? "Đóng biểu mẫu chỉnh sửa?" : "Bỏ dữ liệu đang nhập?", message: "Các thay đổi chưa lưu sẽ bị mất.", confirmText: "Đóng" })))
      return;
    onClose();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: MaintenanceInput = {
      ...f,
      equipment: f.equipment.trim(),
      faultDescription: f.faultDescription.trim(),
      repairContent: f.repairContent.trim(),
      afterStatus: f.afterStatus.trim(),
    };
    if (!body.equipment || !body.faultDescription) return toast.error("Vui lòng nhập thiết bị và nội dung hư hỏng.");
    setSaving(true);
    try {
      if (record) {
        await api.patch(`/api/maintenance/${record.id}`, { ...body });
        toast.success("Đã cập nhật bản ghi bảo trì.");
      } else {
        await api.post("/api/maintenance", { ...body });
        toast.success("Đã lưu vào lịch sử bảo trì.");
      }
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={requestClose}
      size="lg"
      title={record ? `Chỉnh sửa bản ghi #${record.id}` : "Ghi nhận bảo trì / bảo dưỡng"}
      description={
        record ? "Super Admin chỉnh sửa dữ liệu đã lưu – thay đổi được ghi nhật ký." : "Sau khi lưu, chỉ Super Admin mới được sửa hoặc xóa bản ghi."
      }
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="maintenance-form" icon={Save} loading={saving}>
            {record ? "Lưu thay đổi" : "Lưu vào lịch sử"}
          </Button>
        </>
      }
    >
      <form id="maintenance-form" onSubmit={save} className="grid gap-5 md:grid-cols-2">
        <fieldset className="space-y-4 md:border-r md:border-line md:pr-5">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-danger-600 uppercase">Sự cố</legend>
          <Field label="Thiết bị" required>
            <Input value={f.equipment} maxLength={180} placeholder="VD: Máy nghiền đứng số 1" onChange={(e) => set("equipment", e.target.value)} required autoFocus />
          </Field>
          <Field label="Hư hỏng / hiện tượng" required>
            <Textarea value={f.faultDescription} placeholder="Mô tả tình trạng hư hỏng…" onChange={(e) => set("faultDescription", e.target.value)} required />
          </Field>
          <Field label="Hình ảnh hư hỏng">
            <ImageInput folder="maintenance" value={f.faultImage} onChange={(v) => set("faultImage", v)} label="Chụp / chọn ảnh" />
          </Field>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-success-700 uppercase">Sửa chữa</legend>
          <Field label="Nội dung sửa chữa">
            <Textarea value={f.repairContent} placeholder="Các công việc đã thực hiện, vật tư thay thế…" onChange={(e) => set("repairContent", e.target.value)} />
          </Field>
          <Field label="Tình trạng sau sửa chữa">
            <Textarea value={f.afterStatus} placeholder="VD: Đã hoạt động bình thường, chạy thử đạt…" onChange={(e) => set("afterStatus", e.target.value)} />
          </Field>
          <Field label="Hình ảnh sau sửa chữa">
            <ImageInput folder="maintenance" value={f.afterImage} onChange={(v) => set("afterImage", v)} label="Chụp / chọn ảnh" />
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
