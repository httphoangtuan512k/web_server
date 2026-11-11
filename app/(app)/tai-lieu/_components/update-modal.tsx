"use client";
/**
 * File này: hộp thoại "Cập nhật tài liệu" – giữ khóa chỉnh sửa (tự gia hạn), tải bản mới nhất, tải bản đã sửa lên ghi đè.
 * Dùng ở: nút "Cập nhật" trên trang /tai-lieu. Khóa giúp hai người không ghi đè lên nhau.
 */

import { AlertTriangle, Download, LockKeyhole, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtBytes, fmtDateTime, fmtTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { FileDrop, uploadExcel, type UploadProgress } from "./file-drop";
import { validateExcel, type DocumentFile, type LockResponse } from "./types";

const RENEW_MS = 60_000; // khóa sống 3 phút trên server → gia hạn mỗi phút

// Khóa chỉnh sửa: mã khóa + giờ hết hạn.
export interface EditLock {
  token: string;
  expiresAt: string;
}

/** Nhận khóa chỉnh sửa. Ném lỗi (409 nếu người khác đang sửa). */
// Gửi yêu cầu khóa lên máy chủ.
export async function acquireLock(docId: string): Promise<EditLock> {
  const r = await api.post<LockResponse>(`/api/tai-lieu/${docId}/lock`);
  return { token: r.token, expiresAt: r.expiresAt };
}

/** Nhả khóa (bỏ qua lỗi). `keepalive` để chạy được cả khi đóng tab. */
export function releaseLock(docId: string) {
  // Gửi lệnh bỏ khóa; lỗi thì bỏ qua.
  return fetch(`/api/tai-lieu/${docId}/lock`, { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => undefined);
}

/**
 * Phiên cập nhật tài liệu: giữ khóa (tự gia hạn), tải bản mới nhất, upload bản đã sửa
 * (Blob → POST /:id/update), nhả khóa khi đóng.
 */
export function UpdateModal({
  doc,
  initialLock,
  onClose,
  onUpdated,
  onDownload,
}: {
  doc: DocumentFile;
  initialLock: EditLock;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
  onDownload: (doc: DocumentFile) => Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  // Khóa đang giữ (null = đã mất khóa) và lý do mất khóa.
  const [lock, setLock] = useState<EditLock | null>(initialLock);
  const [lost, setLost] = useState("");
  // Tiến độ tải lên, đang xin lại khóa, đang tải về.
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [reacquiring, setReacquiring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Mã khóa; cờ "đã nhả khóa" để không nhả 2 lần.
  const token = lock?.token;
  const releasedRef = useRef(false);

  // Gia hạn khóa định kỳ.
  useEffect(() => {
    // Không còn khóa thì thôi gia hạn.
    if (!token) return;
    // Cứ mỗi phút (setInterval) gửi yêu cầu gia hạn khóa.
    const t = setInterval(async () => {
      try {
        const r = await api.put<{ ok: boolean; expiresAt: string }>(`/api/tai-lieu/${doc.id}/lock/renew`, { token });
        setLock({ token, expiresAt: r.expiresAt });
      // Gia hạn thất bại → coi như mất khóa, hiện cảnh báo.
      } catch (e) {
        setLock(null);
        setLost(errorMessage(e));
      }
    }, RENEW_MS);
    // Đóng hộp thoại thì dừng gia hạn.
    return () => clearInterval(t);
  }, [doc.id, token]);

  // Nhả khóa khi đóng tab / rời trang.
  useEffect(() => {
    const onHide = () => {
      if (!releasedRef.current) releaseLock(doc.id);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [doc.id]);

  // Đóng hộp thoại: (không cho đóng khi đang tải lên) nhả khóa rồi đóng.
  async function close() {
    if (progress) return;
    releasedRef.current = true;
    if (lock) releaseLock(doc.id);
    onClose();
  }

  // Nút "Nhận lại quyền": xin khóa lại khi đã mất.
  async function reacquire() {
    setReacquiring(true);
    try {
      setLock(await acquireLock(doc.id));
      setLost("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setReacquiring(false);
    }
  }

  // Nút "Tải về": tải bản mới nhất về máy.
  async function download() {
    setDownloading(true);
    try {
      await onDownload(doc);
    } finally {
      setDownloading(false);
    }
  }

  // Chọn file đã sửa: kiểm tra → hỏi xác nhận → upload → ghi đè trên máy chủ → nhả khóa → đóng.
  async function pick(file: File) {
    const err = validateExcel(file);
    if (err) return toast.error(err);
    // Phải còn giữ khóa mới được ghi đè.
    if (!lock) return toast.error("Bạn chưa giữ quyền chỉnh sửa tài liệu này.");
    const ok = await confirm({
      title: "Ghi đè tài liệu?",
      message: (
        <>
          Dùng file <b className="text-fg">{file.name}</b> ({fmtBytes(file.size)}) để ghi đè bản hiện tại trên máy chủ.
        </>
      ),
      confirmText: "Cập nhật",
    });
    if (!ok) return;
    setProgress({ name: file.name, size: file.size, pct: 0, stage: "upload" });
    try {
      // Bước 1: đưa file lên Blob, cập nhật %.
      const up = await uploadExcel(file, (pct) => setProgress((p) => (p ? { ...p, pct } : p)));
      setProgress((p) => (p ? { ...p, pct: 100, stage: "save" } : p));
      // Bước 2: báo máy chủ ghi đè (gửi kèm mã khóa và phiên bản đang sửa để phát hiện xung đột).
      const r = await api.post<{ ok: boolean; message?: string }>(`/api/tai-lieu/${doc.id}/update`, {
        ...up,
        lockToken: lock.token,
        expectedVersion: String(doc.version),
      });
      toast.success(r?.message || "Cập nhật tài liệu thành công.");
      // Xong: nhả khóa, đóng hộp thoại, tải lại danh sách.
      releasedRef.current = true;
      await releaseLock(doc.id);
      setProgress(null);
      onClose();
      await onUpdated();
    } catch (e) {
      setProgress(null);
      toast.error(errorMessage(e));
    }
  }

  return (
    <Modal
      open
      onClose={close}
      size="md"
      title="Cập nhật tài liệu"
      description={doc.original_name}
      footer={
        <Button variant="secondary" onClick={close} disabled={!!progress}>
          {lock ? "Kết thúc chỉnh sửa" : "Đóng"}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Còn khóa → khung xanh lá "Bạn đang giữ quyền chỉnh sửa…"; mất khóa → khung vàng + nút "Nhận lại quyền". */}
        {lock ? (
          <div className="flex items-start gap-3 rounded-xl border border-success-600/25 bg-success-50 px-4 py-3 text-[13px] text-success-700">
            <LockKeyhole size={17} className="mt-0.5 shrink-0" />
            <p>
              Bạn đang giữ quyền chỉnh sửa (tự gia hạn, hết hạn lúc <b className="num">{fmtTime(lock.expiresAt)}</b> nếu đóng trang). Người khác chỉ có thể xem cho
              tới khi bạn kết thúc.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-warning-600/25 bg-warning-50 px-4 py-3 text-[13px] text-warning-700">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">{lost || "Quyền chỉnh sửa đã hết hạn hoặc không còn thuộc về bạn."}</p>
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={reacquiring} onClick={reacquire}>
              Nhận lại quyền
            </Button>
          </div>
        )}

        {/* 3 bước: tải về → sửa bằng Excel → tải bản đã sửa lên. */}
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <Step n={1} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">Tải bản mới nhất về máy</p>
              <p className="text-[13px] text-muted">Cập nhật lần cuối {fmtDateTime(doc.updated_at)}.</p>
              <Button size="sm" variant="secondary" icon={Download} loading={downloading} onClick={download} className="mt-2">
                Tải về
              </Button>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <div>
              <p className="font-medium text-fg">Mở và chỉnh sửa bằng Microsoft Excel, lưu lại</p>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <div className="min-w-0 flex-1">
              <p className="mb-2 font-medium text-fg">Tải bản đã chỉnh sửa lên để ghi đè</p>
              {/* Ô chọn / kéo thả file (khóa lại nếu không còn quyền). */}
              <FileDrop compact onFile={pick} progress={progress} disabled={!lock} title="Chọn file đã chỉnh sửa" />
            </div>
          </li>
        </ol>
      </div>
    </Modal>
  );
}

// Vòng tròn nhỏ ghi số thứ tự bước.
function Step({ n }: { n: number }) {
  return <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{n}</span>;
}
