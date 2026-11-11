/** Định dạng hiển thị – luôn theo giờ Việt Nam, bất kể máy người dùng. */
export const VN_TZ = "Asia/Ho_Chi_Minh";

const toDate = (v: string | number | Date | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 11/11/2026 */
export function fmtDate(v: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(v);
  return d ? d.toLocaleDateString("vi-VN", { timeZone: VN_TZ, day: "2-digit", month: "2-digit", year: "numeric" }) : fallback;
}

/** 11/11/2026 14:05 */
export function fmtDateTime(v: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(v);
  return d
    ? d.toLocaleString("vi-VN", { timeZone: VN_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    : fallback;
}

/** 14:05:09 */
export function fmtTime(v: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(v);
  return d ? d.toLocaleTimeString("vi-VN", { timeZone: VN_TZ, hour12: false }) : fallback;
}

/** 'YYYY-MM-DD' của hôm nay (giờ VN) – dùng cho input type=date và tham số API. */
export function todayKey(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Số có phân cách hàng nghìn kiểu VN: 1.234,5 */
export function fmtNumber(v: unknown, digits = 2, fallback = "—") {
  const n = typeof v === "number" ? v : Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return fallback;
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

/** "2 phút trước" */
export function fmtRelative(v: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(v);
  if (!d) return fallback;
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function fmtBytes(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
