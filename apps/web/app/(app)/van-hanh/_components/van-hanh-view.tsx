"use client";

import { Cog, Cpu, ExternalLink, Factory, PauseCircle, PlayCircle, RefreshCw, Timer } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader, Skeleton, StatCard } from "@/components/ui/card";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageGuard } from "@/components/shell/page-guard";
import { usePolling } from "../_shared/hooks";
import { machineIdFromName, MILLS, plcNumber } from "../_shared/plc";
import { PlcConnectionPill } from "../_shared/status-light";
import { EditOrderModal } from "./edit-order-modal";
import { HistoryLogCard } from "./history-log";
import { MachineDialog, type MachineDialogRequest } from "./machine-dialog";
import { MillCard } from "./mill-card";
import type { OrderHandlers } from "./order-card";
import { QueueTable, type QueueHandlers } from "./queue-table";
import { RunningBoard } from "./running-board";
import { computeScada } from "./scada";
import type { HistoryLog, OperatorPerms, Order, OrdersResponse, PlcLatestResponse, PlcMachineId, PlcPatchStateResponse, PlcStateKey } from "./types";

/** Chu kỳ làm mới: sơ đồ PLC 1 giây (như trang cũ), danh sách đơn 30 giây. */
const PLC_INTERVAL = 1000;
const ORDERS_INTERVAL = 30_000;
const NO_PERMISSION = "Tài khoản chưa được cấp quyền vận hành máy.";

export function VanHanhPage() {
  return (
    <PageGuard page="vanhanh">
      <VanHanhView />
    </PageGuard>
  );
}

