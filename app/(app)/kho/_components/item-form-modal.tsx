"use client";
/**
 * File này: hộp thoại thêm / sửa một mặt hàng (hàng hóa, bao bì hoặc vật tư).
 * Dùng ở: nút "+ Thêm …" và "Sửa" trong tab Hàng hóa / Bao bì / Vật tư của trang /kho.
 */

import { Save } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, type ItemCategory, type WarehouseItem } from "./types";

// Đơn vị mặc định khi thêm mới.
const DEFAULT_UNIT: Record<ItemCategory, string> = { goods: "tấn", packaging: "bao", materials: "cái" };

/** Thêm / sửa một mặt hàng. `item` = null → thêm mới. */
export function ItemFormModal({
  category,
  item,
  onClose,
  onSaved,
}: {
  category: ItemCategory;
  item: WarehouseItem | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  // Giá trị các ô trong form (sửa thì điền sẵn dữ liệu cũ).
  const [f, setF] = useState({
    code: item?.code || "",
    name: item?.name || "",
    grainSize: item?.grain_size || "",
    lotNumber: item?.lot_number || "",
    shelfNumber: item?.shelf_number || "",
    unit: item?.unit || DEFAULT_UNIT[category],
    quantity: item ? String(item.quantity ?? 0) : "0",
  });
  const [saving, setSaving] = useState(false);
  // Hàm dùng chung: gõ vào ô nào thì cập nhật ô đó.
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Bấm Lưu/Thêm: kiểm tra → gửi lên máy chủ → đóng hộp thoại → tải lại.
  async function save(e: React.FormEvent) {
    e.preventDefault();
    // Bắt buộc có tên, số lượng không âm.
    if (!f.name.trim()) return toast.error("Vui lòng nhập tên.");
    const quantity = Number(f.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 0) return toast.error("Số lượng không hợp lệ.");
    const body = {
      category,
      name: f.name.trim(),
      code: f.code.trim(),
      grainSize: f.grainSize.trim(),
      lotNumber: f.lotNumber.trim(),
      shelfNumber: f.shelfNumber.trim(),
      unit: f.unit.trim() || DEFAULT_UNIT[category],
      quantity,
    };
    setSaving(true);
    try {
      // Đang sửa → PATCH; thêm mới → POST.
      if (item) await api.patch(`/api/warehouse/items/${category}/${item.id}`, body);
      else await api.post("/api/warehouse/items", body);
      toast.success(item ? "Đã cập nhật danh mục." : "Đã thêm danh mục.");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Tên loại kho viết thường, dùng cho tiêu đề "Thêm …" / "Sửa …".
  const label = CATEGORY_LABEL[category].toLowerCase();
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={item ? `Sửa ${label}` : `Thêm ${label}`}
      description={item ? item.name : undefined}
      footer={
        <>
          {/* Chân hộp thoại: nút "Hủy" và nút "Lưu thay đổi" / "Thêm". */}
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="wh-item-form" icon={Save} loading={saving}>
            {item ? "Lưu thay đổi" : "Thêm"}
          </Button>
        </>
      }
    >
      <form id="wh-item-form" onSubmit={save} className="grid grid-cols-2 gap-3">
        {/* Hàng hóa: mã hàng, cỡ hạt, tên hàng. */}
        {category === "goods" ? (
          <>
            <Field label="Mã hàng">
              <Input value={f.code} onChange={set("code")} />
            </Field>
            <Field label="Cỡ hạt">
              <Input value={f.grainSize} onChange={set("grainSize")} />
            </Field>
            <Field label="Tên hàng" required className="col-span-2">
              <Input value={f.name} onChange={set("name")} required autoFocus />
            </Field>
          </>
        ) : null}
        {/* Bao bì: tên bao bì, số lô. */}
        {category === "packaging" ? (
          <>
            <Field label="Tên bao bì" required className="col-span-2">
              <Input value={f.name} onChange={set("name")} required autoFocus />
            </Field>
            <Field label="Số lô" className="col-span-2">
              <Input value={f.lotNumber} onChange={set("lotNumber")} />
            </Field>
          </>
        ) : null}
        {/* Vật tư: số kệ, tên vật tư. */}
        {category === "materials" ? (
          <>
            <Field label="Số kệ / mã vị trí">
              <Input value={f.shelfNumber} onChange={set("shelfNumber")} placeholder="VD: K01-03" />
            </Field>
            <Field label="Tên vật tư" required>
              <Input value={f.name} onChange={set("name")} required autoFocus />
            </Field>
          </>
        ) : null}
        {/* Ô số lượng và đơn vị (mọi loại). */}
        <Field label={item ? "Tồn hiện tại" : category === "goods" ? "Tồn đầu / số lượng" : "Số lượng ban đầu"}>
          <Input type="number" inputMode="decimal" min={0} step={category === "packaging" ? "1" : "0.01"} value={f.quantity} onChange={set("quantity")} />
        </Field>
        <Field label="Đơn vị">
          <Input value={f.unit} onChange={set("unit")} />
        </Field>
      </form>
    </Modal>
  );
}
