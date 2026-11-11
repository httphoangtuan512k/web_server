"use client";

import { ClipboardList, Cog, FileSpreadsheet, Hourglass, Plus, RefreshCw, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { todayKey } from "@/lib/format";
import { PageGuard } from "@/components/shell/page-guard";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui/card";
import { Input, SearchInput } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ImageViewer } from "./image-viewer";
import { RecordCard } from "./record-card";
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

  return (
    <>
      <PageHeader
        title="Bảo trì – Bảo dưỡng"
        description="Ghi nhận sự cố, nội dung sửa chữa và tra cứu hồ sơ bảo trì theo tháng"
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} loading={exporting} onClick={exportExcel} disabled={!month} title={month ? undefined : "Chọn tháng để xuất"}>
              Xuất Excel
            </Button>
            <Button icon={Plus} onClick={() => setForm(null)}>
              Ghi nhận mới
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Bản ghi" value={stats.total} hint={month ? `Tháng ${monthLabel(month)}` : "Tất cả"} icon={ClipboardList} />
        <StatCard label="Thiết bị" value={stats.equipment} hint="Có sự cố" icon={Cog} tone="accent" />
        <StatCard label="Chờ sửa chữa" value={stats.pending} hint="Chưa có nội dung sửa" icon={Hourglass} tone={stats.pending ? "warning" : "success"} />
      </div>

      <Card className="mb-5 flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-2">
          <Input type="month" aria-label="Tháng" value={month} onChange={(e) => changeMonth(e.target.value)} className="w-[170px]" />
          {month ? (
            <Button variant="ghost" size="sm" onClick={() => changeMonth("")}>
              Tất cả tháng
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => changeMonth(todayKey().slice(0, 7))}>
              Tháng này
            </Button>
          )}
        </div>
        <SearchInput
          placeholder="Tìm thiết bị, hư hỏng, người nhập…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          className="min-w-[200px] flex-1"
        />
        <Button variant="secondary" size="icon" icon={RefreshCw} aria-label="Tải lại" onClick={reload} />
      </Card>

      {!data ? (
        error ? (
          <Card className="p-6 text-center text-sm text-danger-600">{error}</Card>
        ) : (
          <Spinner />
        )
      ) : !filtered.length ? (
        <Card>
          <EmptyState
            icon={Wrench}
            title={!records.length ? "Chưa có dữ liệu bảo trì." : q ? "Không có bản ghi phù hợp." : "Tháng này chưa có dữ liệu bảo trì."}
            action={
              <Button icon={Plus} onClick={() => setForm(null)}>
                Ghi nhận mới
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 2xl:grid-cols-2">
            {filtered.slice(0, limit).map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                canManage={isSuper}
                onOpenImage={(src, alt) => setImage({ src, alt })}
                onEdit={() => setForm(r)}
                onDelete={() => remove(r)}
              />
            ))}
          </div>
          {filtered.length > limit ? (
            <div className="mt-5 text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Xem thêm ({filtered.length - limit} bản ghi)
              </Button>
            </div>
          ) : null}
        </>
      )}

      {!isSuper && data ? <p className="mt-6 text-center text-xs text-subtle">Chỉ Super Admin mới được sửa hoặc xóa dữ liệu đã lưu.</p> : null}

      {form !== undefined ? <RecordFormModal record={form} onClose={() => setForm(undefined)} onSaved={reload} /> : null}
      <ImageViewer image={image} onClose={() => setImage(null)} />
    </>
  );
}
