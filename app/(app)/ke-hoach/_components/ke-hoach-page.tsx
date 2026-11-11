"use client";

import { AlertCircle, CheckCircle2, ClipboardList, Factory, FilePlus2, FileSpreadsheet, History, Layers, Plus, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtTime, todayKey } from "@/lib/format";
import { PageGuard } from "@/components/shell/page-guard";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Skeleton, StatCard } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { HistoryModal } from "./history-modal";
import { ImageViewer } from "./image-viewer";
import { useOrderOperations, type OrderActionKind } from "./order-actions";
import { OrderDetailModal } from "./order-detail-modal";
import { EMPTY_FILTERS, OrderFilters, type Filters } from "./order-filters";
import { OrderFormModal } from "./order-form-modal";
import { OrderList } from "./order-list";
import type { Order, OrderGroup, OrderPerms, StatusFilter } from "./types";
import { useOrders } from "./use-orders";
import { fmtTons, groupOrders, isArchived, monthKey, sortGroups, statusKey, toNum } from "./utils";

export function KeHoachPage() {
  return (
    <PageGuard page="kehoach">
      <KeHoach />
    </PageGuard>
  );
}

function KeHoach() {
  const { me, isAdmin, canOrder } = useAuth();
  const toast = useToast();
  const { data, error, loadedAt, refreshing, reload } = useOrders();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [form, setForm] = useState<{ order: Order | null } | null>(null);
  const [image, setImage] = useState<{ src: string; title: string } | null>(null);
  const [history, setHistory] = useState<{ query: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (error) toast.error(`Lỗi tải dữ liệu: ${error}`);
  }, [error, toast]);

  const orders = useMemo(() => data?.orders ?? [], [data]);

  /**
   * Quyền hiển thị nút = đúng quy tắc server (GET /api/orders trả canCreate/canOperate/canConfirm):
   *  - sửa dữ liệu gốc của đơn: chỉ Super Admin (server trả 403 với người khác);
   *  - xóa đơn: admin/super (requireAdmin).
   * Trước khi tải xong dùng quyền tạm từ /api/me.
   */
  const perms = useMemo<OrderPerms>(() => {
    const isSuper = !!me?.isSuper;
    return {
      create: data ? !!data.canCreate || isAdmin : canOrder("new"), // POST /api/orders cho cả role admin
      edit: isSuper,
      remove: isAdmin,
      operate: data ? !!data.canOperate : canOrder("vanhanh"),
      confirm: data ? !!data.canConfirm : canOrder("xacnhan"),
      isSuper,
    };
  }, [data, me, isAdmin, canOrder]);

  const allGroups = useMemo(() => groupOrders(orders), [orders]);
  const months = useMemo(() => [...new Set(orders.map((o) => monthKey(o.createdAt)).filter(Boolean))].sort().reverse(), [orders]);
  const month = filters.month === "all" || months.includes(filters.month) ? filters.month : "all";
  const machineSuggestions = useMemo(
    () => [...new Set(orders.map((o) => o.machineName?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
    [orders],
  );

  /** Lọc như trang cũ: tìm mã bao bì/số đơn (khi tìm → cả đơn lưu trữ), tháng tạo, hoạt động/lưu trữ; rồi gộp nhóm. */
  const visible = useMemo(() => {
    const q = filters.packaging.trim().toLowerCase();
    const oq = filters.orderNumber.trim().toLowerCase();
    const searching = !!(q || oq);
    const rows = orders.filter((o) => {
      if (
        q &&
        !String(o.packagingCode ?? "")
          .trim()
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (
        oq &&
        !String(o.orderNumber ?? "")
          .trim()
          .toLowerCase()
          .includes(oq)
      )
        return false;
      if (month !== "all" && monthKey(o.createdAt) !== month) return false;
      if (searching) return true;
      const archived = isArchived(o, loadedAt);
      return filters.view === "history" ? archived : !archived;
    });
    return sortGroups(groupOrders(rows));
  }, [orders, filters.packaging, filters.orderNumber, filters.view, month, loadedAt]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: visible.length, new: 0, running: 0, paused: 0, completed: 0 };
    for (const g of visible) c[statusKey(g)]++;
    return c;
  }, [visible]);

  const shown = useMemo(() => (filters.status === "all" ? visible : visible.filter((g) => statusKey(g) === filters.status)), [visible, filters.status]);

  const totals = useMemo(() => {
    let planned = 0;
    let produced = 0;
    let remaining = 0;
    let doneTons = 0;
    for (const g of visible) {
      planned += toNum(g.quantity);
      produced += toNum(g.actualProduced);
      if (g.status === "running") remaining += Math.max(0, toNum(g.quantity) - toNum(g.actualProduced));
      if (g.status === "completed") doneTons += toNum(g.actualProduced);
    }
    return { planned, produced, remaining, doneTons };
  }, [visible]);

  const { perform, pending, dialog } = useOrderOperations({ reload, machineSuggestions });

  const detail = detailKey ? (allGroups.find((g) => g.key === detailKey) ?? null) : null;

  function onAction(kind: OrderActionKind, g: OrderGroup) {
    if (kind === "view") return setDetailKey(g.key);
    if (kind === "edit") return setForm({ order: g.rows[0] ?? g });
    perform(kind, g).then((done) => {
      if (done && kind === "delete" && g.rows.length <= 1 && detailKey === g.key) setDetailKey(null);
    });
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        search: filters.packaging.trim(),
        orderNumber: filters.orderNumber.trim(),
        month,
        view: filters.view,
      });
      await api.download(`/api/orders/export?${params.toString()}`, `ke_hoach_${todayKey()}.xlsx`);
      toast.success("Đã xuất Excel kế hoạch.");
    } catch (e) {
      toast.error(errorMessage(e) || "Không thể xuất Excel");
    } finally {
      setExporting(false);
    }
  }

  const loading = !data && !error;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Kế hoạch sản xuất"
          description={
            <span className="inline-flex flex-wrap items-center gap-x-2">
              Tạo, theo dõi và xác nhận đơn hàng sản xuất.
              {loadedAt ? (
                <span className="inline-flex items-center gap-1 text-xs text-subtle">
                  <span className={cn("h-1.5 w-1.5 rounded-full", error ? "bg-danger-600" : "bg-success-600")} />
                  Cập nhật {fmtTime(loadedAt)} · tự làm mới mỗi 30 giây
                </span>
              ) : null}
            </span>
          }
          actions={
            <>
              <Button variant="ghost" size="icon" icon={RefreshCw} onClick={reload} loading={refreshing} aria-label="Làm mới" title="Làm mới" />
              <Button variant="secondary" icon={History} onClick={() => setHistory({ query: "" })} title="Lịch sử thao tác">
                <span className="hidden sm:inline">Lịch sử</span>
              </Button>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()} title="In danh sách">
                <span className="hidden sm:inline">In</span>
              </Button>
              <Button variant="secondary" icon={FileSpreadsheet} onClick={exportExcel} loading={exporting} title="Xuất Excel">
                <span className="hidden sm:inline">Xuất Excel</span>
              </Button>
              {perms.create ? (
                <Button icon={Plus} onClick={() => setForm({ order: null })}>
                  Tạo đơn
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      {/* Tiêu đề khi in */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-semibold">Kế hoạch sản xuất – SUPER WHITE</h1>
        <p className="text-sm">
          In lúc {fmtDateTime(loadedAt || undefined)} · {shown.length} đơn
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-[var(--radius-card)]" />)
        ) : (
          <>
            <StatCard label="Tổng đơn đang hiển thị" value={counts.all} icon={Layers} tone="accent" hint={`Kế hoạch ${fmtTons(totals.planned)} tấn`} />
            <StatCard label="Đơn mới tạo" value={counts.new} icon={FilePlus2} tone="brand" hint="Chờ chạy máy" />
            <StatCard
              label="Đơn đang chạy"
              value={counts.running + counts.paused}
              icon={Factory}
              tone="warning"
              hint={`${counts.paused} tạm dừng · còn ${fmtTons(totals.remaining)} tấn`}
            />
            <StatCard label="Đã hoàn thành" value={counts.completed} icon={CheckCircle2} tone="success" hint={`Sản lượng ${fmtTons(totals.doneTons)} tấn`} />
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="no-print">
          <OrderFilters value={{ ...filters, month }} onChange={setFilters} months={months} counts={counts} />
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data ? (
          <EmptyState
            icon={AlertCircle}
            title="Không tải được danh sách đơn hàng"
            description={error ?? undefined}
            action={
              <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={refreshing}>
                Thử lại
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Không có đơn hàng nào phù hợp."
            description={orders.length ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm." : "Chưa có đơn hàng nào trong hệ thống."}
            action={
              orders.length ? (
                <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Xóa lọc
                </Button>
              ) : perms.create ? (
                <Button icon={Plus} onClick={() => setForm({ order: null })}>
                  Tạo đơn
                </Button>
              ) : undefined
            }
          />
        ) : (
          <OrderList
            groups={shown}
            perms={perms}
            pending={pending}
            onOpen={(g) => setDetailKey(g.key)}
            onAction={onAction}
            onOpenImage={(src, title) => setImage({ src, title })}
          />
        )}
      </Card>

      {detail ? (
        <OrderDetailModal
          group={detail}
          perms={perms}
          version={loadedAt}
          pending={pending}
          onClose={() => setDetailKey(null)}
          onAction={onAction}
          onOpenImage={(src, title) => setImage({ src, title })}
          onOpenHistory={(query) => setHistory({ query })}
          onReload={reload}
        />
      ) : null}
      {form ? <OrderFormModal order={form.order} onClose={() => setForm(null)} onSaved={reload} /> : null}
      {history ? <HistoryModal initialQuery={history.query} isSuper={perms.isSuper} onClose={() => setHistory(null)} /> : null}
      {image ? <ImageViewer src={image.src} title={image.title} onClose={() => setImage(null)} /> : null}
      {dialog}
    </>
  );
}
