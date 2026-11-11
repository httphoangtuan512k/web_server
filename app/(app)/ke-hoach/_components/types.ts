/**
 * File này: mô tả hình dạng dữ liệu (kiểu) của đơn hàng, lịch sử, quyền… cho trang Kế hoạch.
 * Dùng ở: mọi file trong ke-hoach/_components (không hiển thị gì).
 * Kiểu dữ liệu trang Kế hoạch sản xuất – khớp JSON server cũ (`orderFromRow`, `/api/orders*`, `/api/history*`).
 */

// Trạng thái đơn: mới tạo / đang chạy / hoàn thành.
export type OrderStatus = "new" | "running" | "completed";

/** Một dòng đơn hàng (`orderFromRow`). Đơn chạy thêm máy là dòng con có `parentOrderId` = id đơn gốc. */
export interface Order {
  id: string;
  /** Server cũ trả `parent_order_id || id` (đơn gốc = chính nó). Có thể null/'' ở backend mới. */
  parentOrderId: string | null;
  orderNumber: string;
  itemCode: string;
  packagingCode: string;
  quantity: number;
  /** URL ảnh bao bì: '/api/files/…' hoặc data-URL cũ. */
  imageData: string;
  whiteness: string;
  grainSize: string;
  bagWeight: string | number;
  coatingRate: string;
  stoneType: string;
  impurity: string;
  pallet: string;
  extraBag: string;
  orderCommand: string;
  runOnMachine: number;
  actualProduced: number;
  status: OrderStatus;
  isPaused: boolean;
  /** 'YYYY-MM-DD' hoặc ''. */
  exportDate: string;
  createdAt: string;
  /** ISO hoặc '' / null nếu chưa hoàn thành. */
  completedAt: string | null;
  updatedAt: string;
  creatorName: string;
  runnerName: string;
  confirmerName: string;
  machineName: string;
  khoBu: number;
}

/** GET /api/orders */
export interface OrdersResponse {
  orders: Order[];
  /** Quyền đơn của người dùng: new | edit | vanhanh | xacnhan (| all | delete ở dữ liệu cũ). */
  permissions: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canOperate: boolean;
  canConfirm: boolean;
  isSuper: boolean;
}

/** Đơn đã gộp theo nhóm (đơn gốc + các dòng chạy thêm máy) – giống `groupOrders()` trang cũ. */
export interface OrderGroup extends Order {
  /** Khóa nhóm = parentOrderId || id. */
  key: string;
  machineNames: string[];
  runnerNames: string[];
  /** Các dòng thuộc nhóm (mới nhất trước). */
  rows: Order[];
}

/** GET /api/orders/:id/operations – dòng `operation_events` thô (snake_case). */
export interface OperationEvent {
  id: number;
  order_id: string;
  order_number: string;
  event_type: string;
  machine_name: string;
  machine_count: number;
  actual_tons: number;
  user_name: string;
  created_at: string;
}

/** GET /api/history – dòng `history_logs` thô (snake_case, 50 bản ghi mới nhất). */
export interface HistoryRow {
  id: number;
  order_id: string;
  order_number: string;
  machine_name: string;
  user_name: string;
  action: string;
  old_value: number | string | null;
  new_value: number | string | null;
  created_at: string;
}

/** PATCH /api/history/:id (chỉ Super Admin). */
export type HistoryPatch = Partial<Pick<HistoryRow, "order_number" | "machine_name" | "user_name" | "action" | "created_at">> & {
  old_value?: number | string;
  new_value?: number | string;
};

/** Body POST /api/orders và PATCH /api/orders/:id (form tạo/sửa). */
export interface OrderPayload {
  orderNumber: string;
  itemCode: string;
  packagingCode: string;
  quantity: number;
  exportDate: string;
  whiteness: string;
  grainSize: string;
  bagWeight: string;
  coatingRate: string;
  stoneType: string;
  impurity: string;
  pallet: string;
  extraBag: string;
  orderCommand: string;
  imageData: string;
}

/** Các trường Super Admin được sửa trực tiếp (PATCH /api/orders/:id). */
export type EditableOrderField =
  | "orderNumber"
  | "itemCode"
  | "packagingCode"
  | "quantity"
  | "whiteness"
  | "grainSize"
  | "bagWeight"
  | "coatingRate"
  | "stoneType"
  | "impurity"
  | "pallet"
  | "extraBag"
  | "orderCommand"
  | "runOnMachine"
  | "actualProduced"
  | "khoBu"
  | "exportDate"
  | "createdAt"
  | "creatorName"
  | "runnerName"
  | "confirmerName";

/** Quyền thao tác trên trang (tính từ useAuth + phản hồi /api/orders). */
export interface OrderPerms {
  create: boolean;
  edit: boolean;
  remove: boolean;
  operate: boolean;
  confirm: boolean;
  isSuper: boolean;
}

// Bộ lọc phạm vi (đang hoạt động / lưu trữ) và bộ lọc trạng thái.
export type ViewFilter = "active" | "history";
export type StatusFilter = "all" | "new" | "running" | "paused" | "completed";
