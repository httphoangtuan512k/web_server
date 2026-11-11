"use client";
/**
 * File này: thông báo nhỏ (toast) hiện ở góc dưới màn hình rồi tự ẩn.
 * Dùng ở: app/layout.tsx bọc toàn app; trang gọi useToast() để báo lưu thành công/lỗi.
 */

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

// Loại thông báo: thành công / lỗi / thông tin.
type ToastKind = "success" | "error" | "info";
/** Một thông báo đang hiện. */
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
/** Các hàm để trang gọi: toast.success("…"), toast.error("…"), toast.info("…"). */
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// Kho dùng chung (Context) và bộ đếm để mỗi thông báo có mã riêng.
const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

/** Giữ danh sách thông báo và vẽ chúng ở góc dưới màn hình. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  // Danh sách thông báo đang hiện.
  const [items, setItems] = useState<ToastItem[]>([]);
  // Xóa 1 thông báo theo mã.
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  // Thêm thông báo (giữ tối đa 4), tự ẩn sau 3,5 giây (lỗi: 6 giây).
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++seq;
      setItems((xs) => [...xs.slice(-3), { id, kind, message }]);
      setTimeout(() => remove(id), kind === "error" ? 6000 : 3500);
    },
    [remove],
  );
  // Bộ hàm success/error/info, tạo một lần và giữ nguyên.
  const [api] = useState<ToastApi>(() => ({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  }));

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Vùng thông báo: dưới giữa (điện thoại) / dưới phải (màn hình lớn). */}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((t) => {
          // Icon theo loại: ✓ xanh lá, ! đỏ, i xanh dương.
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
          return (
            // Một thẻ thông báo trắng bo góc: icon + nội dung + nút ✕ đóng.
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3 pr-2 text-sm text-fg shadow-pop"
            >
              <Icon
                size={18}
                className={cn("mt-0.5 shrink-0", t.kind === "success" ? "text-success-600" : t.kind === "error" ? "text-danger-600" : "text-info-600")}
              />
              <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
              <button onClick={() => remove(t.id)} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-fg" aria-label="Đóng">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Lấy bộ hàm hiện thông báo trong component bất kỳ. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải nằm trong <ToastProvider>");
  return ctx;
}
