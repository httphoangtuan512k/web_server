"use client";
/**
 * File này: ô chọn/chụp ảnh – xem trước ảnh, nút "Thêm ảnh"/"Đổi ảnh", link "Gỡ ảnh".
 * Dùng ở: form đơn hàng, bảo trì, ảnh đại diện.
 */

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { uploadImage } from "@/lib/upload";
import { useToast } from "./toast";

/**
 * Chọn/chụp ảnh -> nén -> upload Blob -> trả về '/api/files/...' qua onChange.
 * `value` có thể là '/api/files/...', data-URL cũ, hoặc ''.
 */
export function ImageInput({
  value,
  onChange,
  folder,
  label = "Thêm ảnh",
  className,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  folder: "orders" | "maintenance" | "avatars";
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  // ref = trỏ tới ô chọn file ẩn; busy = đang tải ảnh lên.
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Hàm hiện thông báo nhỏ.
  const toast = useToast();

  /** Khi chọn xong ảnh: nén + upload, báo lỗi nếu hỏng, rồi xóa lựa chọn để chọn lại được. */
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file, folder));
    } catch (e) {
      toast.error(`Không tải được ảnh: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Có ảnh: ô vuông 80px hiện ảnh, bấm để mở ảnh lớn ở tab mới. */}
      {value ? (
        <a href={value} target="_blank" rel="noreferrer" className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
        </a>
      ) : (
        // Chưa có ảnh: ô vuông viền đứt với icon thêm ảnh (hoặc vòng xoay).
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong bg-surface-2 text-subtle">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {/* Ô chọn file ẩn (điện thoại mở camera sau). */}
        <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {/* Nút "Thêm ảnh" / "Đổi ảnh" / "Đang tải lên…": bấm để mở ô chọn file. */}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => ref.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-fg hover:bg-surface-3 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {busy ? "Đang tải lên…" : value ? "Đổi ảnh" : label}
        </button>
        {/* Link đỏ "Gỡ ảnh": chỉ hiện khi đã có ảnh. */}
        {value && !disabled ? (
          <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-danger-600 hover:underline">
            <Trash2 size={12} /> Gỡ ảnh
          </button>
        ) : null}
      </div>
    </div>
  );
}
