import { randomBytes } from 'crypto';
import type { DbUser } from '../../auth/auth.types';
import type { Queryable, Row } from '../../db/db.service';

/** SELECT dòng đơn kèm tên người tạo (thay cho creatorLookup của server cũ). */
export const ORDER_SELECT = `SELECT o.*, cu.username AS creator_username, cu.full_name AS creator_full_name
  FROM orders o LEFT JOIN users cu ON cu.id = o.created_by`;

export interface OrderJson {
  id: string;
  parentOrderId: string;
  orderNumber: string;
  itemCode: string;
  packagingCode: string;
  quantity: number;
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
  runOnMachine: number;
  actualProduced: number;
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
  khoBu: number;
}

/** = orderFromRow() cũ. `r` là dòng SQL thuần (snake_case) lấy bằng ORDER_SELECT (hoặc SELECT * FROM orders). */
export function orderFromRow(r: Row | undefined | null): OrderJson | null {
  if (!r) return null;
  return {
    id: r.id,
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

export type GroupedOrder = OrderJson & { machineNames: string[]; runnerNames: string[] };

/** = groupedOrderRows() cũ: gộp các dòng chạy thêm máy theo đơn gốc. */
export function groupedOrderRows(rows: Row[]): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>();
  for (const raw of rows) {
    const o = orderFromRow(raw)!;
    const key = o.parentOrderId || o.id;
    const x = map.get(key);
    if (!x) {
      map.set(key, { ...o, machineNames: o.machineName ? [o.machineName] : [], runnerNames: o.runnerName ? [o.runnerName] : [] });
    } else {
      x.runOnMachine = (Number(x.runOnMachine) || 0) + (Number(o.runOnMachine) || 0);
      x.actualProduced = (Number(x.actualProduced) || 0) + (Number(o.actualProduced) || 0);
      if (o.machineName && !x.machineNames.includes(o.machineName)) x.machineNames.push(o.machineName);
      if (o.runnerName && !x.runnerNames.includes(o.runnerName)) x.runnerNames.push(o.runnerName);
      if (o.status === 'running') x.status = 'running';
      if (o.completedAt && (!x.completedAt || new Date(o.completedAt) > new Date(x.completedAt))) x.completedAt = o.completedAt;
    }
  }
  return [...map.values()];
}

/** = orderArchiveDate() cũ: đơn hoàn thành từ 3 tháng trước trở về trước thì chuyển vào "Lịch sử". */
export function orderArchiveDate(order: Pick<OrderJson, 'completedAt' | 'status' | 'updatedAt'>): boolean {
  const raw = order.completedAt || (order.status === 'completed' ? order.updatedAt : '');
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  return d <= cutoff;
}

/** Quyền đơn hàng (users.order_permissions). */
export const orderPerms = (u: DbUser): string[] => u.orderPermissions ?? [];

/** = operationPermission() cũ: Super Admin, 'all', hoặc vanhanh/xacnhan. */
export function operationPermission(u: DbUser, kind: 'operate' | 'confirm'): boolean {
  const perms = orderPerms(u);
  return Boolean(u.isSuper) || perms.includes('all') || perms.includes(kind === 'confirm' ? 'xacnhan' : 'vanhanh');
}

export const actorName = (u: Pick<DbUser, 'fullName' | 'username'>) => u.fullName || u.username;

export const newOrderId = (bytes: number) => `order_${Date.now()}_${randomBytes(bytes).toString('hex')}`;

/** = addOperationEvent() cũ. */
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
  await q.run(
    `INSERT INTO order_events (order_id, order_number, event_type, machine_name, machine_count, actual_tons, user_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.order_number, type, String(machine || ''), Number(count) || 0, Number(tons) || 0, actorName(u), now],
  );
}

/** Ghi order_history (history_logs cũ). */
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
 * Trả về { row, group } hoặc null nếu không có đơn.
 */
export async function lockOrderGroup(t: Queryable, id: string): Promise<{ row: Row; group: Row[] } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await t.get<{ group_id: string }>('SELECT group_id FROM orders WHERE id = ?', [id]);
    if (!head) return null;
    const group = await t.all(`SELECT * FROM orders WHERE group_id = ? ORDER BY id FOR UPDATE`, [head.group_id]);
    const row = group.find((r) => r.id === id);
    if (row) return { row, group };
    // Nhóm vừa đổi (đơn gốc bị xóa) – thử lại.
  }
  return null;
}

export async function lockOrder(t: Queryable, id: string): Promise<Row | undefined> {
  return t.get('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
}
