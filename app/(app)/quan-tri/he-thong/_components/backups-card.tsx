"use client";
// File này: thẻ "Sao lưu dữ liệu" – xem danh sách bản sao lưu, tạo mới, tải về.
// Dùng ở: trang Hệ thống (chỉ Super Admin).

import { Archive } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtBytes, fmtDateTime, fmtRelative } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgCard, OgCardTitle, OgEmptyBox, OgPill } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import type { BackupCreateResponse, BackupItem, BackupListResponse } from "./types";

// Nhãn và màu cho từng loại bản sao lưu.
const KIND: Record<string, { label: string; tone: "default" | "ok" | "muted" }> = {
  daily: { label: "Hằng ngày", tone: "ok" },
  manual: { label: "Thủ công", tone: "default" },
  startup: { label: "Khởi động", tone: "muted" },
  cron: { label: "Tự động", tone: "ok" },
};

/** Tên dạng 'YYYY-MM-DD_<loại>_HHMMSS' → loại. */
function kindOf(name: string) {
  // Dò loại trong tên file; không thấy thì trả rỗng.
  const m = /_(daily|manual|startup|cron)[_.-]/i.exec(name) || /^(daily|manual|startup|cron)/i.exec(name.split("/").pop() || "");
  return m ? m[1].toLowerCase() : "";
}
// Đường dẫn file để tải về, và tên ngắn để hiển thị.
const pathOf = (b: BackupItem) => b.pathname || b.path || b.name;
const displayName = (b: BackupItem) => (b.name || pathOf(b)).split("/").pop() || b.name;

/** Sao lưu dữ liệu (chức năng mới, không có ở trang cũ) – GET/POST /api/superadmin/backups. */
export function BackupsCard() {
  const toast = useToast();
  const confirm = useConfirm();
  // Tải danh sách bản sao lưu.
  const { data, error, loading, reload } = useApiData<BackupListResponse | BackupItem[]>("/api/superadmin/backups");
  // Đang tạo bản sao lưu; file đang tải về.
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState("");

  // Chấp nhận cả 2 dạng trả về: mảng hoặc { rows }.
  const rows = useMemo<BackupItem[] | null>(() => (data ? (Array.isArray(data) ? data : data.rows ?? []) : null), [data]);

  // Nút "Làm mới": tải lại, lỗi thì báo.
  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  // "Sao lưu ngay": hỏi xác nhận, gọi máy chủ tạo bản mới, tải lại.
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

  // Tải một bản sao lưu về máy.
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

  // Bản mới nhất (đứng đầu danh sách).
  const latest = rows?.[0];

  return (
    <OgCard>
      {/* Tiêu đề + thống kê + nút Làm mới / Sao lưu ngay */}
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

      {/* Lỗi / đang tải / trống / danh sách bản sao lưu */}
      {error && !rows ? (
        <OgEmptyBox tone="error">{error}</OgEmptyBox>
      ) : !rows ? (
        <OgEmptyBox>Đang tải...</OgEmptyBox>
      ) : !rows.length ? (
        <OgEmptyBox>Chưa có bản sao lưu nào. Bấm “Sao lưu ngay” để tạo bản đầu tiên.</OgEmptyBox>
      ) : (
        <ul className="max-h-[440px] divide-y divide-[#edf0f4] overflow-y-auto rounded-lg border border-[#e2e8f0]">
          {rows.map((b) => {
            // Loại và đường dẫn của bản này.
            const k = KIND[kindOf(b.name)];
            const p = pathOf(b);
            return (
              <li key={p} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#f8fafc] sm:px-4">
                {/* Biểu tượng hộp lưu trữ (ẩn trên màn hình rất hẹp) */}
                <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf1f6] text-[#244d68] min-[420px]:grid">
                  <Archive size={16} />
                </span>
                {/* Tên file; dưới là thời gian, dung lượng, loại */}
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
                {/* Nút tải về (khóa các nút khác khi đang tải một file) */}
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
