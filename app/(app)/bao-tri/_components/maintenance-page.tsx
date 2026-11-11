"use client";

import { Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { todayKey } from "@/lib/format";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar } from "@/components/shell/page-topbar";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ImageViewer } from "./image-viewer";
import { btn, RecordList } from "./record-card";
import { RecordFormModal } from "./record-form-modal";
import type { MaintenanceRecord, MaintenanceResponse } from "./types";

const PAGE = 30;
/** Tháng (giờ VN) của một thời điểm: 'YYYY-MM'. */
const monthOf = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v || "").slice(0, 7) : todayKey(d).slice(0, 7);
};
const monthLabel = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${m.slice(5)}/${m.slice(0, 4)}` : m);

export function MaintenancePage() {
  return (
    <PageGuard page="baotri">
      <Maintenance />
    </PageGuard>
  );
}

function Maintenance() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<MaintenanceResponse | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [form, setForm] = useState<MaintenanceRecord | null | undefined>(undefined);
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(() => api.get<MaintenanceResponse>("/api/maintenance"), []);

  useEffect(() => {
    let alive = true;
    fetchData()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [fetchData]);

  const reload = useCallback(async () => {
    try {
      setData(await fetchData());
      setError("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [fetchData, toast]);

  const changeMonth = (m: string) => {
    setMonth(m);
    setLimit(PAGE);
  };

  const records = useMemo(() => data?.records || [], [data]);
  const isSuper = !!data?.isSuper;

  const monthRecords = useMemo(() => (month ? records.filter((r) => monthOf(r.created_at) === month) : records), [records, month]);
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return monthRecords;
    return monthRecords.filter((r) =>
      [r.equipment, r.fault_description, r.repair_content, r.after_status, r.created_by].join(" ").toLowerCase().includes(k),
    );
  }, [monthRecords, q]);

  const stats = useMemo(
    () => ({
      total: monthRecords.length,
      equipment: new Set(monthRecords.map((r) => r.equipment.trim().toLowerCase())).size,
      pending: monthRecords.filter((r) => !(r.repair_content || r.after_status).trim()).length,
    }),
    [monthRecords],
  );

  async function exportExcel() {
    if (!month) return toast.error("Vui lòng chọn tháng cần xuất.");
    setExporting(true);
    try {
      await api.download(`/api/maintenance/export?month=${encodeURIComponent(month)}`, `bao_tri_${month}.xlsx`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  async function remove(r: MaintenanceRecord) {
    if (!isSuper) return;
    const ok = await confirm({
      title: `Xóa bản ghi bảo trì #${r.id}?`,
      message: `${r.equipment} – ${r.fault_description.slice(0, 120)}`,
      danger: true,
      confirmText: "Xóa",
    });
    if (!ok) return;
    try {
      await api.delete(`/api/maintenance/${r.id}`);
      toast.success("Đã xóa bản ghi bảo trì.");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const emptyText = !data
    ? error || "Đang tải dữ liệu..."
    : !filtered.length
      ? !records.length
        ? "Chưa có dữ liệu bảo trì."
        : q
          ? "Không có bản ghi phù hợp."
          : "Tháng này chưa có dữ liệu bảo trì."
      : null;

  const chip = "inline-flex items-center gap-1 rounded-full border border-[#d5deea] bg-[#f8fafc] px-2.5 py-1 text-xs text-[#475569]";

  return (
    <div className="min-h-dvh bg-[#eef3f8] text-[#17243a]">
      <PageTopbar title="🛠 Bảo trì - Bảo dưỡng" color="#172b3a" />

      <PageBody>
        <section className="min-h-[300px] rounded-xl border border-[#d5deea] bg-white p-3.5 shadow-[0_3px_12px_#0f172a0b] sm:p-5">
          {/* Thanh công cụ: tiêu đề trái – nút gốc bên phải (Nhập dữ liệu · Tháng · Xuất Excel) */}
          <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3 sm:items-center">
            <div className="min-w-0">
              <h2 className="text-[19px] font-bold text-[#203f8e] sm:text-[21px]">Lịch sử bảo trì - bảo dưỡng</h2>
              <p className="mt-1 text-[13px] text-[#64748b]">Theo dõi và tra cứu hồ sơ bảo trì theo tháng.</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
              <button type="button" className={cn(btn.base, btn.primary)} onClick={() => setForm(null)}>
                ＋ Nhập dữ liệu
              </button>
              <label htmlFor="bt-month" className="ml-auto text-sm font-bold text-[#475569] sm:ml-0">
                Tháng
              </label>
              <input
                id="bt-month"
                type="month"
                value={month}
                onChange={(e) => changeMonth(e.target.value)}
                className="min-h-10 min-w-[165px] flex-1 rounded-[7px] border border-[#cbd5e1] bg-white px-2.5 py-2 text-[15px] outline-none focus:border-[#2454a6] focus:ring-2 focus:ring-[#2454a6]/20 sm:w-[185px] sm:flex-none"
              />
              <button
                type="button"
                className={cn(btn.base, btn.export)}
                onClick={exportExcel}
                disabled={exporting}
                title={month ? undefined : "Chọn tháng để xuất"}
              >
                {exporting ? <Loader2 size={15} className="animate-spin" /> : null}↓ Xuất Excel
              </button>
            </div>
          </div>

          {/* Tiện ích thêm (không có ở bản gốc): thống kê nhanh, tìm kiếm, xem mọi tháng, tải lại */}
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <span className={chip}>
              Bản ghi <b className="text-[#17243a]">{stats.total}</b>
            </span>
            <span className={chip}>
              Thiết bị <b className="text-[#17243a]">{stats.equipment}</b>
            </span>
            <span className={cn(chip, stats.pending && "border-[#fcd9a8] bg-[#fff7ed] text-[#9a3412]")}>
              Chờ sửa chữa <b>{stats.pending}</b>
            </span>
            <button
              type="button"
              onClick={() => changeMonth(month ? "" : todayKey().slice(0, 7))}
              className="px-1 text-xs font-bold text-[#2454a6] hover:underline"
            >
              {month ? "Xem tất cả tháng" : `Về tháng này (${monthLabel(todayKey().slice(0, 7))})`}
            </button>
            <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
              <label className="relative min-w-0 flex-1 sm:w-[280px] sm:flex-none">
                <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="search"
                  aria-label="Tìm kiếm"
                  placeholder="Tìm thiết bị, hư hỏng, người nhập..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setLimit(PAGE);
                  }}
                  className="min-h-9 w-full rounded-[7px] border border-[#cbd5e1] bg-white py-1.5 pr-2.5 pl-8 text-sm outline-none focus:border-[#2454a6] focus:ring-2 focus:ring-[#2454a6]/20"
                />
              </label>
              <button type="button" onClick={reload} aria-label="Tải lại" title="Tải lại" className={cn(btn.base, btn.secondary, "min-h-9 px-2.5")}>
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          <RecordList
            records={filtered.slice(0, limit)}
            canManage={isSuper}
            onOpenImage={(src, alt) => setImage({ src, alt })}
            onEdit={(r) => setForm(r)}
            onDelete={(r) => remove(r)}
            empty={emptyText ? <span className={!data && error ? "text-[#dc2626]" : undefined}>{emptyText}</span> : null}
          />

          {filtered.length > limit ? (
            <div className="mt-4 text-center">
              <button type="button" className={cn(btn.base, btn.secondary)} onClick={() => setLimit((l) => l + PAGE)}>
                Xem thêm ({filtered.length - limit} bản ghi)
              </button>
            </div>
          ) : null}

          {!isSuper && data ? <p className="mt-3 text-[13px] text-[#64748b]">Chỉ Super Admin mới được sửa hoặc xóa dữ liệu đã lưu.</p> : null}
        </section>
      </PageBody>

      {form !== undefined ? <RecordFormModal record={form} onClose={() => setForm(undefined)} onSaved={reload} /> : null}
      <ImageViewer image={image} onClose={() => setImage(null)} />
    </div>
  );
}
