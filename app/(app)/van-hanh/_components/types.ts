/**
 * Kiểu dữ liệu trang Xưởng vận hành – theo đúng JSON server cũ (web/server.js).
 */
export type {
  PlcHistoryResponse,
  PlcHistoryRow,
  PlcLatestResponse,
  PlcMachineData,
  PlcMachineId,
  PlcOperationState,
  PlcPatchStateResponse,
  PlcPayload,
  PlcStateKey,
  PlcValue,
} from "../_shared/plc-types";

/** new = mới tạo, running = đang chạy (isPaused = tạm dừng), completed = hoàn thành. */
export type OrderStatus = "new" | "running" | "completed" | (string & {});

/** Một dòng đơn hàng (orderFromRow cũ). Đơn "chạy thêm máy" là dòng con cùng parentOrderId. */
export interface Order {
  id: string;
  /** = id nếu là đơn gốc. */
  parentOrderId: string;
  orderNumber: string;
  itemCode: string;
  packagingCode: string;
  quantity: number;
  /** '/api/files/…' hoặc data-URL cũ; '' nếu không có. */
  imageData: string | null;
  whiteness: string | null;
  grainSize: string | null;
  bagWeight: number | null;
  coatingRate: string | null;
  stoneType: string | null;
  impurity: string | null;
  pallet: string | null;
  extraBag: string | null;
  orderCommand: string;
  runOnMachine: number | null;
  actualProduced: number | null;
  status: OrderStatus;
  isPaused: boolean;
  exportDate: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string | null;
  creatorName: string | null;
  runnerName: string | null;
  confirmerName: string | null;
  machineName: string | null;
  khoBu: number | null;
}

/** GET /api/orders */
export interface OrdersResponse {
  orders: Order[];
  permissions: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canOperate: boolean;
  canConfirm: boolean;
  isSuper: boolean;
}

/** GET /api/history – dòng history_logs thô (snake_case), 50 dòng mới nhất. */
export interface HistoryLog {
  id: number;
  order_id: string;
  order_number: string;
  machine_name: string | null;
  user_name: string | null;
  action: string;
  old_value: number | null;
  new_value: number | null;
  created_at: string;
}

/** Quyền thao tác đã tính sẵn cho giao diện. */
export interface OperatorPerms {
  /** Vận hành đơn (start/pause/resume/split, sửa "Đã chạy"). */
  canOperate: boolean;
  /** Xác nhận hoàn thành. */
  canConfirm: boolean;
  /** Chỉnh thông số PLC (phễu/silo/hệ số) – requirePlcOperator: super/admin/vanhanh. */
  canPlc: boolean;
  isSuper: boolean;
}

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Đã chạy (tính cả tồn kho bù) – như trang cũ. */
export const producedOf = (o: Order) => num(o.runOnMachine) + num(o.khoBu);
/** Còn lại = SL kế hoạch − (đã chạy + kho bù), không âm. */
export const remainingOf = (o: Order) => Math.max(0, num(o.quantity) - producedOf(o));
