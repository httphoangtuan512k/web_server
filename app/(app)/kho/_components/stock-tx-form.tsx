"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { KBtn, KField, kInput } from "./kho-ui";
import { CATEGORY_LABEL, itemOptionLabel, type ItemCategory, type StockAction, type WarehouseItem } from "./types";

const QTY: Record<ItemCategory, { label: string; step: string; min: string; note: string; item: string }> = {
  goods: { label: "Số lượng (tấn)", step: "0.01", min: "0.01", note: "Nhà cung cấp / khách hàng / nội dung...", item: "Hàng hóa" },
  packaging: { label: "Số lượng (bao)", step: "1", min: "1", note: "Số phiếu / bộ phận nhận...", item: "Loại bao bì / số lô" },
  materials: { label: "Số lượng", step: "0.01", min: "0.01", note: "Nhà cung cấp / người nhận...", item: "Vật tư / vị trí kệ" },
};

/**
 * Form ghi nhận nhập / xuất kho.
 * - `category` cố định: dùng trong tab Hàng hóa / Bao bì / Vật tư.
 * - Không truyền `category`: có ô chọn nhóm kho (tab Giao dịch).
 */
export function StockTxForm({
  category: fixedCategory,
  itemsByCategory,
  onSaved,
}: {
  category?: ItemCategory;
  itemsByCategory: Record<ItemCategory, WarehouseItem[]>;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [cat, setCat] = useState<ItemCategory>(fixedCategory || "goods");
  const category = fixedCategory || cat;
  const items = itemsByCategory[category] || [];
  const [itemId, setItemId] = useState("");
  const [action, setAction] = useState<StockAction>("in");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const cfg = QTY[category];
  const effectiveItemId = items.some((x) => String(x.id) === itemId) ? itemId : items[0] ? String(items[0].id) : "";
  const current = items.find((x) => String(x.id) === effectiveItemId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveItemId) return toast.error("Chưa có danh mục. Hãy tạo mặt hàng trước.");
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) return toast.error("Số lượng phải lớn hơn 0.");
    if (action === "out" && current && q > Number(current.quantity || 0)) return toast.error("Số lượng tồn không đủ để xuất.");
    setSaving(true);
    try {
      await api.post("/api/warehouse/transactions", { category, itemId: effectiveItemId, action, quantity, note });
      toast.success(fixedCategory ? "Đã lưu nhập / xuất kho." : "Đã lưu giao dịch kho.");
      setQuantity("");
      setNote("");
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className={cn(
        "grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 lg:flex lg:flex-wrap lg:items-end",
        fixedCategory && "rounded-[11px] border border-[#e0ebf7] bg-[#f6faff] p-3 sm:p-[15px]",
      )}
    >
      {!fixedCategory ? (
        <KField label="Nhóm kho" className="lg:min-w-[145px] lg:flex-1">
          <select
            className={kInput}
            value={cat}
            onChange={(e) => {
              setCat(e.target.value as ItemCategory);
              setItemId("");
            }}
          >
            {(Object.keys(CATEGORY_LABEL) as ItemCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </KField>
      ) : null}
      <KField label={fixedCategory ? cfg.item : "Mặt hàng"} className="min-[480px]:col-span-2 lg:min-w-[240px] lg:flex-[1.6]">
        <select className={kInput} value={effectiveItemId} onChange={(e) => setItemId(e.target.value)} disabled={!items.length}>
          {items.length ? (
            items.map((x) => (
              <option key={x.id} value={x.id}>
                {itemOptionLabel(category, x)}
              </option>
            ))
          ) : (
            <option value="">Chưa có danh mục — cần tạo mặt hàng trước</option>
          )}
        </select>
      </KField>
      <KField label="Loại giao dịch" className="lg:min-w-[145px] lg:flex-1">
        <select className={kInput} value={action} onChange={(e) => setAction(e.target.value as StockAction)}>
          <option value="in">Nhập kho</option>
          <option value="out">Xuất kho</option>
        </select>
      </KField>
      <KField label={fixedCategory ? cfg.label : `Số lượng${current?.unit ? ` (${current.unit})` : ""}`} className="lg:min-w-[145px] lg:flex-1">
        <input className={kInput} type="number" inputMode="decimal" min={cfg.min} step={cfg.step} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </KField>
      <KField label="Ghi chú" className="min-[480px]:col-span-2 lg:min-w-[200px] lg:flex-[1.6]">
        <input className={kInput} placeholder={fixedCategory ? cfg.note : "Nội dung / người nhận..."} value={note} onChange={(e) => setNote(e.target.value)} />
      </KField>
      <KBtn type="submit" variant="green" loading={saving} disabled={!items.length} className="min-[480px]:col-span-2 lg:col-span-1">
        {fixedCategory ? "Lưu nhập / xuất" : "Lưu giao dịch"}
      </KBtn>
    </form>
  );
}
