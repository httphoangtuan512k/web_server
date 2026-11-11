"use client";
/**
 * File này: hộp "Tạo đơn hàng" / "Sửa đơn hàng" với 3 nhóm ô nhập và nút Lưu.
 * Dùng ở: trang Kế hoạch (nút "+ Tạo đơn", nút "Sửa").
 */

import { ClipboardList, FlaskConical, ImageIcon, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { BTN_PRIMARY, BTN_SECONDARY } from "./order-bits";
import type { Order, OrderPayload } from "./types";

// Giá trị form (số lượng giữ dạng chữ khi đang gõ).
type FormValues = Omit<OrderPayload, "quantity"> & { quantity: string };

/** Giá trị mặc định khi tạo đơn (như trang cũ). */
const DEFAULTS: FormValues = {
  orderNumber: "",
  itemCode: "",
  packagingCode: "",
  quantity: "",
  exportDate: "",
  whiteness: "L* ≥ 98.0; y ≥ 95",
  grainSize: "D97 = 10 ± 1.0 µm",
  bagWeight: "1000",
  coatingRate: "Không tráng",
  stoneType: "100% ĐÁ B+",
  impurity: "Kiểm soát tạp chất",
  pallet: "1 bao/pallet màng co, đai 2 dây, có shipping mark",
  extraBag: "Không",
  orderCommand: "",
  imageData: "",
};

/** Gợi ý nhanh (datalist) – vẫn cho nhập tự do. */
const SUGGEST: Partial<Record<keyof FormValues, string[]>> = {
  whiteness: ["L* ≥ 98.0; y ≥ 95", "L* ≥ 98.6; Y ≥ 96", "L* ≥ 98; WI ≥ 94"],
  grainSize: ["D97 = 10 ± 1.0 µm", "10+_1", "D97 = 15 ± 1.0 µm"],
  bagWeight: ["25", "50", "1000"],
  coatingRate: ["Không tráng", "Tráng 1 mặt", "Tráng 2 mặt"],
  stoneType: ["100% ĐÁ B+", "A+", "B"],
  impurity: ["Kiểm soát tạp chất", "Không"],
  pallet: ["1 bao/pallet màng co, đai 2 dây, có shipping mark", "Không"],
};

// Đổi giá trị bất kỳ sang chữ (rỗng nếu không có).
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Lấy giá trị đơn có sẵn để điền vào form khi sửa. */
function fromOrder(o: Order): FormValues {
  return {
    orderNumber: str(o.orderNumber),
    itemCode: str(o.itemCode),
    packagingCode: str(o.packagingCode),
    quantity: str(o.quantity),
    exportDate: str(o.exportDate).slice(0, 10),
    whiteness: str(o.whiteness),
    grainSize: str(o.grainSize),
    bagWeight: str(o.bagWeight),
    coatingRate: str(o.coatingRate),
    stoneType: str(o.stoneType),
    impurity: str(o.impurity),
    pallet: str(o.pallet),
    extraBag: str(o.extraBag),
    orderCommand: str(o.orderCommand),
    imageData: str(o.imageData),
  };
}

/** Một nhóm ô trong form: tiêu đề nhỏ in hoa có icon + nội dung. */
function Section({ icon: Icon, title, children }: { icon: typeof ClipboardList; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        <Icon size={15} className="text-brand-600" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Tạo đơn (POST /api/orders) hoặc sửa đơn (PATCH /api/orders/:id).
 * Render có điều kiện (mount = mở) để state form luôn mới.
 */
export function OrderFormModal({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  // Mã cho form/gợi ý; giá trị form (sửa: điền sẵn, tạo: mặc định); đang lưu; đang sửa hay tạo.
  const toast = useToast();
  const formId = useId();
  const listPrefix = useId();
  const [v, setV] = useState<FormValues>(() => (order ? fromOrder(order) : DEFAULTS));
  const [saving, setSaving] = useState(false);
  const editing = !!order;

  // Tạo hàm cập nhật 1 ô khi người dùng gõ.
  const set =
    <K extends keyof FormValues>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((s) => ({ ...s, [k]: e.target.value }));

  // Vẽ 1 ô nhập có nhãn (kèm danh sách gợi ý nếu có).
  const text = (
    k: keyof FormValues,
    label: string,
    opts: { required?: boolean; type?: string; placeholder?: string; className?: string; step?: string; min?: string } = {},
  ) => (
    // Khung ô có nhãn.
    <Field label={label} required={opts.required} className={opts.className}>
      <Input
        value={v[k]}
        onChange={set(k)}
        required={opts.required}
        type={opts.type}
        step={opts.step}
        min={opts.min}
        placeholder={opts.placeholder}
        inputMode={opts.type === "number" ? "decimal" : undefined}
        list={SUGGEST[k] ? `${listPrefix}-${k}` : undefined}
      />
      {/* Danh sách gợi ý thả xuống. */}
      {SUGGEST[k] ? (
        <datalist id={`${listPrefix}-${k}`}>
          {SUGGEST[k]!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </Field>
  );

  /** Bấm "Lưu": kiểm tra ô bắt buộc, gửi tạo/sửa, báo kết quả rồi đóng hộp. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(v.quantity);
    if (!v.orderNumber.trim() || !v.itemCode.trim()) return toast.error("Vui lòng nhập Số đơn hàng và Mã hàng.");
    if (v.quantity.trim() === "" || !Number.isFinite(qty)) return toast.error("Số lượng (tấn) không hợp lệ.");
    const body: OrderPayload = { ...v, quantity: qty, orderCommand: v.orderCommand.trim() };
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/orders/${order.id}`, { ...body });
        toast.success("Đã cập nhật đơn hàng!");
      } else {
        await api.post("/api/orders", { ...body });
        toast.success("Tạo đơn thành công!");
      }
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    // Hộp lớn: tiêu đề "Tạo đơn hàng" / "Sửa đơn hàng: …"; chân hộp nút "Hủy" xám + "Lưu" xanh.
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? `Sửa đơn hàng: ${order.orderNumber}` : "Tạo đơn hàng"}
      description={editing ? "Cập nhật thông tin và quy cách của đơn." : "Các trường có dấu * là bắt buộc."}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn(BTN_SECONDARY, "flex-1 sm:flex-none sm:min-w-24")}>
            Hủy
          </button>
          <button type="submit" form={formId} disabled={saving} className={cn(BTN_PRIMARY, "flex-1 sm:flex-none sm:min-w-24")}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            Lưu
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-6">
        {/* Nhóm 1: thông tin đơn (số đơn, mã hàng, mã bao bì, số lượng, ngày xuất). */}
        <Section icon={ClipboardList} title="Thông tin đơn hàng">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {text("orderNumber", "Số đơn hàng", { required: true })}
            {text("itemCode", "Mã hàng", { required: true })}
            {text("packagingCode", "Mã bao bì")}
            {text("quantity", "Số lượng (tấn)", { required: true, type: "number", step: "0.001", min: "0" })}
            {text("exportDate", "Ngày xuất hàng", { type: "date" })}
          </div>
        </Section>

        {/* Nhóm 2: quy cách sản phẩm. */}
        <Section icon={FlaskConical} title="Quy cách sản phẩm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {text("whiteness", "Độ trắng sáng")}
            {text("grainSize", "Cỡ hạt")}
            {text("bagWeight", "Trọng lượng bao (kg)", { type: "number", step: "any", min: "0" })}
            {text("coatingRate", "Tỷ lệ tráng")}
            {text("stoneType", "Loại đá")}
            {text("impurity", "Tạp chất")}
            {text("pallet", "Pallet", { className: "sm:col-span-2" })}
            {text("extraBag", "Thêm bao")}
          </div>
        </Section>

        {/* Nhóm 3: lệnh chạy máy + ảnh bao bì. */}
        <Section icon={ImageIcon} title="Lệnh chạy máy & hình ảnh">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Lệnh chạy máy">
              <Textarea value={v.orderCommand} onChange={set("orderCommand")} placeholder="Nhập lệnh chạy máy..." rows={3} />
            </Field>
            <Field label="Hình ảnh bao bì">
              <ImageInput folder="orders" value={v.imageData} onChange={(url) => setV((s) => ({ ...s, imageData: url }))} />
            </Field>
          </div>
        </Section>
      </form>
    </Modal>
  );
}
