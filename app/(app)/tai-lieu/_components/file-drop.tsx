"use client";
/**
 * File này: ô chọn / kéo thả file Excel, đưa file lên kho lưu trữ (Blob) và hiện thanh tiến độ %.
 * Dùng ở: trang /tai-lieu (tải tài liệu mới) và hộp thoại "Cập nhật" (tải bản mới đè lên).
 */

import { FileSpreadsheet, Loader2, Paperclip, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/cn";
import { fmtBytes } from "@/lib/format";
import { tlBtn } from "./tl-ui";
import { ACCEPT, contentTypeOf } from "./types";

// Thông tin file sau khi đã đưa lên Blob.
export interface UploadedExcel {
  pathname: string;
  originalName: string;
  size: number;
  contentType: string;
}

/** Bước 1 của luồng upload mới: đưa file thẳng lên Blob (thư mục documents). */
// Đưa file lên Blob, báo % qua onProgress; trả về đường dẫn, tên, cỡ, loại file.
export async function uploadExcel(file: File, onProgress?: (pct: number) => void): Promise<UploadedExcel> {
  const r = await uploadFile(file, "documents", file.name, onProgress);
  return { pathname: r.pathname, originalName: file.name, size: file.size, contentType: contentTypeOf(file, r.contentType) };
}

// Tiến độ tải lên đang hiển thị.
export interface UploadProgress {
  name: string;
  size: number;
  pct: number;
  /** 'upload' = đang đẩy lên Blob, 'save' = đang ghi nhận vào hệ thống. */
  stage: "upload" | "save";
}

/** Vùng kéo-thả / chọn file Excel, kèm thanh tiến trình khi đang tải lên. */
// onFile = gọi khi người dùng chọn/thả một file; compact = khung thấp hơn.
export function FileDrop({
  onFile,
  progress,
  disabled,
  title = "Kéo thả file Excel vào đây hoặc bấm để chọn",
  hint = ".xlsx, .xlsm, .xls, .xlsb · tối đa 50 MB",
  compact,
}: {
  onFile: (file: File) => void;
  progress: UploadProgress | null;
  disabled?: boolean;
  title?: string;
  hint?: string;
  compact?: boolean;
}) {
  // Ô chọn file ẩn; có kéo file ngang qua không; đang tải lên không.
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = !!progress;

  // Đang tải lên → chỉ hiện thanh tiến độ.
  if (progress) return <UploadProgressView progress={progress} />;

  return (
    <>
      {/* Ô chọn file ẩn của trình duyệt. */}
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          // Lấy file đã chọn, xóa ô để chọn lại cùng file được, rồi báo ra ngoài.
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      {/* Khung viền nét đứt: bấm để chọn file, hoặc kéo thả file vào. */}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
        // Kéo file ngang qua: tô sáng khung.
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        // Thả file: lấy file đầu tiên.
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !disabled) onFile(f);
        }}
        className={cn(
          "flex w-full items-center gap-4 rounded-xl border-2 border-dashed text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          compact ? "px-4 py-4" : "px-5 py-6 sm:py-8",
          over ? "border-brand-500 bg-brand-50" : "border-line-strong bg-surface-2 hover:border-brand-500 hover:bg-brand-50/50",
        )}
      >
        {/* Biểu tượng đám mây và 2 dòng chữ hướng dẫn. */}
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <UploadCloud size={22} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-fg">{title}</span>
          <span className="mt-0.5 block text-xs text-muted">{hint}</span>
        </span>
      </button>
    </>
  );
}

/** Thanh tiến trình khi đang tải file lên. */
export function UploadProgressView({ progress }: { progress: UploadProgress }) {
  return (
      // Khung xanh: Tên file, dung lượng, "Đang tải lên… %" hoặc "Đang lưu vào hệ thống…".
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-brand-600">
            <FileSpreadsheet size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{progress.name}</p>
            <p className="text-xs text-muted">
              {fmtBytes(progress.size)} · {progress.stage === "upload" ? `Đang tải lên… ${progress.pct}%` : "Đang lưu vào hệ thống…"}
            </p>
          </div>
          <Loader2 size={18} className="animate-spin text-brand-600" />
        </div>
        {/* Thanh tiến độ: phần màu dài theo %. */}
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.stage === "upload" ? progress.pct : 100}
        >
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-200" style={{ width: `${progress.stage === "upload" ? progress.pct : 100}%` }} />
        </div>
      </div>
    );
}

/**
 * Hàng tải lên như bản gốc: ô chọn file + nút "＋ Tải tài liệu lên".
 * Có thể kéo-thả file vào hàng này.
 */
export function UploadPicker({ onUpload, progress }: { onUpload: (file: File) => Promise<void> | void; progress: UploadProgress | null }) {
  // Ô chọn file ẩn, file đã chọn, có kéo file ngang qua không.
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);

  // Đang tải lên → chỉ hiện thanh tiến độ.
  if (progress) return <UploadProgressView progress={progress} />;

  return (
    <form
      // Bấm "＋ Tải tài liệu lên": chưa chọn file thì mở ô chọn; có rồi thì tải lên.
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return ref.current?.click();
        const f = file;
        setFile(null);
        if (ref.current) ref.current.value = "";
        await onUpload(f);
      }}
      // Kéo thả file vào hàng: tô sáng khung, thả thì nhận file.
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
      }}
      className={cn(
        "flex flex-wrap items-center gap-2.5 rounded-[10px] border border-dashed p-2.5 transition-colors",
        over ? "border-[#2563eb] bg-[#eff6ff]" : "border-transparent",
      )}
    >
      {/* Ô chọn file ẩn. */}
      <input ref={ref} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {/* Nút "Chọn file" + tên file đã chọn (hoặc "Chưa chọn file"). */}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="inline-flex min-h-10 min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto rounded-[7px] border border-[#cbd5e1] bg-white px-3 py-2 text-left text-sm text-[#334155] transition hover:border-[#94a3b8] sm:max-w-[420px]"
      >
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[5px] border border-[#cbd5e1] bg-[#f1f5f9] px-2 py-0.5 text-[13px] font-medium">
          <Paperclip size={13} /> Chọn file
        </span>
        <span className={cn("min-w-0 truncate", !file && "text-[#64748b]")}>{file ? `${file.name} · ${fmtBytes(file.size)}` : "Chưa chọn file"}</span>
      </button>
      {/* Nút xanh "＋ Tải tài liệu lên". */}
      <button type="submit" className={cn(tlBtn.base, tlBtn.md, tlBtn.blue, "w-full sm:w-auto")}>
        ＋ Tải tài liệu lên
      </button>
      {/* Dòng gợi ý định dạng và dung lượng. */}
      <span className="w-full text-xs text-[#64748b]">.xlsx, .xlsm, .xls, .xlsb · tối đa 50 MB · có thể kéo thả file vào đây</span>
    </form>
  );
}
