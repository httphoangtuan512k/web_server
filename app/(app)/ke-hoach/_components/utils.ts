/**
 * File này: hàm phụ trợ cho trang Kế hoạch – đổi số, ngày, gộp/sắp xếp đơn, trạng thái.
 * Dùng ở: các component trong ke-hoach/_components.
 */
import { fmtNumber, todayKey } from "@/lib/format";
import type { Order, OrderGroup, StatusFilter } from "./types";

/** Đổi giá trị sang số; không hợp lệ → 0. */
export const toNum = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Số tấn: tối đa 3 chữ số thập phân. */
export const fmtTons = (v: unknown) => fmtNumber(toNum(v), 3, "0");

// Đổi chuỗi ngày sang mili-giây; không có → 0.
const time = (v: string | null | undefined) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** 'YYYY-MM-DD' theo giờ VN (cho input date / so sánh). */
export function dateKey(v: string | null | undefined) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : todayKey(d);
}

/** 'YYYY-MM' theo giờ VN – bộ lọc tháng/năm. */
export const monthKey = (v: string | null | undefined) => dateKey(v).slice(0, 7);

/** Mã nhóm: đơn chạy thêm máy dùng mã đơn gốc. */
export const groupKeyOf = (o: Order) => o.parentOrderId || o.id;

/**
 * Gộp các dòng cùng đơn gốc (chạy thêm máy) – giữ đúng logic `groupOrders()` trang cũ:
 * cộng dồn đã chạy/sản lượng, gom tên máy & người chạy, nhóm "đang chạy" nếu có dòng đang chạy,
 * ngày hoàn thành = muộn nhất, hết tạm dừng nếu có dòng không tạm dừng.
 * Đầu vào sắp xếp mới nhất trước (như server trả), dòng đầu tiên của nhóm làm đại diện.
 */
export function groupOrders(list: Order[]): OrderGroup[] {
  // Mỗi nhóm có 1 mã; dòng đầu tạo nhóm, các dòng sau cộng dồn vào.
  const map = new Map<string, OrderGroup>();
  for (const o of list) {
    const key = groupKeyOf(o);
    const g = map.get(key);
    if (!g) {
      map.set(key, {
        ...o,
        key,
        runOnMachine: toNum(o.runOnMachine),
        actualProduced: toNum(o.actualProduced),
        completedAt: o.completedAt || "",
        machineNames: o.machineName ? [o.machineName] : [],
        runnerNames: o.runnerName ? [o.runnerName] : [],
        rows: [o],
      });
      continue;
    }
    g.rows.push(o);
    g.runOnMachine += toNum(o.runOnMachine);
    g.actualProduced += toNum(o.actualProduced);
    if (o.machineName && !g.machineNames.includes(o.machineName)) g.machineNames.push(o.machineName);
    if (o.runnerName && !g.runnerNames.includes(o.runnerName)) g.runnerNames.push(o.runnerName);
    if (o.status === "running") g.status = "running";
    if (o.completedAt && (!g.completedAt || time(o.completedAt) > time(g.completedAt))) g.completedAt = o.completedAt;
    if (o.isPaused === false) g.isPaused = false;
  }
  return [...map.values()];
}

/** Ưu tiên hiển thị: đang chạy → mới tạo → tạm dừng → hoàn thành; cùng nhóm thì mới tạo trước. */
const priority = (g: OrderGroup) => {
  if (g.status === "running" && !g.isPaused) return 0;
  if (g.status === "new") return 1;
  if (g.status === "running") return 2;
  if (g.status === "completed") return 3;
  return 4;
};
/** Sắp xếp nhóm đơn theo thứ tự ưu tiên ở trên. */
export function sortGroups(list: OrderGroup[]) {
  return [...list].sort((a, b) => priority(a) - priority(b) || time(b.createdAt) - time(a.createdAt));
}

/** Đơn hoàn thành quá 3 tháng → mục "Lưu trữ". */
export function isArchived(o: Pick<Order, "status" | "completedAt" | "updatedAt">, now: number) {
  if (o.status !== "completed") return false;
  const t = time(o.completedAt || o.updatedAt);
  if (!t) return false;
  // Mốc: lùi 3 tháng so với `now`.
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 3);
  return t <= cutoff.getTime();
}

// Mã trạng thái hiển thị: new / running / paused / completed.
export type StatusKey = Exclude<StatusFilter, "all">;
/** Tính trạng thái hiển thị của đơn (đang chạy mà tạm dừng → paused). */
export const statusKey = (o: Pick<Order, "status" | "isPaused">): StatusKey =>
  o.status === "running" ? (o.isPaused ? "paused" : "running") : o.status === "completed" ? "completed" : "new";

// Chữ và màu nhãn cho từng trạng thái.
export const STATUS_META: Record<StatusKey, { label: string; tone: "info" | "warning" | "neutral" | "success" }> = {
  new: { label: "Chưa chạy", tone: "neutral" },
  running: { label: "Đang chạy", tone: "warning" },
  paused: { label: "Tạm dừng", tone: "warning" },
  completed: { label: "Hoàn thành", tone: "success" },
};

/** Số tấn còn lại = số lượng đặt − đã sản xuất (không âm). */
export const remainingOf = (g: Pick<Order, "quantity" | "actualProduced">) => Math.max(0, toNum(g.quantity) - toNum(g.actualProduced));

/** ISO → 'YYYY-MM-DDTHH:mm' theo giờ VN (cho input datetime-local). */
export function toVnLocalInput(v: string | null | undefined) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  // Tách ngày giờ theo giờ VN thành từng phần rồi ghép lại.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** 'YYYY-MM-DDTHH:mm' (giờ VN) → ISO. Trả '' nếu không hợp lệ. */
export function fromVnLocalInput(v: string) {
  if (!v) return "";
  const d = new Date(`${v.length === 16 ? `${v}:00` : v}+07:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
