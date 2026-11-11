"use client";
/**
 * File này: hộp thoại Super Admin sửa toàn bộ dữ liệu một đơn hàng.
 * Dùng ở: nút "✎ Sửa toàn bộ" trên trang Xưởng vận hành (chỉ tài khoản super).
 */

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { todayKey } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Order } from "./types";

// Loại ô nhập: chữ, số, ngày, trạng thái, tick, ảnh.
type FieldKind = "text" | "number" | "date" | "status" | "bool" | "image";

/** Danh sách trường y hệt editFields của trang cũ (thứ tự + nhãn). */
const FIELDS: ReadonlyArray<{ key: keyof Order; label: string; kind: FieldKind }> = [
  { key: "orderNumber", label: "Số đơn", kind: "text" },
  { key: "itemCode", label: "Mã hàng", kind: "text" },
  { key: "packagingCode", label: "Mã bao bì", kind: "text" },
  { key: "quantity", label: "Số lượng kế hoạch (tấn)", kind: "number" },
  { key: "whiteness", label: "Độ trắng", kind: "text" },
  { key: "grainSize", label: "Cỡ hạt", kind: "text" },
  { key: "stoneType", label: "Loại đá", kind: "text" },
  { key: "bagWeight", label: "Trọng lượng bao (kg)", kind: "number" },
  { key: "coatingRate", label: "Tỷ lệ tráng", kind: "text" },
  { key: "impurity", label: "Tạp chất", kind: "text" },
  { key: "pallet", label: "Pallet", kind: "text" },
  { key: "extraBag", label: "Thêm bao", kind: "text" },
  { key: "runOnMachine", label: "Số lượng chạy máy", kind: "number" },
  { key: "actualProduced", label: "Sản lượng thực tế", kind: "number" },
  { key: "khoBu", label: "Tồn kho bù", kind: "number" },
  { key: "machineName", label: "Tên máy", kind: "text" },
  { key: "status", label: "Trạng thái", kind: "status" },
  { key: "isPaused", label: "Tạm dừng", kind: "bool" },
  { key: "createdAt", label: "Ngày tạo", kind: "date" },
  { key: "exportDate", label: "Ngày xuất", kind: "date" },
  { key: "creatorName", label: "Người tạo", kind: "text" },
  { key: "runnerName", label: "Người chạy", kind: "text" },
  { key: "confirmerName", label: "Người xác nhận", kind: "text" },
  { key: "imageData", label: "Hình ảnh đơn", kind: "image" },
];

// Bản nháp: giá trị các ô đang sửa (chữ hoặc đúng/sai).
type Draft = Record<string, string | boolean>;

/** Đổi đơn hàng thành bản nháp để điền sẵn vào form. */
function toDraft(o: Order): Draft {
  const d: Draft = {};
  for (const f of FIELDS) {
    const v = o[f.key];
    // Tick → đúng/sai; ngày → "YYYY-MM-DD"; còn lại → chữ.
    if (f.kind === "bool") d[f.key] = Boolean(v);
    else if (f.kind === "date") d[f.key] = v ? todayKey(new Date(String(v))) : "";
    else d[f.key] = v === null || v === undefined ? "" : String(v);
  }
  return d;
}

/** Super Admin – chỉnh sửa toàn bộ dữ liệu đơn: PATCH /api/orders/:id với đủ các trường (như trang cũ). */
export function EditOrderModal({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal open={!!order} onClose={onClose} size="lg" title="Super Admin – chỉnh sửa toàn bộ dữ liệu đơn" description={order ? `Đơn ${order.orderNumber} · ${order.machineName || "chưa rõ máy"}` : undefined}>
      {order ? <EditForm key={order.id} order={order} onClose={onClose} onSaved={onSaved} /> : null}
    </Modal>
  );
}

/** Form sửa: mỗi trường một ô, nút Hủy / Lưu thay đổi. */
function EditForm({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  // Bản nháp (điền sẵn từ đơn) và trạng thái đang lưu.
  const [draft, setDraft] = useState<Draft>(() => toDraft(order));
  const [busy, setBusy] = useState(false);
  // Đổi giá trị một ô.
  const set = (k: string, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  // Lưu: đổi bản nháp về đúng kiểu rồi gửi PATCH lên server.
  async function save() {
    const body: Record<string, string | number | boolean> = {};
    for (const f of FIELDS) {
      const v = draft[f.key];
      if (f.kind === "number") body[f.key] = v === "" ? 0 : Number(v);
      else if (f.kind === "bool") body[f.key] = Boolean(v);
      else body[f.key] = String(v ?? "");
    }
    // Gửi; thành công → báo, tải lại, đóng hộp.
    setBusy(true);
    try {
      await api.patch(`/api/orders/${order.id}`, body);
      toast.success("Đã lưu dữ liệu đơn hàng.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Không thể lưu: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lưới ô nhập: 1 cột trên điện thoại, 2 cột trên máy tính */}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const id = `edit-${f.key}`;
          const v = draft[f.key];
          // Ô ảnh (chiếm cả hàng).
          if (f.kind === "image")
            return (
              <Field key={f.key} label={f.label} className="sm:col-span-2">
                <ImageInput value={String(v ?? "")} onChange={(url) => set(f.key, url)} folder="orders" />
              </Field>
            );
          // Ô tick "Đơn đang tạm dừng".
          if (f.kind === "bool")
            return (
              <Field key={f.key} label={f.label}>
                <div className="flex h-10 items-center">
                  <Checkbox label="Đơn đang tạm dừng" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} />
                </div>
              </Field>
            );
          // Ô chọn trạng thái (giữ cả giá trị lạ nếu có).
          if (f.kind === "status")
            return (
              <Field key={f.key} label={f.label} htmlFor={id}>
                <Select id={id} value={String(v)} onChange={(e) => set(f.key, e.target.value)}>
                  {!["new", "running", "completed"].includes(String(v)) ? <option value={String(v)}>{String(v) || "(trống)"}</option> : null}
                  <option value="new">Mới tạo (new)</option>
                  <option value="running">Đang chạy (running)</option>
                  <option value="completed">Hoàn thành (completed)</option>
                </Select>
              </Field>
            );
          // Ô chữ / số / ngày.
          return (
            <Field key={f.key} label={f.label} htmlFor={id}>
              <Input
                id={id}
                type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                step={f.kind === "number" ? "any" : undefined}
                value={String(v ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          );
        })}
      </div>
      {/* Chân hộp: Hủy và Lưu thay đổi */}
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button onClick={save} loading={busy}>
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}
