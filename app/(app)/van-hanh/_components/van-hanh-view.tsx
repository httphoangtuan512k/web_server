"use client";
/**
 * File này: trang Xưởng vận hành – 2 sơ đồ máy nghiền, bảng đơn đang chạy, hàng chờ, nhật ký.
 * Tự tải PLC mỗi 1 giây, đơn hàng mỗi 30 giây; xử lý mọi nút thao tác đơn.
 */

import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar, TopbarLink } from "@/components/shell/page-topbar";
import { usePolling } from "../_shared/hooks";
import { machineIdFromName, MILLS, plcNumber } from "../_shared/plc";
import { EditOrderModal } from "./edit-order-modal";
import { HistoryLogCard } from "./history-log";
import { MachineDialog, type MachineDialogRequest } from "./machine-dialog";
import { MillCard } from "./mill-card";
import { QueueTable, type QueueHandlers } from "./queue-table";
import { RunningTable, type OrderHandlers } from "./running-table";
import { computeScada } from "./scada";
import type { HistoryLog, OperatorPerms, Order, OrdersResponse, PlcLatestResponse, PlcMachineId, PlcPatchStateResponse, PlcStateKey } from "./types";

/** Chu kỳ làm mới: sơ đồ PLC 1 giây (như trang cũ), danh sách đơn 30 giây. */
const PLC_INTERVAL = 1000;
const ORDERS_INTERVAL = 30_000;
const NO_PERMISSION = "Tài khoản chưa được cấp quyền vận hành máy.";

/** Trang /van-hanh: kiểm tra quyền xem trang rồi hiện nội dung. */
export function VanHanhPage() {
  return (
    <PageGuard page="vanhanh">
      <VanHanhView />
    </PageGuard>
  );
}

