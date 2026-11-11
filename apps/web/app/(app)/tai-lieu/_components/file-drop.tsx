"use client";

import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/cn";
import { fmtBytes } from "@/lib/format";
import { ACCEPT, contentTypeOf } from "./types";

export interface UploadedExcel {
  pathname: string;
  originalName: string;
  size: number;
  contentType: string;
}

/** Bước 1 của luồng upload mới: đưa file thẳng lên Blob (thư mục documents). */
export async function uploadExcel(file: File, onProgress?: (pct: number) => void): Promise<UploadedExcel> {
  const r = await uploadFile(file, "documents", file.name, onProgress);
  return { pathname: r.pathname, originalName: file.name, size: file.size, contentType: contentTypeOf(file, r.contentType) };
}

export interface UploadProgress {
  name: string;
  size: number;
  pct: number;
  /** 'upload' = đang đẩy lên Blob, 'save' = đang ghi nhận vào hệ thống. */
  stage: "upload" | "save";
}

/** Vùng kéo-thả / chọn file Excel, kèm thanh tiến trình khi đang tải lên. */
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
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = !!progress;

  if (progress) {
    return (
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

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
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
