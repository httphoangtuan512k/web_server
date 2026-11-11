/**
 * File này: tính số liệu cần hiển thị cho sơ đồ SCADA của 1 máy nghiền từ dữ liệu PLC thô.
 * Dùng ở: thẻ máy nghiền trang Xưởng vận hành (scada-diagram.tsx vẽ kết quả).
 */
import { fmtTime } from "@/lib/format";
import { DEFAULT_OPERATION_STATE, plcNumber, readTag, toSignal, type MillConfig, type ScadaTags, type Signal } from "../_shared/plc";
import type { PlcLatestResponse, PlcOperationState } from "./types";

/** Máy đang chạy / dừng / mất kết nối / chưa rõ. */
export type MillRunState = "running" | "stopped" | "offline" | "unknown";

/** Mô hình hiển thị của 1 máy nghiền – tương đương renderScada()/clearScada() cũ. */
export interface ScadaView {
  run: MillRunState;
  /** Giá trị tag millRun (Hz) nếu có. */
  millHz: number | null;
  /** Cân định lượng. */
  production: number | null;
  // 6 đèn cảm biến mức liệu.
  sensors: { hopperHigh: Signal; hopperLow: Signal; siloAHigh: Signal; siloALow: Signal; siloBHigh: Signal; siloBLow: Signal };
  // Đang cấp liệu silo A / B.
  feedA: boolean;
  feedB: boolean;
  /** 1 = JB, 0 = Đóng bao, null = chưa chọn. */
  modeA: 0 | 1 | null;
  modeB: 0 | 1 | null;
  counterA: number | null;
  counterB: number | null;
  state: PlcOperationState;
  // Dòng thông báo dưới sơ đồ và màu của nó.
  message: string;
  tone: "info" | "warning" | "danger";
}

// Đèn xám khi chưa có dữ liệu.
const UNKNOWN_SENSORS = {
  hopperHigh: "unknown",
  hopperLow: "unknown",
  siloAHigh: "unknown",
  siloALow: "unknown",
  siloBHigh: "unknown",
  siloBLow: "unknown",
} as const;

// Số hợp lệ hoặc null.
const finite = (n: unknown) => {
  const x = Number(n);
  return n !== null && n !== undefined && Number.isFinite(x) ? x : null;
};
// 1 → JB, 0 → Đóng bao, khác → null.
const mode = (n: number): 0 | 1 | null => (n === 1 ? 1 : n === 0 ? 0 : null);

/** Chữ hiển thị chế độ: "JB" / "ĐÓNG BAO" / `empty`. */
export function modeLabel(m: 0 | 1 | null, empty = "--") {
  return m === 1 ? "JB" : m === 0 ? "ĐÓNG BAO" : empty;
}

/** Tính ScadaView cho 1 máy từ dữ liệu PLC mới nhất (hoặc lỗi tải). */
export function computeScada(cfg: MillConfig, latest: PlcLatestResponse | null, fetchError: string): ScadaView {
  // Trạng thái = mặc định, ghi đè bằng số server gửi.
  const state: PlcOperationState = { ...DEFAULT_OPERATION_STATE, ...(latest?.operation_state?.[cfg.machine] ?? {}) };
  // Kết quả mặc định: "Đang chờ dữ liệu PLC...".
  const base: ScadaView = {
    run: "unknown",
    millHz: null,
    production: null,
    sensors: { ...UNKNOWN_SENSORS },
    feedA: false,
    feedB: false,
    modeA: null,
    modeB: null,
    counterA: null,
    counterB: null,
    state,
    message: "Đang chờ dữ liệu PLC...",
    tone: "info",
  };
  // Lỗi tải → báo đỏ; chưa có dữ liệu → mặc định; offline → báo vàng.
  if (fetchError) return { ...base, message: `Không tải được dữ liệu PLC: ${fetchError}`, tone: "danger" };
  if (!latest) return base;
  if (!latest.connected || !latest.payload) {
    return { ...base, run: "offline", message: "PLC Offline hoặc chưa nhận dữ liệu mới. Đang giữ số liệu cuối cùng.", tone: "warning" };
  }

  // Đọc tag của máy này, ghi lại tag nào bị thiếu.
  const data = latest.payload.machines?.[cfg.machine];
  const missing = new Set<string>();
  const read = (key: keyof ScadaTags) => {
    const r = readTag(data, cfg.tags[key]);
    if (!r.found) missing.add(cfg.tags[key]);
    return plcNumber(r.value);
  };

  // Đọc tần số, 6 cảm biến, sản lượng, cấp liệu, chế độ.
  const runVal = read("millRun");
  const sig = (k: keyof ScadaTags) => toSignal(read(k));
  const sensors = {
    hopperHigh: sig("sensor2001"),
    hopperLow: sig("rawLevel2"),
    siloAHigh: sig("siloALevel1"),
    siloALow: sig("siloALevel2"),
    siloBHigh: sig("siloBLevel1"),
    siloBLow: sig("siloBLevel2"),
  };
  const production = read("production");
  const feedA = read("feedSiloA") === 1;
  const feedB = read("feedSiloB") === 1;
  const modeA = mode(read("modeA"));
  const modeB = mode(read("modeB"));
  // Đọc thêm các tag server dùng để tính toán, chỉ để báo thiếu tag như trang cũ.
  read("currentWeight");
  read("hopperHigh");

  // Dựng dòng thông báo: thiếu nhóm máy / thiếu tag / bình thường.
  const received = `Đã nhận PLC · ${fmtTime(latest.received_at)}`;
  let message: string;
  let tone: ScadaView["tone"] = "info";
  if (!data) {
    message = `${received} | Chưa nhận được nhóm dữ liệu ${cfg.machine} từ C#.`;
    tone = "warning";
  } else if (missing.size) {
    message = `${received} | Thiếu tag: ${[...missing].join(", ")}`;
    tone = "warning";
  } else {
    message = `${received} | Dữ liệu PLC · tính toán và lưu tại Server`;
  }

  return {
    // > 5 Hz là đang chạy.
    run: Number.isFinite(runVal) ? (runVal > 5 ? "running" : "stopped") : "stopped",
    millHz: Number.isFinite(runVal) ? runVal : null,
    production: Number.isFinite(production) ? production : null,
    sensors,
    feedA,
    feedB,
    modeA,
    modeB,
    counterA: finite(state.counterA),
    counterB: finite(state.counterB),
    state,
    message,
    tone,
  };
}
