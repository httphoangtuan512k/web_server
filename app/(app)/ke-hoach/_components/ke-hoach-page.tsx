"use client";
/**
 * File này: toàn bộ trang Kế hoạch sản xuất – thống kê, lọc, danh sách đơn, các hộp thoại.
 * Dùng ở: /ke-hoach. Màu dòng: trắng = chưa chạy, vàng = đang chạy/tạm dừng, xanh lá = đã xong.
 */

import { AlertCircle, ClipboardList, History, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtTime, todayKey } from "@/lib/format";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar, TopbarButton } from "@/components/shell/page-topbar";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { HistoryModal } from "./history-modal";
import { ImageViewer } from "./image-viewer";
import { useOrderOperations, type OrderActionKind } from "./order-actions";
import { BTN_PRIMARY, BTN_SECONDARY } from "./order-bits";
import { OrderDetailModal } from "./order-detail-modal";
import { EMPTY_FILTERS, OrderToolbar, StatusTabs, type Filters } from "./order-filters";
import { OrderFormModal } from "./order-form-modal";
import { OrderList } from "./order-list";
import type { Order, OrderGroup, OrderPerms, StatusFilter } from "./types";
import { useOrders } from "./use-orders";
import { fmtTons, groupOrders, isArchived, monthKey, sortGroups, statusKey, toNum } from "./utils";

/** Trang Kế hoạch: chỉ người có quyền "kehoach" mới vào được. */
export function KeHoachPage() {
  return (
    <PageGuard page="kehoach">
      <KeHoach />
    </PageGuard>
  );
}

