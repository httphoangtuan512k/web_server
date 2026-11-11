"use client";

import { FileSpreadsheet, Info, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { DocumentList, type DocAccess, type DocActions } from "./document-list";
import { FileDrop, uploadExcel, type UploadProgress } from "./file-drop";
import { HistoryModal } from "./history-modal";
import { PermissionModal } from "./permission-modal";
import { validateExcel, type DocumentFile, type FilesResponse } from "./types";
import { acquireLock, UpdateModal, type EditLock } from "./update-modal";

type Dialog =
  | { kind: "update"; doc: DocumentFile; lock: EditLock }
  | { kind: "permissions"; doc: DocumentFile }
  | { kind: "history"; doc: DocumentFile }
  | null;

export function DocumentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<FilesResponse | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const fetchFiles = useCallback(() => api.get<FilesResponse>("/api/tai-lieu/files"), []);

  useEffect(() => {
    let alive = true;
    fetchFiles()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [fetchFiles]);

  const reload = useCallback(async () => {
    try {
      setData(await fetchFiles());
      setError("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [fetchFiles, toast]);

  const isSuper = !!data?.isSuper;
  const docs = useMemo(() => {
    const k = q.trim().toLowerCase();
    const files = data?.files || [];
    return k ? files.filter((f) => `${f.original_name} ${f.owner_name}`.toLowerCase().includes(k)) : files;
  }, [data, q]);
  const totalBytes = useMemo(() => (data?.files || []).reduce((a, f) => a + (Number(f.size_bytes) || 0), 0), [data]);

  const accessOf = useCallback(
    (d: DocumentFile): DocAccess => {
      const owner = d.my_permission === "owner";
      return { canUpdate: owner || isSuper || d.my_permission === "edit", canManage: owner || isSuper, isSuper };
    },
    [isSuper],
  );

  async function upload(file: File) {
    const err = validateExcel(file);
    if (err) return toast.error(err);
    setProgress({ name: file.name, size: file.size, pct: 0, stage: "upload" });
    try {
      const up = await uploadExcel(file, (pct) => setProgress((p) => (p ? { ...p, pct } : p)));
      setProgress((p) => (p ? { ...p, pct: 100, stage: "save" } : p));
      await api.post("/api/tai-lieu/upload", { ...up });
      toast.success("Tải tài liệu lên thành công.");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

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

  const actions: DocActions = {
    download,
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
    permissions: (d) => setDialog({ kind: "permissions", doc: d }),
    history: (d) => setDialog({ kind: "history", doc: d }),
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

  return (
    <>
      <PageHeader title="Tài liệu" description="Kho tài liệu Excel dùng chung, phân quyền theo từng tài liệu" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader icon={FileSpreadsheet} title="Tải tài liệu lên" actions={<Badge tone="brand">Phân quyền theo từng tài liệu</Badge>} />
          <div className="space-y-3 p-4 sm:p-5">
            <FileDrop onFile={upload} progress={progress} />
            <p className="text-[13px] leading-relaxed text-muted">
              Khi tải lên, chỉ người tạo và Super Admin được xem. Mọi người khác mặc định không có quyền; người tạo cần chủ động cấp quyền xem hoặc cập nhật cho
              từng người.
            </p>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info-50 text-info-600">
              <Info size={17} />
            </span>
            <div className="text-[13px] leading-relaxed text-muted">
              <p className="mb-1 font-semibold text-fg">Cách sử dụng</p>
              <p>
                Bấm <b className="text-fg">Tải về</b> để mở bằng Microsoft Excel. Khi cần sửa, bấm <b className="text-fg">Cập nhật</b> để nhận quyền chỉnh sửa (người
                khác chỉ xem được trong lúc này), sửa xong thì tải file đã lưu lên để ghi đè.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Danh sách tài liệu"
          description={data ? `${data.files.length} tài liệu · ${fmtBytes(totalBytes)}` : undefined}
          actions={
            <>
              <SearchInput placeholder="Tìm tên tài liệu / chủ sở hữu" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-72" />
              <Button variant="secondary" icon={RefreshCw} onClick={reload}>
                Làm mới
              </Button>
            </>
          }
        />
        {!data ? (
          error ? (
            <p className="px-5 py-10 text-center text-sm text-danger-600">{error}</p>
          ) : (
            <Spinner />
          )
        ) : !docs.length ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={data.files.length ? "Không tìm thấy tài liệu phù hợp." : "Chưa có tài liệu nào."}
            description={data.files.length ? undefined : "Hãy tải file Excel đầu tiên lên."}
          />
        ) : (
          <DocumentList docs={docs} accessOf={accessOf} actions={actions} isSuper={isSuper} downloading={downloading} />
        )}
      </Card>

      {dialog?.kind === "update" ? (
        <UpdateModal doc={dialog.doc} initialLock={dialog.lock} onClose={() => setDialog(null)} onUpdated={reload} onDownload={download} />
      ) : null}
      {dialog?.kind === "permissions" ? <PermissionModal doc={dialog.doc} onClose={() => setDialog(null)} onSaved={reload} /> : null}
      {dialog?.kind === "history" ? <HistoryModal doc={dialog.doc} onClose={() => setDialog(null)} /> : null}
    </>
  );
}
