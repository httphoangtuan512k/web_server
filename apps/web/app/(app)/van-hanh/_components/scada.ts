import { fmtTime } from "@/lib/format";
import { DEFAULT_OPERATION_STATE, plcNumber, readTag, toSignal, type MillConfig, type ScadaTags, type Signal } from "../_shared/plc";
import type { PlcLatestResponse, PlcOperationState } from "./types";

export type MillRunState = "running" | "stopped" | "offline" | "unknown";

/** Mô hình hiển thị của 1 máy nghiền – tương đương renderScada()/clearScada() cũ. */
export interface ScadaView {
  run: MillRunState;
  /** Giá trị tag millRun (Hz) nếu có. */
  millHz: number | null;
  /** Cân định lượng. */
  production: number | null;
  sensors: { hopperHigh: Signal; hopperLow: Signal; siloAHigh: Signal; siloALow: Signal; siloBHigh: Signal; siloBLow: Signal };
  feedA: boolean;
  feedB: boolean;
  /** 1 = JB, 0 = Đóng bao, null = chưa chọn. */
  modeA: 0 | 1 | null;
  modeB: 0 | 1 | null;
  counterA: number | null;
  counterB: number | null;
  state: PlcOperationState;
  message: string;
  tone: "info" | "warning" | "danger";
}

const UNKNOWN_SENSORS = {
  hopperHigh: "unknown",
  hopperLow: "unknown",
  siloAHigh: "unknown",
  siloALow: "unknown",
  siloBHigh: "unknown",
  siloBLow: "unknown",
} as const;

const finite = (n: unknown) => {
  const x = Number(n);
  return n !== null && n !== undefined && Number.isFinite(x) ? x : null;
};
const mode = (n: number): 0 | 1 | null => (n === 1 ? 1 : n === 0 ? 0 : null);

export function modeLabel(m: 0 | 1 | null, empty = "--") {
  return m === 1 ? "JB" : m === 0 ? "ĐÓNG BAO" : empty;
}

export function computeScada(cfg: MillConfig, latest: PlcLatestResponse | null, fetchError: string): ScadaView {
  const state: PlcOperationState = { ...DEFAULT_OPERATION_STATE, ...(latest?.operation_state?.[cfg.machine] ?? {}) };
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
  if (fetchError) return { ...base, message: `Không tải được dữ liệu PLC: ${fetchError}`, tone: "danger" };
  if (!latest) return base;
  if (!latest.connected || !latest.payload) {
    return { ...base, run: "offline", message: "PLC Offline hoặc chưa nhận dữ liệu mới. Đang giữ số liệu cuối cùng.", tone: "warning" };
  }

  const data = latest.payload.machines?.[cfg.machine];
  const missing = new Set<string>();
  const read = (key: keyof ScadaTags) => {
    const r = readTag(data, cfg.tags[key]);
    if (!r.found) missing.add(cfg.tags[key]);
    return plcNumber(r.value);
  };

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
