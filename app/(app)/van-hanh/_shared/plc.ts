/**
 * File này: danh sách máy, tên tag PLC của máy nghiền và các hàm đọc/đổi giá trị tag.
 * Dùng ở: sơ đồ SCADA trang /van-hanh và trang /plc; không vẽ gì.
 */
import type { PlcMachineData, PlcMachineId, PlcOperationState, PlcValue } from "./plc-types";

/** Thiết bị gửi dữ liệu (PLC_DEVICE_ID của server cũ). */
export const PLC_DEVICE_ID = "MAY_B";

/** Server coi là Online nếu lần nhận cuối ≤ 5 giây. */
export const PLC_ONLINE_WINDOW_MS = 5000;

// 4 máy: mã nội bộ và tên hiển thị.
export const PLC_MACHINES: ReadonlyArray<{ id: PlcMachineId; label: string }> = [
  { id: "may1", label: "Máy 1" },
  { id: "may2", label: "Máy 2" },
  { id: "may3", label: "Máy 3" },
  { id: "may4", label: "Máy 4" },
];

/** Đổi mã máy ("may1") thành tên hiển thị ("Máy 1"). */
export const plcMachineLabel = (id: string) => PLC_MACHINES.find((m) => m.id === id)?.label ?? id;

/**
 * Bộ tên tag SCADA cho từng máy nghiền – giữ nguyên SCADA_TAGS_MAY_1 / SCADA_TAGS_MAY_2 của trang cũ.
 * Bên trái: tên nội bộ; bên phải: tên tag C# gửi lên.
 */
export interface ScadaTags {
  /** Trạng thái chạy (> 5 = đang nghiền). */
  millRun: string;
  /** Cân định lượng – chỉ hiển thị. */
  production: string;
  currentWeight: string;
  /** 6 cảm biến mức liệu. */
  sensor2001: string;
  rawLevel2: string;
  siloALevel1: string;
  siloALevel2: string;
  siloBLevel1: string;
  siloBLevel2: string;
  hopperHigh: string;
  // Đang cấp liệu vào silo A / B.
  feedSiloA: string;
  feedSiloB: string;
  /** 1 = JB, 0 = Đóng bao. */
  modeA: string;
  modeB: string;
  // Bộ đếm tổng JB / đóng bao.
  jbATotal: string;
  bagATotal: string;
  jbBTotal: string;
  bagBTotal: string;
}

// Tên tag mặc định C# gửi lên.
const BASE_TAGS: ScadaTags = {
  millRun: "M321 may nghien HZ",
  production: "Cân định lượng",
  currentWeight: "Trọng lượng hiện tại",
  sensor2001: "200 cao",
  rawLevel2: "200 thap",
  siloALevel1: "Xilo A cao",
  siloALevel2: "Xilo A thap",
  siloBLevel1: "Xilo B cao",
  siloBLevel2: "Xilo B thap",
  hopperHigh: "200 cao",
  feedSiloA: "Xilo A",
  feedSiloB: "Xilo B",
  modeA: "JB vs DB A",
  modeB: "JB vs DB B",
  jbATotal: "JB A to",
  bagATotal: "Dong bao A",
  jbBTotal: "JB B to",
  bagBTotal: "Dong bao B",
};

/** Cấu hình một máy nghiền trên sơ đồ: mã máy, tên, mẫu máy, bộ tag. */
export interface MillConfig {
  machine: PlcMachineId;
  title: string;
  model: string;
  tags: ScadaTags;
}

/** Hai máy nghiền SCLM-1100 hiển thị trên trang Xưởng vận hành (mỗi máy có bộ tag riêng). */
export const MILLS: MillConfig[] = [
  { machine: "may1", title: "Máy nghiền 1", model: "SCLM-1100", tags: { ...BASE_TAGS, jbATotal: "JB A" } },
  { machine: "may2", title: "Máy nghiền 2", model: "SCLM-1100", tags: { ...BASE_TAGS } },
];

/** Giá trị mặc định khi server chưa có trạng thái (scadaStateFor cũ). */
export const DEFAULT_OPERATION_STATE: PlcOperationState = { hopperSetpoint: 20, hopper: 20, stockA: 0, stockB: 0, coeffA: 1, coeffB: 1 };

/** Đổi giá trị tag → số (hỗ trợ "true"/"false", dấu phẩy thập phân). NaN nếu rỗng/không hợp lệ. */
export function plcNumber(value: unknown): number {
  if (value === null || value === undefined || String(value).trim() === "") return NaN;
  if (value === true || String(value).trim().toLowerCase() === "true") return 1;
  if (value === false || String(value).trim().toLowerCase() === "false") return 0;
  // "12,5" → 12.5
  return Number(String(value).trim().replace(",", "."));
}

// Chuẩn hóa tên tag: chữ thường, gộp khoảng trắng.
const normalizeKey = (v: string) => v.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");

/** Đọc tag: khớp chính xác trước, sau đó khớp không phân biệt hoa thường/khoảng trắng. */
export function readTag(data: PlcMachineData | undefined, tagName: string): { found: boolean; value: PlcValue | undefined } {
  if (!tagName || !data || typeof data !== "object") return { found: false, value: undefined };
  // Có đúng tên → trả luôn.
  if (Object.prototype.hasOwnProperty.call(data, tagName)) return { found: true, value: data[tagName] };
  // Không có → dò theo tên đã chuẩn hóa.
  const wanted = normalizeKey(tagName);
  const key = Object.keys(data).find((k) => normalizeKey(k) === wanted);
  return key === undefined ? { found: false, value: undefined } : { found: true, value: data[key] };
}

/** Hiển thị giá trị tag thô ("—" nếu rỗng). */
export function formatPlcValue(v: PlcValue | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/** Tín hiệu số 0/1 → trạng thái đèn. */
export type Signal = "on" | "off" | "unknown";
/** 1 → "on", 0 → "off", khác → "unknown". */
export function toSignal(n: number): Signal {
  if (!Number.isFinite(n) || (n !== 0 && n !== 1)) return "unknown";
  return n === 1 ? "on" : "off";
}

/** Chuẩn hóa tên máy người dùng nhập ("Máy 1", "may1", "Máy nghiền 1"…) → mã PLC `may1` nếu nhận ra. */
export function machineIdFromName(name: string | null | undefined): PlcMachineId | null {
  if (!name) return null;
  // Bỏ dấu, đổi đ→d, viết thường, chỉ giữ chữ/số: "Máy nghiền 1" → "maynghien1".
  const norm = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  // Lấy con số ở cuối, vd "maynghien1" → 1.
  const m = /^(?:may|maynghien|nghien|m)?(\d+)$/.exec(norm);
  if (!m) return null;
  const id = `may${Number(m[1])}`;
  // Chỉ nhận nếu là 1 trong 4 máy.
  return PLC_MACHINES.some((x) => x.id === id) ? (id as PlcMachineId) : null;
}
