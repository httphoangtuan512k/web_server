/**
 * File này: kiểu dữ liệu trang Giám sát PLC – đúng JSON server cũ (`/api/plc/latest`, `/api/plc/history`).
 * Định nghĩa gốc dùng chung với /van-hanh nằm ở `van-hanh/_shared/plc-types.ts`.
 */
export type {
  PlcHistoryResponse,
  PlcHistoryRow,
  PlcLatestResponse,
  PlcMachineData,
  PlcMachineId,
  PlcOperationState,
  PlcPayload,
  PlcValue,
} from "../../van-hanh/_shared/plc-types";

/** Bộ lọc máy của bảng lịch sử. */
export type HistoryMachineFilter = "all" | "may1" | "may2" | "may3" | "may4";
