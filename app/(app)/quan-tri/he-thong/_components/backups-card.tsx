"use client";

import { Archive } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtBytes, fmtDateTime, fmtRelative } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgCard, OgCardTitle, OgEmptyBox, OgPill } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import type { BackupCreateResponse, BackupItem, BackupListResponse } from "./types";

const KIND: Record<string, { label: string; tone: "default" | "ok" | "muted" }> = {
  daily: { label: "Hằng ngày", tone: "ok" },
  manual: { label: "Thủ công", tone: "default" },
  startup: { label: "Khởi động", tone: "muted" },
  cron: { label: "Tự động", tone: "ok" },
};

/** Tên dạng 'YYYY-MM-DD_<loại>_HHMMSS' → loại. */
function kindOf(name: string) {
  const m = /_(daily|manual|startup|cron)[_.-]/i.exec(name) || /^(daily|manual|startup|cron)/i.exec(name.split("/").pop() || "");
  return m ? m[1].toLowerCase() : "";
}
const pathOf = (b: BackupItem) => b.pathname || b.path || b.name;
const displayName = (b: BackupItem) => (b.name || pathOf(b)).split("/").pop() || b.name;

/** Sao lưu dữ liệu (chức năng mới, không có ở trang cũ) – GET/POST /api/superadmin/backups. */
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
    <OgCard>
      <OgCardTitle
        title="Sao lưu dữ liệu"
        help={
          <>
            Tự động sao lưu hằng ngày; lưu giữ vĩnh viễn, không tự xóa bản cũ.
            {rows ? (
              <>
                {" "}
                · <b className="font-semibold text-[#1e293b]">{rows.length}</b> bản sao lưu
                {latest ? (
                  <>
                    , gần nhất <b className="font-semibold text-[#1e293b]">{fmtRelative(latest.createdAt)}</b> ({fmtDateTime(latest.createdAt)})
                  </>
                ) : null}
                .
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <OgButton loading={loading} onClick={refresh}>
              Làm mới
            </OgButton>
            <OgButton variant="primary" loading={creating} onClick={create}>
              Sao lưu ngay
            </OgButton>
          </>
        }
      />

      {error && !rows ? (
        <OgEmptyBox tone="error">{error}</OgEmptyBox>
      ) : !rows ? (
        <OgEmptyBox>Đang tải...</OgEmptyBox>
      ) : !rows.length ? (
        <OgEmptyBox>Chưa có bản sao lưu nào. Bấm “Sao lưu ngay” để tạo bản đầu tiên.</OgEmptyBox>
      ) : (
        <ul className="max-h-[440px] divide-y divide-[#edf0f4] overflow-y-auto rounded-lg border border-[#e2e8f0]">
          {rows.map((b) => {
            const k = KIND[kindOf(b.name)];
            const p = pathOf(b);
            return (
              <li key={p} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#f8fafc] sm:px-4">
                <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf1f6] text-[#244d68] min-[420px]:grid">
                  <Archive size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]" title={p}>
                    {displayName(b)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748b]">
                    <span className="num">{fmtDateTime(b.createdAt)}</span>
                    {typeof b.size === "number" ? <span className="num">· {fmtBytes(b.size)}</span> : null}
                    {k ? <OgPill tone={k.tone}>{k.label}</OgPill> : null}
                  </p>
                </div>
                <OgButton
                  size="sm"
                  loading={downloading === p}
                  disabled={!!downloading && downloading !== p}
                  onClick={() => download(b)}
                  aria-label={`Tải về ${displayName(b)}`}
                >
                  ↓ Tải về
                </OgButton>
              </li>
            );
          })}
        </ul>
      )}
    </OgCard>
  );
}