/** Nội dung trang Kế hoạch (danh sách đơn, lọc, thống kê, các hộp thoại). */
function KeHoach() {
  // Người dùng + quyền, thông báo, dữ liệu đơn (tự làm mới 30 giây).
  const { me, isAdmin, canOrder } = useAuth();
  const toast = useToast();
  const { data, error, loadedAt, refreshing, reload } = useOrders();

  // State: bộ lọc, đơn đang xem chi tiết, form tạo/sửa, ảnh đang xem, hộp lịch sử, đang xuất Excel.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [form, setForm] = useState<{ order: Order | null } | null>(null);
  const [image, setImage] = useState<{ src: string; title: string } | null>(null);
  const [history, setHistory] = useState<{ query: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Tải lỗi → hiện thông báo đỏ.
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

  // Gộp đơn theo nhóm; danh sách tháng có đơn; tháng đang chọn (nếu không còn thì "tất cả").
  const allGroups = useMemo(() => groupOrders(orders), [orders]);
  const months = useMemo(() => [...new Set(orders.map((o) => monthKey(o.createdAt)).filter(Boolean))].sort().reverse(), [orders]);
  const month = filters.month === "all" || months.includes(filters.month) ? filters.month : "all";
  // Gợi ý tên máy từ các đơn đã có.
  const machineSuggestions = useMemo(
    () => [...new Set(orders.map((o) => o.machineName?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
    [orders],
  );

  /** Lọc như trang cũ: tìm mã bao bì/số đơn (khi tìm → cả đơn lưu trữ), tháng tạo, hoạt động/lưu trữ; rồi gộp nhóm. */
  const visible = useMemo(() => {
    const q = filters.packaging.trim().toLowerCase();
    const oq = filters.orderNumber.trim().toLowerCase();
    const searching = !!(q || oq);
    // Lọc từng dòng: mã bao bì, số đơn, tháng, rồi đang hoạt động / lưu trữ.
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
    // Gộp nhóm rồi sắp xếp ưu tiên.
    return sortGroups(groupOrders(rows));
  }, [orders, filters.packaging, filters.orderNumber, filters.view, month, loadedAt]);

  // Đếm số đơn theo trạng thái (cho tab).
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: visible.length, new: 0, running: 0, paused: 0, completed: 0 };
    for (const g of visible) c[statusKey(g)]++;
    return c;
  }, [visible]);

  // Danh sách hiển thị sau khi lọc theo tab trạng thái.
  const shown = useMemo(() => (filters.status === "all" ? visible : visible.filter((g) => statusKey(g) === filters.status)), [visible, filters.status]);

  // Cộng tổng tấn: kế hoạch, đã sản xuất, còn lại (đang chạy), đã xong.
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

  // Các thao tác chạy/dừng/xác nhận/xóa + hộp hỏi tên máy.
  const { perform, pending, dialog } = useOrderOperations({ reload, machineSuggestions });

  // Nhóm đơn đang mở chi tiết.
  const detail = detailKey ? (allGroups.find((g) => g.key === detailKey) ?? null) : null;

  /** Xử lý bấm nút trên đơn: Xem → mở chi tiết; Sửa → mở form; còn lại → gọi thao tác. */
  function onAction(kind: OrderActionKind, g: OrderGroup) {
    if (kind === "view") return setDetailKey(g.key);
    if (kind === "edit") return setForm({ order: g.rows[0] ?? g });
    // Xóa xong đơn đang mở chi tiết → đóng hộp chi tiết.
    perform(kind, g).then((done) => {
      if (done && kind === "delete" && g.rows.length <= 1 && detailKey === g.key) setDetailKey(null);
    });
  }

  /** Bấm "↓ Xuất Excel": tải file Excel theo bộ lọc hiện tại. */
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

  // Đang tải lần đầu; hàm mở hộp lịch sử.
  const loading = !data && !error;
  const openHistory = () => setHistory({ query: "" });

  return (
    // Nền xám xanh nhạt toàn trang.
    <div className="min-h-dvh bg-[#eef2f6] text-[#202832]">
      {/* Thanh tiêu đề navy "Kế hoạch sản xuất": giờ cập nhật; nút Làm mới, Lịch sử, In (chỉ màn hình lớn). */}
      <PageTopbar
        title="Kế hoạch sản xuất"
        color="#173e66"
        subtitle={
          loadedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", error ? "bg-red-400" : "bg-emerald-400")} />
              Cập nhật {fmtTime(loadedAt)}
              <span className="hidden sm:inline">· tự làm mới mỗi 30 giây</span>
            </span>
          ) : undefined
        }
        actions={
          <span className="hidden sm:contents">
            <TopbarButton onClick={reload} disabled={refreshing} title="Làm mới" aria-label="Làm mới">
              <RefreshCw size={15} className={cn(refreshing && "animate-spin")} />
            </TopbarButton>
            <TopbarButton onClick={openHistory} title="Lịch sử thao tác">
              <History size={15} />
              Lịch sử
            </TopbarButton>
            <TopbarButton onClick={() => window.print()} title="In danh sách">
              <Printer size={15} />
              In
            </TopbarButton>
          </span>
        }
      />

      <PageBody className="print:p-0">
        {/* Tiêu đề chỉ hiện khi in. */}
        <div className="mb-4 hidden print:block">
          <h1 className="text-xl font-semibold">Kế hoạch sản xuất – SUPER WHITE</h1>
          <p className="text-sm">
            In lúc {fmtDateTime(loadedAt || undefined)} · {shown.length} đơn
          </p>
        </div>

        {/* 4 ô thống kê, vạch màu bên trái: tổng / mới tạo (trắng) / đang chạy (vàng) / đã chạy (xanh lá). */}
        <section className="no-print mb-3 grid grid-cols-2 gap-2.5 sm:mb-4 md:grid-cols-4 md:gap-3">
          <Stat label="Tổng đơn đang hiển thị" value={counts.all} loading={loading} accent="bg-[#173e66]" hint={`Kế hoạch ${fmtTons(totals.planned)} tấn`} />
          <Stat label="Đơn mới tạo" value={counts.new} loading={loading} accent="bg-white ring-1 ring-inset ring-[#9ba8b4]" hint="Chưa chạy máy" />
          <Stat
            label="Đơn đang chạy"
            value={counts.running + counts.paused}
            loading={loading}
            accent="bg-[#ffd23f]"
            hint={`${counts.paused} tạm dừng · còn ${fmtTons(totals.remaining)} tấn`}
          />
          <Stat label="Đã chạy" value={counts.completed} loading={loading} accent="bg-[#70ca7a]" hint={`Sản lượng ${fmtTons(totals.doneTons)} tấn`} />
        </section>

        {/* Thanh công cụ lọc; điện thoại có thêm 3 nút icon: lịch sử, in, làm mới. */}
        <OrderToolbar
          value={{ ...filters, month }}
          onChange={setFilters}
          months={months}
          canCreate={perms.create}
          onCreate={() => setForm({ order: null })}
          onExport={exportExcel}
          exporting={exporting}
          extra={
            <span className="contents sm:hidden">
              {[
                { label: "Lịch sử thao tác", icon: History, onClick: openHistory },
                { label: "In danh sách", icon: Printer, onClick: () => window.print() },
                { label: "Làm mới", icon: RefreshCw, onClick: reload, spin: refreshing },
              ].map(({ label, icon: Icon, onClick, spin }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  disabled={spin}
                  aria-label={label}
                  title={label}
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border border-[#c3cdd6] bg-white text-[#334155] transition hover:bg-[#eef2f6] active:scale-95 disabled:opacity-60"
                >
                  <Icon size={16} className={cn(spin && "animate-spin")} />
                </button>
              ))}
            </span>
          }
        />

        {/* Khung trắng chứa tab trạng thái + danh sách đơn. */}
        <section className="overflow-hidden rounded-xl border border-[#c3cdd6] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] print:rounded-none print:border-0 print:shadow-none">
          {data ? <StatusTabs value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} counts={counts} /> : null}
          {/* Đang tải → khối xám; lỗi → "Thử lại"; không có đơn → "Xóa lọc" / "+ Tạo đơn"; có → danh sách. */}
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
                <button type="button" onClick={reload} disabled={refreshing} className={BTN_SECONDARY}>
                  <RefreshCw size={15} className={cn(refreshing && "animate-spin")} />
                  Thử lại
                </button>
              }
            />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Không có đơn hàng nào phù hợp."
              description={orders.length ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm." : "Chưa có đơn hàng nào trong hệ thống."}
              action={
                orders.length ? (
                  <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={BTN_SECONDARY}>
                    Xóa lọc
                  </button>
                ) : perms.create ? (
                  <button type="button" onClick={() => setForm({ order: null })} className={BTN_PRIMARY}>
                    + Tạo đơn
                  </button>
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
        </section>
      </PageBody>

      {/* Các hộp thoại, chỉ hiện khi được mở: chi tiết, tạo/sửa, lịch sử, xem ảnh, hỏi tên máy. */}
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
    </div>
  );
}

/** Ô thống kê như trang cũ (nhãn nhỏ + số lớn), dạng thẻ hiện đại; vạch màu = màu dòng tương ứng. */
function Stat({ label, value, hint, accent, loading }: { label: string; value: number; hint?: string; accent: string; loading?: boolean }) {
  return (
    // Thẻ trắng; vạch màu dọc bên trái; nhãn nhỏ, số lớn (khối xám khi đang tải), dòng phụ.
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-[#d3dbe3] bg-white px-3.5 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] sm:px-4 sm:py-3.5">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", accent)} aria-hidden />
      <p className="text-xs leading-snug font-medium text-[#475767] sm:text-[13px]">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <p className="num mt-1 text-[24px] leading-tight font-bold text-[#202832] sm:text-[27px]">{value}</p>
      )}
      {hint && !loading ? <p className="mt-0.5 truncate text-[11px] text-[#64748b] sm:text-xs">{hint}</p> : null}
    </div>
  );
}
