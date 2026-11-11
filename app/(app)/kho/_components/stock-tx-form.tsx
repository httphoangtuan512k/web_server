"use client";

import { ArrowDownToLine, ArrowUpFromLine, Save } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, itemOptionLabel, type ItemCategory, type StockAction, type WarehouseItem } from "./types";

const QTY: Record<ItemCategory, { label: string; step: string; min: string; note: string; item: string }> = {
  goods: { label: "Số lượng (tấn)", step: "0.01", min: "0.01", note: "Nhà cung cấp / khách hàng / nội dung…", item: "Hàng hóa" },
  packaging: { label: "Số lượng (bao)", step: "1", min: "1", note: "Số phiếu / bộ phận nhận…", item: "Loại bao bì / số lô" },
  materials: { label: "Số lượng", step: "0.01", min: "0.01", note: "Nhà cung cấp / người nhận…", item: "Vật tư / vị trí kệ" },
};

/** Ô chọn Nhập / Xuất dạng segmented. */
function ActionToggle({ value, onChange }: { value: StockAction; onChange: (v: StockAction) => void }) {
  const opt = (v: StockAction, label: string, Icon: typeof ArrowDownToLine) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={cn(
        "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
        value === v ? (v === "in" ? "bg-success-600 text-white shadow-sm" : "bg-danger-600 text-white shadow-sm") : "text-muted hover:text-fg",
      )}
    >
      <Icon size={15} /> {label}
    </button>
  );
  return (
    <div className="flex h-10 items-center gap-1 rounded-[10px] border border-line-strong bg-surface-3 p-1">
      {opt("in", "Nhập kho", ArrowDownToLine)}
      {opt("out", "Xuất kho", ArrowUpFromLine)}
    </div>
  );
}

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
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] lg:items-end">
      {!fixedCategory ? (
        <Field label="Nhóm kho">
          <Select
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
          </Select>
        </Field>
      ) : null}
      <Field label={fixedCategory ? cfg.item : "Mặt hàng"} className="lg:min-w-[240px]">
        <Select value={effectiveItemId} onChange={(e) => setItemId(e.target.value)} disabled={!items.length}>
          {items.length ? (
            items.map((x) => (
              <option key={x.id} value={x.id}>
                {itemOptionLabel(category, x)}
              </option>
            ))
          ) : (
            <option value="">Chưa có danh mục — cần tạo mặt hàng trước</option>
          )}
        </Select>
      </Field>
      <Field label="Loại giao dịch">
        <ActionToggle value={action} onChange={setAction} />
      </Field>
      <Field label={fixedCategory ? cfg.label : `Số lượng${current?.unit ? ` (${current.unit})` : ""}`}>
        <Input type="number" inputMode="decimal" min={cfg.min} step={cfg.step} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </Field>
      <Field label="Ghi chú">
        <Input placeholder={fixedCategory ? cfg.note : "Nội dung / người nhận…"} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit" variant="success" icon={Save} loading={saving} disabled={!items.length}>
        {fixedCategory ? "Lưu nhập / xuất" : "Lưu giao dịch"}
      </Button>
    </form>
  );
}
