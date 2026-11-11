/**
 * File này: hàm dùng chung cho Đơn hàng – đổi dữ liệu DB, gộp đơn chạy thêm máy, kiểm quyền, ghi nhật ký, khóa dòng.
 * Dùng ở: orders.controller.ts (trang Kế hoạch, Vận hành) và các module khác cần đọc đơn.
 */
import { randomBytes } from 'crypto';
import type { DbUser } from '../../auth/auth.types';
import type { Queryable, Row } from '../../db/db.service';

/** Câu SQL lấy đơn kèm tên người tạo (LEFT JOIN users) – thay cho creatorLookup của server cũ. */
export const ORDER_SELECT = `SELECT o.*, cu.username AS creator_username, cu.full_name AS creator_full_name
  FROM orders o LEFT JOIN users cu ON cu.id = o.created_by`;

/** Hình dạng một đơn hàng khi gửi cho trang web. */
export interface OrderJson {
  id: string;
  // Mã đơn gốc (dòng chạy thêm máy trỏ về đây).
  parentOrderId: string;
  orderNumber: string;
  itemCode: string;
  packagingCode: string;
  // Số lượng cần sản xuất (tấn).
  quantity: number;
  // Link ảnh đơn (Vercel Blob).
  imageData: string;
  whiteness: string;
  grainSize: string;
  bagWeight: string;
  coatingRate: string;
  stoneType: string;
  impurity: string;
  pallet: string;
  extraBag: string;
  orderCommand: string;
  // Số tấn đã chạy máy / sản lượng thực tế (nhập ở trang Kho).
  runOnMachine: number;
  actualProduced: number;
  // 'new' | 'running' | 'completed'.
  status: string;
  isPaused: boolean;
  exportDate: string;
  createdAt: Date | string;
  completedAt: Date | string;
  updatedAt: Date | string;
  creatorName: string;
  runnerName: string;
  confirmerName: string;
  machineName: string;
  // Số tấn lấy từ tồn kho bù.
  khoBu: number;
}

/** Đổi 1 dòng DB (snake_case) thành OrderJson (camelCase); không có dòng thì trả null. */
export function orderFromRow(r: Row | undefined | null): OrderJson | null {
  if (!r) return null;
  return {
    id: r.id,
    // Đơn gốc không có cha → dùng chính id.
    parentOrderId: r.parent_order_id || r.id,
    orderNumber: r.order_number,
    itemCode: r.item_code,
    packagingCode: r.packaging_code,
    quantity: r.quantity,
    imageData: r.image_url,
    whiteness: r.whiteness,
    grainSize: r.grain_size,
    bagWeight: r.bag_weight,
    coatingRate: r.coating_rate,
    stoneType: r.stone_type,
    impurity: r.impurity,
    pallet: r.pallet,
    extraBag: r.extra_bag,
    orderCommand: r.order_command || '',
    runOnMachine: r.run_on_machine,
    actualProduced: r.actual_produced,
    status: r.status,
    isPaused: Boolean(r.is_paused),
    exportDate: r.export_date,
    createdAt: r.created_at,
    // Thiếu ngày hoàn thành mà đơn đã xong → tạm lấy ngày cập nhật cuối.
    completedAt: r.completed_at || (r.status === 'completed' ? r.updated_at : ''),
    updatedAt: r.updated_at,
    // created_by là tài khoản tạo đơn gốc; ưu tiên nguồn này để chữ ký Tạo không bị đổi khi người khác bấm Chạy.
    creatorName: r.creator_name || r.creator_full_name || r.creator_username || '',
    runnerName: r.runner_name,
    confirmerName: r.confirmer_name,
    machineName: r.machine_name,
    khoBu: r.kho_bu,
  };
}

// Đơn đã gộp: thêm danh sách tên máy và người chạy.
export type GroupedOrder = OrderJson & { machineNames: string[]; runnerNames: string[] };

/** Gộp các dòng chạy thêm máy về đơn gốc (vd máy 1: 20 tấn + máy 2: 30 tấn → 1 đơn 50 tấn). */
export function groupedOrderRows(rows: Row[]): GroupedOrder[] {
  // Map: mã đơn gốc → đơn đã gộp.
  const map = new Map<string, GroupedOrder>();
  for (const raw of rows) {
    const o = orderFromRow(raw)!;
    const key = o.parentOrderId || o.id;
    const x = map.get(key);
    if (!x) {
      // Dòng đầu tiên của nhóm → thêm mới.
      map.set(key, { ...o, machineNames: o.machineName ? [o.machineName] : [], runnerNames: o.runnerName ? [o.runnerName] : [] });
    } else {
      // Dòng tiếp theo → cộng dồn đã chạy và thực tế.
      x.runOnMachine = (Number(x.runOnMachine) || 0) + (Number(o.runOnMachine) || 0);
      x.actualProduced = (Number(x.actualProduced) || 0) + (Number(o.actualProduced) || 0);
      // Thêm tên máy / người chạy nếu chưa có.
      if (o.machineName && !x.machineNames.includes(o.machineName)) x.machineNames.push(o.machineName);
      if (o.runnerName && !x.runnerNames.includes(o.runnerName)) x.runnerNames.push(o.runnerName);
      // Một máy đang chạy → cả đơn "đang chạy".
      if (o.status === 'running') x.status = 'running';
      // Lấy ngày hoàn thành muộn nhất.
      if (o.completedAt && (!x.completedAt || new Date(o.completedAt) > new Date(x.completedAt))) x.completedAt = o.completedAt;
    }
  }
  return [...map.values()];
}

