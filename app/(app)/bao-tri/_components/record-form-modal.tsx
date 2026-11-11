"use client";
/**
 * File này: hộp thoại nhập / sửa bản ghi bảo trì (Sự cố + Sửa chữa, kèm ảnh).
 * Dùng ở: nút "＋ Nhập dữ liệu" và nút Sửa (Super Admin) trên trang Bảo trì.
 */

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { btn } from "./record-card";
import { afterImageOf, faultImageOf, type MaintenanceInput, type MaintenanceRecord } from "./types";

/** Ghi nhận mới (record = null) hoặc Super Admin sửa bản ghi đã lưu. */
export function RecordFormModal({ record, onClose, onSaved }: { record: MaintenanceRecord | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const toast = useToast();
  const confirm = useConfirm();
  // Giá trị ban đầu: rỗng khi tạo mới, lấy từ bản ghi khi sửa.
  const initial: MaintenanceInput = {
    equipment: record?.equipment || "",
    faultDescription: record?.fault_description || "",
    faultImage: record ? faultImageOf(record) : "",
    repairContent: record?.repair_content || "",
    afterStatus: record?.after_status || "",
    afterImage: record ? afterImageOf(record) : "",
  };
  // Dữ liệu đang nhập và trạng thái đang lưu.
  const [f, setF] = useState<MaintenanceInput>(initial);
  const [saving, setSaving] = useState(false);
  // dirty = đã sửa gì đó so với ban đầu.
  const dirty = (Object.keys(initial) as (keyof MaintenanceInput)[]).some((k) => initial[k] !== f[k]);
  // Đổi giá trị một ô.
  const set = <K extends keyof MaintenanceInput>(k: K, v: MaintenanceInput[K]) => setF((s) => ({ ...s, [k]: v }));

  // Đóng hộp: nếu đã nhập dở thì hỏi lại trước.
  async function requestClose() {
    if (saving) return;
    if (dirty && !(await confirm({ title: record ? "Đóng biểu mẫu chỉnh sửa?" : "Bỏ dữ liệu đang nhập?", message: "Các thay đổi chưa lưu sẽ bị mất.", confirmText: "Đóng" })))
      return;
    onClose();
  }

  // Lưu: bỏ khoảng trắng thừa, kiểm tra bắt buộc, gửi lên server.
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
      // Có bản ghi → sửa (PATCH); không có → tạo mới (POST).
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
      title={
        <>
          <span className="block text-[11px] font-extrabold tracking-[1.3px] text-[#0f766e]">SUPER WHITE · MAINTENANCE</span>
          <span className="mt-1 block text-lg text-[#203f8e]">{record ? `Super Admin - chỉnh sửa bản ghi #${record.id}` : "Nhập thông tin bảo trì / bảo dưỡng"}</span>
        </>
      }
      description="Sau khi lưu, bản ghi được đưa vào lịch sử. Chỉ Super Admin mới được sửa hoặc xóa dữ liệu đã lưu."
      footer={
        <>
          {/* Nút Hủy và nút Lưu (quay vòng khi đang lưu) */}
          <button type="button" className={cn(btn.base, btn.secondary)} onClick={requestClose} disabled={saving}>
            {record ? "Hủy chỉnh sửa" : "Hủy"}
          </button>
          <button type="submit" form="maintenance-form" className={cn(btn.base, btn.primary)} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {record ? "Lưu thay đổi" : "Lưu vào lịch sử"}
          </button>
        </>
      }
    >
      {/* Form 2 cột trên máy tính: Sự cố bên trái, Sửa chữa bên phải */}
      <form id="maintenance-form" onSubmit={save} className="grid gap-5 md:grid-cols-2">
        <fieldset className="space-y-4 md:border-r md:border-line md:pr-5">
          <legend className="mb-3 text-xs font-bold tracking-wide text-[#dc2626] uppercase">Sự cố</legend>
          {/* Thiết bị, mô tả hư hỏng, ảnh hư hỏng */}
          <Field label="Thiết bị" required>
            <Input value={f.equipment} maxLength={180} placeholder="Ví dụ: Máy nghiền đứng số 1" onChange={(e) => set("equipment", e.target.value)} required autoFocus />
          </Field>
          <Field label="Hư hỏng / hiện tượng" required>
            <Textarea value={f.faultDescription} placeholder="Mô tả tình trạng hư hỏng..." onChange={(e) => set("faultDescription", e.target.value)} required />
          </Field>
          <Field label="Hình ảnh hư hỏng">
            <ImageInput folder="maintenance" value={f.faultImage} onChange={(v) => set("faultImage", v)} label="Chụp / chọn ảnh" />
          </Field>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-bold tracking-wide text-[#0f766e] uppercase">Sửa chữa</legend>
          {/* Nội dung sửa chữa, trạng thái sau sửa, ảnh sau sửa */}
          <Field label="Nội dung sửa chữa">
            <Textarea value={f.repairContent} placeholder="Các công việc đã thực hiện, vật tư thay thế..." onChange={(e) => set("repairContent", e.target.value)} />
          </Field>
          <Field label="Trạng thái sau sửa chữa">
            <Textarea value={f.afterStatus} placeholder="Ví dụ: Đã hoạt động bình thường, chạy thử đạt..." onChange={(e) => set("afterStatus", e.target.value)} />
          </Field>
          <Field label="Hình ảnh sau sửa chữa">
            <ImageInput folder="maintenance" value={f.afterImage} onChange={(v) => set("afterImage", v)} label="Chụp / chọn ảnh" />
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
