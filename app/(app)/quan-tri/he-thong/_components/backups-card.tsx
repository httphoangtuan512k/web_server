"use client";

import { Archive, DatabaseBackup, Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtBytes, fmtDateTime, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, Spinner } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useApiData } from "../../_shared/use-api-data";
import type { BackupCreateResponse, BackupItem, BackupListResponse } from "./types";

const KIND: Record<string, { label: string; tone: "brand" | "success" | "neutral" | "accent" }> = {
  daily: { label: "Hằng ngày", tone: "success" },
  manual: { label: "Thủ công", tone: "brand" },
  startup: { label: "Khởi động", tone: "neutral" },
  cron: { label: "Tự động", tone: "success" },
};

/** Tên dạng 'YYYY-MM-DD_<loại>_HHMMSS' → loại. */
function kindOf(name: string) {
  const m = /_(daily|manual|startup|cron)[_.-]/i.exec(name) || /^(daily|manual|startup|cron)/i.exec(name.split("/").pop() || "");
  return m ? m[1].toLowerCase() : "";
}
const pathOf = (b: BackupItem) => b.pathname || b.path || b.name;
const displayName = (b: BackupItem) => (b.name || pathOf(b)).split("/").pop() || b.name;

export function BackupsCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApiData<BackupListResponse | BackupItem[]>("/api/superadmin/backups");
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState("");

  const rows = useMemo<BackupItem[] | null>(() => (data ? (Array.isArray(data) ? data : data.rows ?? []) : null), [data]);

  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  async function create() {
    const ok = await confirm({
      title: "Tạo bản sao lưu ngay?",
      message: "Hệ thống sẽ sao lưu toàn bộ dữ liệu ngay bây giờ. Quá trình có thể mất vài chục giây.",
      confirmText: "Sao lưu ngay",
    });
    if (!ok) return;
    setCreating(true);
    try {
      const r = await api.post<BackupCreateResponse>("/api/superadmin/backups");
      toast.success(`Sao lưu thành công: ${r?.name ?? ""}`);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  async function download(b: BackupItem) {
    const p = pathOf(b);
    setDownloading(p);
    try {
      await api.download(`/api/superadmin/backups/download?path=${encodeURIComponent(p)}`, displayName(b));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloading("");
    }
  }

  const latest = rows?.[0];

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={DatabaseBackup}
        title="Sao lưu dữ liệu"
        description="Tự động sao lưu hằng ngày; lưu giữ vĩnh viễn, không tự xóa bản cũ."
        actions={
          <>
            <Button variant="ghost" size="icon" icon={RefreshCw} loading={loading} onClick={refresh} aria-label="Làm mới" title="Làm mới" />
            <Button icon={DatabaseBackup} loading={creating} onClick={create}>
              Sao lưu ngay
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        <div className="bg-surface px-5 py-3">
          <p className="text-xs text-muted">Số bản sao lưu</p>
          <p className="num mt-0.5 text-lg font-semibold">{rows ? rows.length : "—"}</p>
        </div>
        <div className="bg-surface px-5 py-3">
          <p className="text-xs text-muted">Gần nhất</p>
          <p className="mt-0.5 text-sm font-medium">{latest ? fmtRelative(latest.createdAt) : "—"}</p>
          {latest ? <p className="num text-xs text-muted">{fmtDateTime(latest.createdAt)}</p> : null}
        </div>
      </div>

      {error && !rows ? (
        <EmptyState icon={Archive} title="Không tải được danh sách sao lưu" description={error} />
      ) : !rows ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState icon={Archive} title="Chưa có bản sao lưu nào" description="Bấm “Sao lưu ngay” để tạo bản đầu tiên." />
      ) : (
        <ul className="max-h-[440px] divide-y divide-line overflow-y-auto">
          {rows.map((b) => {
            const k = KIND[kindOf(b.name)];
            const p = pathOf(b);
            return (
              <li key={p} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
                  <Archive size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] text-fg" title={p}>
                    {displayName(b)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="num">{fmtDateTime(b.createdAt)}</span>
                    {typeof b.size === "number" ? <span className="num">· {fmtBytes(b.size)}</span> : null}
                    {k ? <Badge tone={k.tone}>{k.label}</Badge> : null}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  loading={downloading === p}
                  disabled={!!downloading && downloading !== p}
                  onClick={() => download(b)}
                  aria-label={`Tải về ${displayName(b)}`}
                >
                  <span className="hidden sm:inline">Tải về</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