/** Nội dung trang: tải dữ liệu, tính quyền, xử lý thao tác và vẽ giao diện. */
function VanHanhView() {
  const { me, canOrder } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  // Dữ liệu tải từ server (đơn hàng, nhật ký, PLC) và lỗi tương ứng.
  const [ordersResp, setOrdersResp] = useState<OrdersResponse | null>(null);
  const [ordersError, setOrdersError] = useState("");
  const [logs, setLogs] = useState<HistoryLog[] | null>(null);
  const [logsError, setLogsError] = useState("");
  const [latest, setLatest] = useState<PlcLatestResponse | null>(null);
  const [plcError, setPlcError] = useState("");

  // Hộp thoại đang mở: sửa đơn, xem ảnh, chọn máy; nút Làm mới đang quay.
  const [editing, setEditing] = useState<Order | null>(null);
  const [imageOf, setImageOf] = useState<Order | null>(null);
  const [machineReq, setMachineReq] = useState<MachineDialogRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ---------- Tải dữ liệu ----------
  // Tải danh sách đơn rồi tải nhật ký.
  const loadOrders = useCallback(async () => {
    try {
      setOrdersResp(await api.get<OrdersResponse>("/api/orders"));
      setOrdersError("");
    } catch (e) {
      setOrdersError(errorMessage(e));
    }
    // Lịch sử tách riêng: lỗi lịch sử không ảnh hưởng danh sách đơn.
    try {
      setLogs(await api.get<HistoryLog[]>("/api/history"));
      setLogsError("");
    } catch (e) {
      setLogsError(errorMessage(e));
    }
  }, []);

  // Tải dữ liệu PLC mới nhất.
  const refreshPlc = useCallback(async () => {
    try {
      setLatest(await api.get<PlcLatestResponse>("/api/plc/latest"));
      setPlcError("");
    } catch (e) {
      setPlcError(errorMessage(e));
    }
  }, []);

  // Tự làm mới: PLC mỗi 1 giây, đơn hàng mỗi 30 giây.
  usePolling(refreshPlc, PLC_INTERVAL);
  usePolling(loadOrders, ORDERS_INTERVAL);

  // Nút "Làm mới": tải lại cả đơn và PLC cùng lúc.
  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([loadOrders(), refreshPlc()]);
    setRefreshing(false);
  }

  // ---------- Quyền ----------
  // Ưu tiên quyền server trả về; chưa tải thì dùng quyền của tài khoản.
  const isSuper = !!me?.isSuper;
  const perms: OperatorPerms = {
    canOperate: ordersResp ? ordersResp.canOperate || ordersResp.isSuper || isSuper : canOrder("vanhanh"),
    canConfirm: ordersResp ? ordersResp.canConfirm || ordersResp.isSuper || isSuper : canOrder("xacnhan"),
    canPlc: canOrder("vanhanh") || canOrder("all"),
    isSuper,
  };

  // ---------- Phân loại đơn ----------
  // Chia đơn: đang chạy / tạm dừng / mới chờ chạy.
  const { running, paused, waiting } = useMemo(() => {
    const all = ordersResp?.orders ?? [];
    return {
      running: all.filter((o) => o.status === "running" && !o.isPaused),
      paused: all.filter((o) => o.status === "running" && o.isPaused),
      waiting: all.filter((o) => o.status === "new"),
    };
  }, [ordersResp]);
  // Gợi ý tên máy cho hộp chọn máy (tối đa 12, không trùng).
  const machineSuggestions = useMemo(
    () => Array.from(new Set((ordersResp?.orders ?? []).map((o) => o.machineName?.trim() || "").filter(Boolean))).slice(0, 12),
    [ordersResp],
  );

  // Tính số liệu sơ đồ cho từng máy và đếm số máy đang nghiền.
  const views = MILLS.map((cfg) => ({ cfg, view: computeScada(cfg, latest, plcError) }));
  const millsRunning = views.filter((v) => v.view.run === "running").length;

  // ---------- PLC: lưu phễu / silo / hệ số ----------
  async function saveSetting(machine: PlcMachineId, key: PlcStateKey, raw: string): Promise<boolean> {
    // Kiểm tra quyền và số hợp lệ trước khi lưu.
    if (!perms.canPlc) {
      toast.error(NO_PERMISSION);
      return false;
    }
    const n = plcNumber(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Vui lòng nhập số hợp lệ lớn hơn hoặc bằng 0.");
      return false;
    }
    // Gửi lên server, cập nhật ngay số mới vào sơ đồ.
    try {
      const res = await api.patch<PlcPatchStateResponse>(`/api/plc/operation-state/${machine}`, { key, value: n });
      setLatest((prev) => (prev ? { ...prev, operation_state: { ...prev.operation_state, [machine]: res.operation_state } } : prev));
      return true;
    } catch (e) {
      toast.error(`Không lưu được dữ liệu lên Server: ${errorMessage(e)}`);
      return false;
    }
  }

  // ---------- Thao tác đơn ----------
  // Chạy một thao tác: thành công → báo xanh + tải lại đơn; lỗi → báo đỏ.
  async function act(fn: () => Promise<unknown>, success: string, rethrow = false) {
    try {
      await fn();
      toast.success(success);
      await loadOrders();
    } catch (e) {
      toast.error(errorMessage(e));
      if (rethrow) throw e;
    }
  }

  // Xử lý nút trên bảng Đơn đang chạy.
  const orderHandlers: OrderHandlers = {
    onImage: setImageOf,
    onEdit: setEditing,
    // Sửa ô số (vd "Đã chạy") ngay trong bảng.
    async onUpdateNum(o, field, raw) {
      if (field === "runOnMachine" && !perms.canOperate) {
        toast.error(NO_PERMISSION);
        return false;
      }
      const n = Number(String(raw).trim().replace(",", "."));
      if (!String(raw).trim() || !Number.isFinite(n)) {
        toast.error("Vui lòng nhập số hợp lệ.");
        return false;
      }
      try {
        await api.patch(`/api/orders/${o.id}`, { [field]: n });
        await loadOrders();
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        await loadOrders();
        return false;
      }
    },
    // Tạm dừng: hỏi xác nhận rồi gọi API.
    async onPause(o) {
      if (!perms.canOperate) return toast.error(NO_PERMISSION);
      const ok = await confirm({
        title: "Tạm dừng máy?",
        message: (
          <>
            Đơn <b className="text-fg">{o.orderNumber}</b> trên <b className="text-fg">{o.machineName || "máy hiện tại"}</b> sẽ được chuyển về Kế hoạch (Tạm dừng).
          </>
        ),
        confirmText: "Tạm dừng",
        danger: true,
      });
      if (ok) await act(() => api.post(`/api/orders/${o.id}/operations/pause`, {}), "Đã tạm dừng đơn hàng.");
    },
    // Chạy thêm máy: mở hộp chọn máy mới.
    onSplit(o) {
      if (!perms.canOperate) return toast.error(NO_PERMISSION);
      setMachineReq({
        title: "Chạy thêm máy",
        description: `Tạo thêm một dòng chạy cho đơn ${o.orderNumber} trên máy mới.`,
        label: "Tên/mã máy mới muốn chạy thêm",
        confirmText: "Chạy thêm",
        emptyError: "Vui lòng nhập tên máy!",
        run: (machineName) => act(() => api.post(`/api/orders/${o.id}/split`, { machineName }), `Đã tạo dòng chạy thêm cho máy ${machineName}`, true),
      });
    },
    // Xác nhận hoàn thành: hỏi xác nhận rồi gọi API.
    async onComplete(o) {
      if (!perms.canConfirm) return toast.error("Bạn chưa được cấp quyền xác nhận hoàn thành.");
      const ok = await confirm({
        title: "Xác nhận hoàn thành đơn hàng?",
        message: (
          <>
            Đơn <b className="text-fg">{o.orderNumber}</b> (tất cả các máy đang chạy đơn này) sẽ được chốt hoàn thành. Có thể xác nhận kể cả khi sản lượng chưa đủ.
          </>
        ),
        confirmText: "Xác nhận hoàn thành",
        danger: true,
      });
      if (ok) await act(() => api.put(`/api/orders/${o.id}/operations/complete`, {}), "Đã xác nhận hoàn thành.");
    },
  };

  // Xử lý nút trên bảng Hàng chờ.
  const queueHandlers: QueueHandlers = {
    onEdit: setEditing,
    onComplete: orderHandlers.onComplete,
    // Bắt đầu chạy: mở hộp chọn máy.
    onStart(o) {
      if (!perms.canOperate) return toast.error(NO_PERMISSION);
      setMachineReq({
        title: "Bắt đầu chạy",
        description: `Chọn máy chạy đơn ${o.orderNumber}.`,
        label: "Tên máy bắt đầu chạy",
        confirmText: "Bắt đầu chạy",
        emptyError: "Vui lòng chọn tên máy.",
        run: (machineName) => act(() => api.post(`/api/orders/${o.id}/operations/start`, { machineName }), "Đã ghi nhận bắt đầu chạy.", true),
      });
    },
    // Chạy tiếp: mở hộp chọn máy, điền sẵn máy cũ.
    onResume(o) {
      if (!perms.canOperate) return toast.error(NO_PERMISSION);
      setMachineReq({
        title: "Chạy tiếp",
        description: `Đơn ${o.orderNumber} đang tạm dừng. Chọn máy tiếp tục chạy.`,
        label: "Tên máy tiếp tục chạy",
        confirmText: "Chạy tiếp",
        emptyError: "Vui lòng nhập tên máy tiếp tục chạy.",
        initial: o.machineName ?? "",
        run: (machineName) => act(() => api.post(`/api/orders/${o.id}/operations/resume`, { machineName }), "Đã tiếp tục chạy máy.", true),
      });
    },
  };

  // Màu và chữ cho viên trạng thái PLC ở hàng tóm tắt.
  const plcLoaded = !!latest || !!plcError;
  const plcTone = !plcLoaded ? "bg-[#94a3b8]" : plcError ? "bg-[#d97706]" : latest?.connected ? "bg-[#16a34a]" : "bg-[#dc2626]";
  const plcText = !plcLoaded ? "Đang kiểm tra PLC" : plcError ? "Lỗi tải dữ liệu PLC" : latest?.connected ? "PLC Online" : "PLC Offline";

  return (
    // Nền xám xanh toàn trang.
    <div className="min-h-dvh bg-[#f0f4f8]">
      {/* Thanh tiêu đề xanh navy + nút "📊 Dữ liệu PLC" */}
      <PageTopbar
        title="Xưởng Vận Hành"
        color="#1e3a8a"
        className="[&>div:first-child]:basis-40"
        actions={
          <TopbarLink href="/plc" className="border-transparent! bg-[#0f766e]! hover:bg-[#0d6a63]! hover:text-white!">
            📊 Dữ liệu PLC
          </TopbarLink>
        }
      />

      {/* Thân trang: các khối xếp dọc */}
      <PageBody className="flex flex-col gap-3 sm:gap-4">
        {/* Hai máy nghiền: xếp chồng như bản gốc, đặt cạnh nhau trên màn hình rộng */}
        <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
          {views.map(({ cfg, view }) => (
            <MillCard
              key={cfg.machine}
              cfg={cfg}
              view={view}
              orders={running.filter((o) => machineIdFromName(o.machineName) === cfg.machine)}
              canEdit={perms.canPlc}
              onSave={(key, raw) => saveSetting(cfg.machine, key, raw)}
            />
          ))}
        </div>

        {/* Đơn đang chạy – bảng như bản gốc */}
        <RunningTable orders={running} perms={perms} handlers={orderHandlers} loading={!ordersResp} error={ordersResp ? "" : ordersError} />
        {/* Lỗi khi tải lại (vẫn giữ bảng cũ) */}
        {ordersResp && ordersError ? <p className="-mt-1 text-[13px] text-[#dc2626]">Lỗi tải lại danh sách đơn: {ordersError}</p> : null}

        {/* Phần bổ sung (không có ở bản gốc): tóm tắt, hàng chờ, nhật ký */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          {/* Viên trạng thái PLC */}
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#dbe3ed] bg-white px-3 font-semibold text-[#334155]" title={latest?.received_at ? `Nhận dữ liệu cuối: ${latest.received_at}` : undefined}>
            <span className={cn("h-2 w-2 rounded-full", plcTone)} />
            {plcText}
          </span>
          {/* Các chip số liệu tóm tắt */}
          <Chip label="Đơn đang chạy" value={ordersResp ? running.length : "—"} />
          <Chip label="Máy nghiền chạy" value={latest ? `${millsRunning}/${MILLS.length}` : "—"} />
          <Chip label="Tạm dừng" value={ordersResp ? paused.length : "—"} />
          <Chip label="Chờ chạy" value={ordersResp ? waiting.length : "—"} />
          {/* Nút Làm mới (biểu tượng quay khi đang tải) */}
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 font-semibold text-[#1e3a8a] transition hover:border-[#1e3a8a] disabled:opacity-60"
          >
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
            Làm mới
          </button>
        </div>

        {/* Hàng chờ: đơn tạm dừng / chờ chạy */}
        {ordersResp ? <QueueTable paused={paused} waiting={waiting} perms={perms} handlers={queueHandlers} /> : null}

        {/* Nhật ký vận hành */}
        <HistoryLogCard logs={logs} error={logsError} />
      </PageBody>

      {/* Các hộp thoại: chọn máy, sửa đơn, xem ảnh đơn */}
      <MachineDialog request={machineReq} suggestions={machineSuggestions} onClose={() => setMachineReq(null)} />
      <EditOrderModal order={editing} onClose={() => setEditing(null)} onSaved={() => void loadOrders()} />
      <Modal open={!!imageOf} onClose={() => setImageOf(null)} size="lg" title={imageOf ? `Ảnh đơn ${imageOf.orderNumber}` : ""}>
        {/* Ảnh đơn + liên kết mở ảnh ở tab mới */}
        {imageOf?.imageData ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageOf.imageData} alt={`Ảnh đơn ${imageOf.orderNumber}`} className="max-h-[70dvh] w-auto rounded-lg bg-surface-3 object-contain" />
            <a href={imageOf.imageData} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-brand-600 hover:underline">
              <ExternalLink size={14} /> Mở ảnh trong tab mới
            </a>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** Chip nhỏ bo tròn: nhãn + số đậm (vd "Tạm dừng 3"). */
function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#dbe3ed] bg-white px-3 text-[#64748b]">
      {label}
      <b className="num text-[#0f172a]">{value}</b>
    </span>
  );
}
