export type LogSource = "history" | "event" | "audit";

/** Một dòng nhật ký – GET /api/logs?date=YYYY-MM-DD (PORTING_GUIDE §2.1). */
export interface LogItem {
  /** 'history-12' | 'event-5' | 'audit-3' */
  id: string;
  source: LogSource;
  /** ISO */
  time: string;
  actor: string;
  action: string;
  orderNumber: string;
  machineName: string;
  /** Mô tả ngắn tiếng Việt. */
  detail: string;
  oldValue: number | null;
  newValue: number | null;
}

export interface LogsResponse {
  date: string;
  items: LogItem[];
}

/** Một dòng GET /api/history (bảng order_history, khóa snake_case như server cũ – 50 dòng mới nhất). */
export interface HistoryRow {
  id: number;
  order_id: string;
  order_number: string;
  machine_name: string | null;
  user_name: string;
  action: string;
  old_value: number | string | null;
  new_value: number | string | null;
  created_at: string;
}

/** Body PATCH /api/history/:id (chỉ Super Admin). */
export interface HistoryPatch {
  order_number: string;
  machine_name: string;
  user_name: string;
  action: string;
  old_value: number | string | null;
  new_value: number | string | null;
  created_at: string;
}

export const SOURCE_META: Record<LogSource, { label: string; tone: "brand" | "accent" | "warning" }> = {
  history: { label: "Lịch sử đơn", tone: "brand" },
  event: { label: "Vận hành", tone: "accent" },
  audit: { label: "Quản trị", tone: "warning" },
};
