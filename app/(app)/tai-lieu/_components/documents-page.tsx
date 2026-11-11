"use client";
/**
 * File này: trang Tài liệu dùng chung – tải file Excel lên, tìm kiếm, xem/tải, cập nhật, phân quyền, xóa.
 * Dùng ở: trang /tai-lieu (mọi nhân viên; mỗi tài liệu có quyền riêng).
 */

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtBytes } from "@/lib/format";
import { PageBody, PageTopbar } from "@/components/shell/page-topbar";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { DocumentList, type DocAccess, type DocActions } from "./document-list";
import { uploadExcel, UploadPicker, type UploadProgress } from "./file-drop";
import { HistoryModal } from "./history-modal";
import { PermissionModal } from "./permission-modal";
import { validateExcel, type DocumentFile, type FilesResponse } from "./types";
import { tlBtn } from "./tl-ui";
import { acquireLock, UpdateModal, type EditLock } from "./update-modal";

// Hộp thoại đang mở: cập nhật, phân quyền, lịch sử, hoặc không có.
type Dialog =
  | { kind: "update"; doc: DocumentFile; lock: EditLock }
  | { kind: "permissions"; doc: DocumentFile }
  | { kind: "history"; doc: DocumentFile }
  | null;

// Trang Tài liệu.
export function DocumentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  // Dữ liệu danh sách, lỗi, chữ tìm kiếm.
  const [data, setData] = useState<FilesResponse | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  // Tiến độ tải lên, hộp thoại đang mở, file đang tải về, đang xin khóa.
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  // Gọi API lấy danh sách tài liệu.
  const fetchFiles = useCallback(() => api.get<FilesResponse>("/api/tai-lieu/files"), []);

  // Lần đầu hiện: tải danh sách.
  useEffect(() => {
    let alive = true;
    fetchFiles()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [fetchFiles]);

  // Tải lại danh sách (nút "↻ Làm mới", sau khi thay đổi).
  const reload = useCallback(async () => {
    try {
      setData(await fetchFiles());
      setError("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [fetchFiles, toast]);

  const isSuper = !!data?.isSuper;
  // Lọc tài liệu theo tên hoặc người tải lên.
  const docs = useMemo(() => {
    const k = q.trim().toLowerCase();
    const files = data?.files || [];
    return k ? files.filter((f) => `${f.original_name} ${f.owner_name}`.toLowerCase().includes(k)) : files;
  }, [data, q]);
  // Tổng dung lượng mọi tài liệu.
  const totalBytes = useMemo(() => (data?.files || []).reduce((a, f) => a + (Number(f.size_bytes) || 0), 0), [data]);

  // Quyền với một tài liệu: được cập nhật? được quản lý (phân quyền, xóa)?
  const accessOf = useCallback(
    (d: DocumentFile): DocAccess => {
      const owner = d.my_permission === "owner";
      return { canUpdate: owner || isSuper || d.my_permission === "edit", canManage: owner || isSuper, isSuper };
    },
    [isSuper],
  );

  // Tải file lên: kiểm tra → upload kèm % tiến độ → lưu thông tin → tải lại.
  async function upload(file: File) {
    const err = validateExcel(file);
    if (err) return toast.error(err);
    setProgress({ name: file.name, size: file.size, pct: 0, stage: "upload" });
    try {
      // Upload file lên kho lưu trữ (Blob), cập nhật % tiến độ.
      const up = await uploadExcel(file, (pct) => setProgress((p) => (p ? { ...p, pct } : p)));
      setProgress((p) => (p ? { ...p, pct: 100, stage: "save" } : p));
      // Báo máy chủ ghi nhận tài liệu mới.
      await api.post("/api/tai-lieu/upload", { ...up });
      toast.success("Tải tài liệu lên thành công.");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  // Nút "Xem / Tải": tải file về máy.
  const download = useCallback(
    async (d: DocumentFile) => {
      setDownloading(d.id);
      try {
        await api.download(`/api/tai-lieu/${d.id}/download`, d.original_name);
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setDownloading(null);
      }
    },
    [toast],
  );

  // Các việc làm được trên mỗi tài liệu.
  const actions: DocActions = {
    download,
    // "Cập nhật": xin khóa chỉnh sửa (không cho người khác sửa cùng lúc) rồi mở hộp thoại.
    async update(d) {
      if (locking) return;
      setLocking(true);
      try {
        const lock = await acquireLock(d.id);
        setDialog({ kind: "update", doc: d, lock });
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setLocking(false);
      }
    },
    // Mở hộp thoại phân quyền / lịch sử.
    permissions: (d) => setDialog({ kind: "permissions", doc: d }),
    history: (d) => setDialog({ kind: "history", doc: d }),
    // "Xóa": hỏi xác nhận → xóa trên máy chủ → tải lại.
    async remove(d) {
      const ok = await confirm({
        title: "Xóa tài liệu?",
        message: (
          <>
            Bạn chắc chắn muốn xóa <b className="text-fg">{d.original_name}</b>? Người được phân quyền sẽ không còn nhìn thấy tài liệu.
          </>
        ),
        danger: true,
        confirmText: "Xóa",
      });
      if (!ok) return;
      try {
        const r = await api.delete<{ ok: boolean; message?: string }>(`/api/tai-lieu/${d.id}`);
        toast.success(r?.message || "Đã xóa tài liệu.");
        await reload();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    // "Gỡ khóa": hỏi xác nhận → bỏ khóa chỉnh sửa đang có.
    async unlock(d) {
      const ok = await confirm({
        title: "Gỡ khóa chỉnh sửa?",
        message: "Nếu có người đang giữ quyền chỉnh sửa tài liệu này, họ sẽ mất quyền và không thể ghi đè bản cập nhật.",
        confirmText: "Gỡ khóa",
      });
      if (!ok) return;
      try {
        const r = await api.delete<{ ok: boolean; released?: boolean }>(`/api/tai-lieu/${d.id}/lock`);
        toast.success(r?.released ? "Đã gỡ khóa chỉnh sửa." : "Tài liệu hiện không bị khóa.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
  };

  // Câu thay cho danh sách: đang tải / lỗi / không tìm thấy / chưa có.
  const emptyText = !data
    ? error || "Đang tải..."
    : !docs.length
      ? data.files.length
        ? "Không tìm thấy tài liệu phù hợp."
        : "Chưa có tài liệu nào. Hãy tải file Excel đầu tiên lên."
      : null;

  // Kiểu khung trắng bo góc cho 2 khối.
  const panel = "rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-[0_3px_12px_#0f172a08] sm:p-5";

  return (
    <div className="min-h-dvh bg-[#f3f5f8] text-[#1e293b]">
      {/* Thanh tiêu đề "QUẢN LÝ TÀI LIỆU" + nút "← Về trang chủ". */}
      <PageTopbar title="QUẢN LÝ TÀI LIỆU" color="#172b3a" backLabel="← Về trang chủ" />

      <PageBody className="space-y-[18px] sm:pt-7">
        <div className="mx-auto w-full max-w-[1400px] space-y-[18px]">
          {/* Kho tài liệu dùng chung: tải lên */}
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold sm:text-[19px]">Kho tài liệu dùng chung</h2>
              <span className="inline-block rounded-full bg-[#eff6ff] px-2 py-1 text-[11px] text-[#1d4ed8]">Phân quyền theo từng tài liệu</span>
            </div>
            {/* Hướng dẫn quyền khi tải lên. */}
            <p className="mt-3 text-[13px] leading-relaxed text-[#64748b]">
              Khi tải lên, chỉ người tạo và Super Admin được xem. Tất cả người khác mặc định không có quyền; người tạo cần chủ động cấp quyền xem hoặc cập nhật cho
              từng người.
            </p>
            {/* Ô kéo thả / chọn file Excel để tải lên. */}
            <div className="mt-3 -mx-2.5">
              <UploadPicker onUpload={upload} progress={progress} />
            </div>
            {/* Khung cam: cách sử dụng. */}
            <div className="mt-3 rounded-lg bg-[#fff7ed] p-3 text-[13px] leading-relaxed text-[#9a3412]">
              Cách sử dụng: Chọn “Xem / Tải” để tải file về máy và mở bằng Microsoft Excel. Khi cần sửa, chọn “Cập nhật” để nhận quyền chỉnh sửa (người khác chỉ xem
              được trong lúc này), lưu file trên máy tính rồi tải bản mới lên để ghi đè lên máy chủ. Chỉ người có quyền cập nhật mới thực hiện được thao tác này.
            </div>
          </section>

          {/* Danh sách tài liệu */}
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold sm:text-[19px]">Danh sách tài liệu</h2>
                {/* Số tài liệu và tổng dung lượng. */}
                {data ? (
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    {data.files.length} tài liệu · {fmtBytes(totalBytes)}
                  </p>
                ) : null}
              </div>
              {/* Ô tìm kiếm + nút "↻ Làm mới". */}
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-[260px] sm:flex-none">
                  <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    type="search"
                    aria-label="Tìm tài liệu"
                    placeholder="Tìm tên tài liệu / người tải lên"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="min-h-8 w-full rounded-[7px] border border-[#cbd5e1] bg-white py-1.5 pr-2.5 pl-8 text-[13px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                </label>
                <button type="button" className={cn(tlBtn.base, tlBtn.sm, tlBtn.gray)} onClick={reload}>
                  ↻ Làm mới
                </button>
              </div>
            </div>
            {/* Danh sách tài liệu với các nút thao tác. */}
            <DocumentList
              docs={docs}
              accessOf={accessOf}
              actions={actions}
              isSuper={isSuper}
              downloading={downloading}
              empty={emptyText ? <span className={!data && error ? "text-[#b91c1c]" : undefined}>{emptyText}</span> : null}
            />
          </section>
        </div>
      </PageBody>

      {/* Hộp thoại đang mở (cập nhật / phân quyền / lịch sử). */}
      {dialog?.kind === "update" ? (
        <UpdateModal doc={dialog.doc} initialLock={dialog.lock} onClose={() => setDialog(null)} onUpdated={reload} onDownload={download} />
      ) : null}
      {dialog?.kind === "permissions" ? <PermissionModal doc={dialog.doc} onClose={() => setDialog(null)} onSaved={reload} /> : null}
      {dialog?.kind === "history" ? <HistoryModal doc={dialog.doc} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