/** Đơn hoàn thành từ 3 tháng trước trở về trước → true (chuyển vào tab "Lịch sử"). */
export function orderArchiveDate(order: Pick<OrderJson, 'completedAt' | 'status' | 'updatedAt'>): boolean {
  // Lấy ngày hoàn thành; ngày sai/thiếu → không lưu trữ.
  const raw = order.completedAt || (order.status === 'completed' ? order.updatedAt : '');
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return false;
  // Mốc cắt = hôm nay lùi 3 tháng.
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  return d <= cutoff;
}

/** Danh sách quyền đơn hàng của user (vd ['new','vanhanh']); không có thì mảng rỗng. */
export const orderPerms = (u: DbUser): string[] => u.orderPermissions ?? [];

/** Có quyền vận hành ('vanhanh') / xác nhận ('xacnhan') không; Super Admin và 'all' luôn được. */
export function operationPermission(u: DbUser, kind: 'operate' | 'confirm'): boolean {
  const perms = orderPerms(u);
  return Boolean(u.isSuper) || perms.includes('all') || perms.includes(kind === 'confirm' ? 'xacnhan' : 'vanhanh');
}

/** Tên ghi vào chữ ký/nhật ký: họ tên, thiếu thì tên đăng nhập. */
export const actorName = (u: Pick<DbUser, 'fullName' | 'username'>) => u.fullName || u.username;

/** Tạo mã đơn mới: order_<thời điểm>_<chuỗi ngẫu nhiên>. */
export const newOrderId = (bytes: number) => `order_${Date.now()}_${randomBytes(bytes).toString('hex')}`;

/** Ghi sự kiện vận hành (Bắt đầu chạy, Tạm dừng…) vào bảng order_events. */
export async function addOperationEvent(
  q: Queryable,
  row: { id: string; order_number: string },
  type: string,
  machine: unknown,
  count: unknown,
  tons: unknown,
  u: DbUser,
  now: Date,
) {
  // Chèn 1 dòng; giá trị thiếu → '' hoặc 0.
  await q.run(
    `INSERT INTO order_events (order_id, order_number, event_type, machine_name, machine_count, actual_tons, user_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.order_number, type, String(machine || ''), Number(count) || 0, Number(tons) || 0, actorName(u), now],
  );
}

/** Ghi lịch sử thao tác (vd "Chốt hoàn thành", giá trị cũ → mới) vào bảng order_history. */
export async function addHistory(
  q: Queryable,
  row: { id: string; order_number: string },
  machine: unknown,
  user: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  now: Date,
) {
  // Đổi sang số; không phải số → 0.
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  await q.run(
    `INSERT INTO order_history (order_id, order_number, machine_name, user_name, action, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.order_number, String(machine ?? ''), user, action, n(oldValue), n(newValue), now],
  );
}

/**
 * Khóa (FOR UPDATE) toàn bộ dòng cùng nhóm với đơn `id`, theo thứ tự id để tránh deadlock.
 * FOR UPDATE = người khác phải chờ tới khi giao dịch xong mới sửa được (tránh 2 người chốt cùng lúc).
 * Trả về { row, group } hoặc null nếu không có đơn.
 */
export async function lockOrderGroup(t: Queryable, id: string): Promise<{ row: Row; group: Row[] } | null> {
  // Thử tối đa 3 lần phòng khi nhóm vừa đổi.
  for (let attempt = 0; attempt < 3; attempt++) {
    // Tìm mã nhóm của đơn.
    const head = await t.get<{ group_id: string }>('SELECT group_id FROM orders WHERE id = ?', [id]);
    if (!head) return null;
    // Khóa mọi dòng trong nhóm, rồi tìm lại đúng dòng cần.
    const group = await t.all(`SELECT * FROM orders WHERE group_id = ? ORDER BY id FOR UPDATE`, [head.group_id]);
    const row = group.find((r) => r.id === id);
    if (row) return { row, group };
    // Nhóm vừa đổi (đơn gốc bị xóa) – thử lại.
  }
  return null;
}

/** Khóa đúng 1 dòng đơn (dùng cho Chạy / Tạm dừng / Chạy tiếp). */
export async function lockOrder(t: Queryable, id: string): Promise<Row | undefined> {
  return t.get('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
}
