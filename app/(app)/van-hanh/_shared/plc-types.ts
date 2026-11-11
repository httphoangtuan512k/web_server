/**
 * File này: mô tả hình dạng dữ liệu PLC – đúng JSON của server cũ (`/api/plc/*`, web/server.js).
 * Dùng ở: trang /van-hanh (sơ đồ SCADA) và /plc; không vẽ gì lên màn hình.
 */

/** Mã máy trong payload PLC (C# gửi đủ 4 nhóm). */
export type PlcMachineId = "may1" | "may2" | "may3" | "may4";

/** Giá trị một tag PLC: C# gửi số, chuỗi hoặc boolean. */
export type PlcValue = string | number | boolean | null;

/** Bộ tag của một máy: { "Tên tag": giá trị }. */
export type PlcMachineData = Record<string, PlcValue>;

/** payload lưu trong cache/lịch sử: `{ device_id, source_timestamp, machines }`. */
export interface PlcPayload {
  device_id: string;
  source_timestamp: string;
  // Dữ liệu từng máy may1…may4 (có thể thiếu máy).
  machines: Partial<Record<PlcMachineId, PlcMachineData>> & Record<string, PlcMachineData | undefined>;
}

/**
 * Trạng thái vận hành do server tính (plc_operation_state / plc_machine_states).
 * Đơn vị: tấn (hopper = phễu, stock* = tồn silo), hệ số không đơn vị, counter = raw × hệ số.
 */
export interface PlcOperationState {
  hopperSetpoint: number;
  hopper: number;
  stockA: number;
  stockB: number;
  coeffA: number;
  coeffB: number;
  // Giá trị lần đọc trước – server dùng để tính chênh lệch.
  lastWeight?: number | null;
  lastRawCounterA?: number | null;
  lastRawCounterB?: number | null;
  lastCounterModeA?: number | null;
  lastCounterModeB?: number | null;
  needsRebaseline?: boolean;
  counterA?: number | null;
  counterB?: number | null;
  updatedAt?: string;
}

/** GET /api/plc/latest */
export interface PlcLatestResponse {
  device_id: string;
  connected: boolean;
  /** ISO hoặc '' khi chưa nhận. */
  received_at: string;
  payload: PlcPayload | null;
  operation_state?: Partial<Record<PlcMachineId, PlcOperationState>>;
}

/** Khóa được phép PATCH /api/plc/operation-state/:machine */
export type PlcStateKey = "hopperSetpoint" | "hopper" | "stockA" | "stockB" | "coeffA" | "coeffB";

/** PATCH /api/plc/operation-state/:machine → */
export interface PlcPatchStateResponse {
  ok: boolean;
  machine: PlcMachineId;
  operation_state: PlcOperationState;
}

/** Một bản ghi GET /api/plc/history */
export interface PlcHistoryRow {
  id: number;
  received_at: string;
  payload: PlcPayload;
}

/** GET /api/plc/history?limit&from&to */
export interface PlcHistoryResponse {
  rows: PlcHistoryRow[];
}
