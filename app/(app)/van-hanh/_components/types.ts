/**
 * File này: mô tả hình dạng dữ liệu (kiểu) của trang Xưởng vận hành – khớp JSON server cũ (web/server.js).
 * Dùng ở: mọi component trong van-hanh; không vẽ gì lên màn hình.
 */
// Xuất lại các kiểu PLC dùng chung để chỉ cần import từ "./types".
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

/** Trạng thái đơn: new = mới tạo, running = đang chạy (isPaused = tạm dừng), completed = hoàn thành. */
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
  // Thông số kỹ thuật sản phẩm (độ trắng, cỡ hạt, khối lượng bao…).
  whiteness: string | null;
  grainSize: string | null;
  bagWeight: number | null;
  coatingRate: string | null;
  stoneType: string | null;
  impurity: string | null;
  pallet: string | null;
  extraBag: string | null;
  orderCommand: string;
  // Số đã chạy trên máy.
  runOnMachine: number | null;
  actualProduced: number | null;
  status: OrderStatus;
  isPaused: boolean;
  // Các mốc thời gian.
  exportDate: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string | null;
  // Người tạo / chạy / xác nhận, và máy đang chạy.
  creatorName: string | null;
  runnerName: string | null;
  confirmerName: string | null;
  machineName: string | null;
  // Số lấy bù từ tồn kho.
  khoBu: number | null;
}

/** Kết quả GET /api/orders: danh sách đơn + quyền của người đang đăng nhập. */
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
  // Giá trị trước/sau khi sửa (nếu có).
  old_value: number | null;
  new_value: number | null;
  created_at: string;
}

/** Quyền thao tác đã tính sẵn để giao diện ẩn/hiện nút. */
export interface OperatorPerms {
  /** Vận hành đơn (start/pause/resume/split, sửa "Đã chạy"). */
  canOperate: boolean;
  /** Xác nhận hoàn thành. */
  canConfirm: boolean;
  /** Chỉnh thông số PLC (phễu/silo/hệ số) – requirePlcOperator: super/admin/vanhanh. */
  canPlc: boolean;
  isSuper: boolean;
}

/** Đổi giá trị bất kỳ thành số; không hợp lệ thì trả 0. */
export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Đã chạy (tính cả tồn kho bù) – như trang cũ. */
export const producedOf = (o: Order) => num(o.runOnMachine) + num(o.khoBu);
/** Còn lại = SL kế hoạch − (đã chạy + kho bù), không âm. */
export const remainingOf = (o: Order) => Math.max(0, num(o.quantity) - producedOf(o));