function VanHanhView() {
  const { me, canOrder } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [ordersResp, setOrdersResp] = useState<OrdersResponse | null>(null);
  const [ordersError, setOrdersError] = useState("");
  const [logs, setLogs] = useState<HistoryLog[] | null>(null);
  const [logsError, setLogsError] = useState("");
  const [latest, setLatest] = useState<PlcLatestResponse | null>(null);
  const [plcError, setPlcError] = useState("");

  const [editing, setEditing] = useState<Order | null>(null);
  const [imageOf, setImageOf] = useState<Order | null>(null);
  const [machineReq, setMachineReq] = useState<MachineDialogRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ---------- Tải dữ liệu ----------
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

  const refreshPlc = useCallback(async () => {
    try {
      setLatest(await api.get<PlcLatestResponse>("/api/plc/latest"));
      setPlcError("");
    } catch (e) {
      setPlcError(errorMessage(e));
    }
  }, []);

  usePolling(refreshPlc, PLC_INTERVAL);
  usePolling(loadOrders, ORDERS_INTERVAL);

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([loadOrders(), refreshPlc()]);
    setRefreshing(false);
  }

  // ---------- Quyền ----------
  const isSuper = !!me?.isSuper;
  const perms: OperatorPerms = {
    canOperate: ordersResp ? ordersResp.canOperate || ordersResp.isSuper || isSuper : canOrder("vanhanh"),
    canConfirm: ordersResp ? ordersResp.canConfirm || ordersResp.isSuper || isSuper : canOrder("xacnhan"),
    canPlc: canOrder("vanhanh") || canOrder("all"),
    isSuper,
  };

  // ---------- Phân loại đơn ----------
  const { running, paused, waiting } = useMemo(() => {
    const all = ordersResp?.orders ?? [];
    return {
      running: all.filter((o) => o.status === "running" && !o.isPaused),
      paused: all.filter((o) => o.status === "running" && o.isPaused),
      waiting: all.filter((o) => o.status === "new"),
    };
  }, [ordersResp]);
  const machineSuggestions = useMemo(
    () => Array.from(new Set((ordersResp?.orders ?? []).map((o) => o.machineName?.trim() || "").filter(Boolean))).slice(0, 12),
    [ordersResp],
  );

  const views = MILLS.map((cfg) => ({ cfg, view: computeScada(cfg, latest, plcError) }));
  const millsRunning = views.filter((v) => v.view.run === "running").length;

  // ---------- PLC: lưu phễu / silo / hệ số ----------
  async function saveSetting(machine: PlcMachineId, key: PlcStateKey, raw: string): Promise<boolean> {
    if (!perms.canPlc) {
      toast.error(NO_PERMISSION);
      return false;
    }
    const n = plcNumber(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Vui lòng nhập số hợp lệ lớn hơn hoặc bằng 0.");
      return false;
    }
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

  const orderHandlers: OrderHandlers = {
    onImage: setImageOf,
    onEdit: setEditing,
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

  const queueHandlers: QueueHandlers = {
    onEdit: setEditing,
    onComplete: orderHandlers.onComplete,
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

  return (
    <>
      <PageHeader
        title="Xưởng vận hành"
        description="Theo dõi 2 máy nghiền SCLM-1100 theo thời gian thực và điều hành các đơn đang chạy."
        actions={
          <>
            <PlcConnectionPill connected={!!latest?.connected} receivedAt={latest?.received_at ?? ""} error={plcError} loaded={!!latest || !!plcError} />
            <Link href="/plc">
              <Button variant="secondary" icon={Cpu}>
                Dữ liệu PLC
              </Button>
            </Link>
            <Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={refreshAll}>
              Làm mới
            </Button>
          </>
        }
      />

      {/* Tóm tắt */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Đơn đang chạy" value={ordersResp ? running.length : "—"} icon={PlayCircle} tone="success" hint={`${new Set(running.map((o) => o.machineName || "")).size} máy có đơn`} />
        <StatCard label="Máy nghiền đang chạy" value={latest ? millsRunning : "—"} unit={`/ ${MILLS.length}`} icon={Cog} tone="brand" hint={latest?.connected ? "Theo tín hiệu PLC" : "PLC chưa kết nối"} />
        <StatCard label="Đơn tạm dừng" value={ordersResp ? paused.length : "—"} icon={PauseCircle} tone="warning" />
        <StatCard label="Đơn chờ chạy" value={ordersResp ? waiting.length : "—"} icon={Timer} tone="accent" />
      </div>

      {/* Máy nghiền */}
      <SectionTitle icon={Factory} title="Máy nghiền SCLM-1100" hint={perms.canPlc ? "Bấm vào ô số để chỉnh tồn phễu, mức đầy, tồn silo và hệ số – lưu khi rời ô hoặc nhấn Enter." : "Chỉ xem – tài khoản chưa được cấp quyền vận hành máy."} />
      <div className="mb-8 grid gap-4">
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

      {/* Đơn đang chạy */}
      <SectionTitle icon={PlayCircle} title="Đơn đang chạy theo máy" hint={ordersError ? `Lỗi tải danh sách đơn: ${ordersError}` : undefined} danger={!!ordersError} />
      <div className="mb-8">
        {ordersResp ? (
          <RunningBoard orders={running} perms={perms} handlers={orderHandlers} />
        ) : ordersError ? null : (
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-[14px]" />
            <Skeleton className="h-72 rounded-[14px]" />
          </div>
        )}
      </div>

      {ordersResp ? (
        <div className="mb-8">
          <QueueTable paused={paused} waiting={waiting} perms={perms} handlers={queueHandlers} />
        </div>
      ) : null}

      <HistoryLogCard logs={logs} error={logsError} />

      <MachineDialog request={machineReq} suggestions={machineSuggestions} onClose={() => setMachineReq(null)} />
      <EditOrderModal order={editing} onClose={() => setEditing(null)} onSaved={() => void loadOrders()} />
      <Modal open={!!imageOf} onClose={() => setImageOf(null)} size="lg" title={imageOf ? `Ảnh đơn ${imageOf.orderNumber}` : ""}>
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
    </>
  );
}

function SectionTitle({ icon: Icon, title, hint, danger }: { icon: typeof Factory; title: string; hint?: string; danger?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-fg">
        <Icon size={19} className="text-brand-600" />
        {title}
      </h2>
      {hint ? <p className={danger ? "text-[13px] text-danger-600" : "text-[13px] text-muted"}>{hint}</p> : null}
    </div>
  );
}
