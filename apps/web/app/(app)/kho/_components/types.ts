/** Kiểu dữ liệu JSON của /api/warehouse* (giữ khóa snake_case như server cũ). */

export type ItemCategory = "goods" | "packaging" | "materials";
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

export interface ClosingDate {
  work_date: string;
  created_by: string;
  closed_at: string;
}

/** GET /api/warehouse */
export interface WarehouseData {
  isAdmin: boolean;
  canEdit: boolean;
  isSuper: boolean;
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

export interface DailyRow extends DailySuggestion {
  produced_today: number;
  machine_totals?: Record<string, number>;
  repack_today: number;
  repack_cumulative?: number;
  remaining: number;
}

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

export interface DailyEntryGroup {
  order_key: string;
  repack: number;
  machines: Record<string, number>;
  entries: DailyEntry[];
}

/** GET /api/warehouse/daily?date=YYYY-MM-DD */
export interface DailyResponse {
  date: string;
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

export interface MachineQty {
  machineName: string;
  quantity: number;
}

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  goods: "Hàng hóa",
  packaging: "Bao bì",
  materials: "Vật tư",
};

/** Nhãn một mặt hàng trong ô chọn (giống trang cũ). */
export function itemOptionLabel(cat: ItemCategory, x: WarehouseItem) {
  const base = cat === "materials" ? `${x.shelf_number || "—"} · ${x.name}` : `${x.name}${x.lot_number ? ` · Lô ${x.lot_number}` : ""}`;
  return `${base} — tồn ${Number(x.quantity || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${x.unit || ""}`.trim();
}

/** Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD' (không phụ thuộc múi giờ máy). */
export function shiftDate(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (không qua Date để tránh lệch múi giờ). */
export function fmtDateKey(key: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : key || "—";
}

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
