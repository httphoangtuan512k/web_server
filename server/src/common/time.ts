/**
 * Server cũ chạy trên Windows giờ Việt Nam; Vercel chạy UTC.
 * Mọi "ngày làm việc", tên file theo ngày, mốc 23:59… phải dùng các hàm này thay cho
 * getFullYear()/getMonth()/getDate()/getHours() của Date.
 */
export const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam không có giờ mùa hè

export interface VnParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function vnParts(date: Date = new Date()): VnParts {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' theo giờ VN (thay cho localDateKey() của server cũ). */
export function vnDateKey(date: Date = new Date()): string {
  const p = vnParts(date);
  return `${p.year}-${p2(p.month)}-${p2(p.day)}`;
}

/** 'HHmmss' theo giờ VN. */
export function vnTimeKey(date: Date = new Date()): string {
  const p = vnParts(date);
  return `${p2(p.hour)}${p2(p.minute)}${p2(p.second)}`;
}

/** 'YYYY-MM-DD HH:mm:ss' theo giờ VN. */
export function vnDateTime(date: Date = new Date()): string {
  const p = vnParts(date);
  return `${vnDateKey(date)} ${p2(p.hour)}:${p2(p.minute)}:${p2(p.second)}`;
}

/** Hiển thị kiểu toLocaleString('vi-VN') nhưng cố định múi giờ VN. */
export function vnLocaleString(date: Date = new Date()): string {
  return date.toLocaleString('vi-VN', { timeZone: VN_TZ });
}

/** Mốc 00:00 giờ VN của một dateKey, dưới dạng Date (UTC). */
export function vnStartOfDay(dateKey: string): Date {
  return new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() - VN_OFFSET_MS);
}

/** dateKey hợp lệ 'YYYY-MM-DD'? */
export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
