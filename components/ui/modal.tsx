"use client";
/**
 * File này: hộp thoại (Modal) và hộp xác nhận "Bạn có chắc…?" (useConfirm).
 * Dùng ở: form tạo/sửa, chi tiết, xác nhận xóa… khắp ứng dụng.
 */

import { AlertTriangle, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/**
 * Hộp thoại dùng <dialog> gốc (focus trap, Esc để đóng sẵn có).
 *   <Modal open={open} onClose={() => setOpen(false)} title="Sửa đơn" footer={<Button>Lưu</Button>}>…</Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  // Trỏ tới thẻ <dialog> để mở/đóng nó bằng code.
  const ref = useRef<HTMLDialogElement>(null);
  // Khi `open` đổi: mở hoặc đóng hộp thoại.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Độ rộng tối đa theo `size`.
  const width = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl", full: "sm:max-w-[min(1400px,96vw)]" }[size];
  return (
    // Điện thoại: hộp trồi từ dưới lên; màn hình lớn: hộp ở giữa. Nền phía sau tối mờ.
    <dialog
      ref={ref}
      onClose={onClose}
      // Nhấn Esc hoặc bấm ra nền tối ngoài hộp → đóng.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]",
        "sm:m-auto sm:rounded-2xl",
        width,
      )}
    >
      {open ? (
        // Chỉ vẽ nội dung khi đang mở.
        <div className="flex max-h-[92dvh] flex-col">
          {/* Đầu hộp: tiêu đề, mô tả, nút ✕ đóng. */}
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{title}</h2>
              {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
            </div>
            <button onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-subtle hover:bg-surface-3 hover:text-fg" aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
          {/* Thân hộp: cuộn dọc nếu dài. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {/* Chân hộp: các nút (Lưu, Hủy…) căn phải. */}
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Tùy chọn hộp xác nhận: tiêu đề, nội dung, chữ 2 nút, danger = kiểu nguy hiểm (nút đỏ). */
interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
// Hàm confirm trả về Promise: đợi người dùng bấm, true = Đồng ý.
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** const confirm = useConfirm(); if (await confirm({ title: 'Xóa đơn?', danger: true })) … */
/** Cung cấp hộp "Bạn có chắc…?" dùng chung cho cả app. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // Hộp đang hỏi (null = không hỏi) kèm hàm trả kết quả.
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  // Mở hộp và chờ người dùng trả lời.
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  // Đóng hộp và trả kết quả về nơi đã hỏi.
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* Hộp xác nhận nhỏ: icon ⚠ đỏ nếu nguy hiểm; nút "Hủy" trắng + "Đồng ý" (xanh hoặc đỏ). */}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {state?.danger ? <AlertTriangle size={18} className="text-danger-600" /> : null}
            {state?.title}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {state?.cancelText || "Hủy"}
            </Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {state?.confirmText || "Đồng ý"}
            </Button>
          </>
        }
      >
        {state?.message ? <div className="text-sm text-muted">{state.message}</div> : null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Lấy hàm confirm() để hỏi người dùng trước khi làm việc quan trọng. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm phải nằm trong <ConfirmProvider>");
  return ctx;
}
