/**
 * File này: mô tả dạng dữ liệu kho nhận từ máy chủ + vài hàm nhỏ (ngày, số).
 * Dùng ở: mọi file trong kho/_components. Không tự hiện gì trên màn hình.
 */
/** Kiểu dữ liệu JSON của /api/warehouse* (giữ khóa snake_case như server cũ). */

// 3 loại kho: Hàng hóa / Bao bì / Vật tư.
export type ItemCategory = "goods" | "packaging" | "materials";
// Nhập kho (in) hoặc xuất kho (out).
export type StockAction = "in" | "out";

/** Một mặt hàng (hàng hóa / bao bì / vật tư). Các cột không dùng của loại khác có thể vắng. */
export interface WarehouseItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  /** goods */
  code?: string;
  grain_size?: string;
  /** packaging */
  lot_number?: string;
  /** materials */
  shelf_number?: string;
  updated_at?: string;
}

// Một dòng lịch sử nhập/xuất: ai, mặt hàng nào, bao nhiêu, lúc nào.
export interface WarehouseTransaction {
  id: number;
  category: ItemCategory | string;
  item_id: number | null;
  item_name: string;
  action: StockAction | string;
  quantity: number;
  note: string;
  created_by: string;
  created_at: string;
}

// Một ngày đã chốt sổ (ai chốt, lúc nào).
export interface ClosingDate {
  work_date: string;
  created_by: string;
  closed_at: string;
}

/** GET /api/warehouse */
export interface WarehouseData {
  // Quyền của người đang đăng nhập.
  isAdmin: boolean;
  canEdit: boolean;
  isSuper: boolean;
  // Danh sách mặt hàng của 3 loại kho.
  goods: WarehouseItem[];
  packaging: WarehouseItem[];
  materials: WarehouseItem[];
  transactions: WarehouseTransaction[];
  closingDates: ClosingDate[];
}

/** Đơn gợi ý trong ngày (đơn có sự kiện Bắt đầu chạy / Chạy tiếp / Chạy thêm máy). */
export interface DailySuggestion {
  order_key: string;
  order_number: string;
  packaging_code: string;
  grain_size: string;
  order_total: number;
  status: string;
  produced_cumulative: number;
  note?: string;
  machines: string[];
  /** Bản chốt đời cũ (warehouse_daily_lines) chỉ có chuỗi tên máy. */
  machine_names?: string;
}

// Một dòng sản lượng của ngày: đơn gợi ý + số liệu trong ngày.
export interface DailyRow extends DailySuggestion {
  produced_today: number;
  machine_totals?: Record<string, number>;
  repack_today: number;
  repack_cumulative?: number;
  remaining: number;
}

// Sản lượng của một máy trong một phiếu.
export interface EntryLine {
  machine_name: string;
  quantity: number;
}

/** Một lần nhập (phiếu) trong ngày. */
export interface DailyEntry {
  id: number;
  created_at: string;
  created_by: string;
  repack_qty: number;
  machines: EntryLine[];
}

// Các phiếu nhập trong ngày của cùng một đơn.
export interface DailyEntryGroup {
  order_key: string;
  repack: number;
  machines: Record<string, number>;
  entries: DailyEntry[];
}

/** GET /api/warehouse/daily?date=YYYY-MM-DD */
export interface DailyResponse {
  date: string;
  // Ngày đã chốt chưa; ai chốt, lúc nào, bản thứ mấy.
  closed: boolean;
  createdBy?: string;
  closedAt?: string;
  version?: number;
  rows: DailyRow[];
  suggestions: DailySuggestion[];
  entries: DailyEntryGroup[];
}

/** GET /api/warehouse/snapshots → { rows } (bản chốt mới nhất của mỗi ngày). */
export interface SnapshotRow {
  work_date: string;
  version: number;
  created_by: string;
  created_at: string;
}

// Cặp "tên máy – số lượng" gửi lên máy chủ.
export interface MachineQty {
  machineName: string;
  quantity: number;
}

// Chữ tiếng Việt hiện trên màn hình cho từng loại kho.
export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  goods: "Hàng hóa",
  packaging: "Bao bì",
  materials: "Vật tư",
};

/** Nhãn một mặt hàng trong ô chọn (giống trang cũ). */
// Ví dụ: "Kệ 3 · Dầu máy — tồn 12 lít".
export function itemOptionLabel(cat: ItemCategory, x: WarehouseItem) {
  // Vật tư: "kệ · tên"; loại khác: "tên · Lô …".
  const base = cat === "materials" ? `${x.shelf_number || "—"} · ${x.name}` : `${x.name}${x.lot_number ? ` · Lô ${x.lot_number}` : ""}`;
  // Thêm "— tồn <số> <đơn vị>" (số kiểu Việt Nam).
  return `${base} — tồn ${Number(x.quantity || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${x.unit || ""}`.trim();
}

/** Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD' (không phụ thuộc múi giờ máy). */
export function shiftDate(key: string, days: number) {
  // Tách năm/tháng/ngày, cộng ngày, đổi lại thành chuỗi.
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (không qua Date để tránh lệch múi giờ). */
export function fmtDateKey(key: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : key || "—";
}

// Đổi giá trị bất kỳ thành số; không hợp lệ thì trả 0.
export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
