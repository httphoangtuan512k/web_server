import { HttpException, Injectable } from '@nestjs/common';
import { DbUser, displayName } from '../../auth/auth.types';
import { ApiError } from '../../common/api-error';
import { isDateKey, vnDateKey, vnStartOfDay } from '../../common/time';
import { DbService, Queryable, Row, TxQueryable } from '../../db/db.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sự kiện vận hành làm đơn xuất hiện trong danh sách Kho của ngày. */
const RUN_EVENTS = ['Bắt đầu chạy', 'Chạy tiếp', 'Chạy thêm máy'];

export type WarehouseCategory = 'goods' | 'packaging' | 'materials';
const CATEGORIES: WarehouseCategory[] = ['goods', 'packaging', 'materials'];
const isCategory = (c: string): c is WarehouseCategory => (CATEGORIES as string[]).includes(c);

/** Cột trả về cho từng loại – đúng dạng `SELECT *` của 3 bảng cũ warehouse_goods/packaging/materials. */
const ITEM_COLUMNS: Record<WarehouseCategory, string> = {
  goods: 'id, code, name, grain_size, unit, quantity, updated_at',
  packaging: 'id, name, lot_number, unit, quantity, updated_at',
  materials: 'id, shelf_number, name, unit, quantity, updated_at',
};

export interface GroupedOrder {
  key: string;
  orderId: string;
  orderNumber: string;
  packagingCode: string;
  grainSize: string;
  orderTotal: number;
  producedCumulative: number;
  machineNames: string[];
  status: string;
}

interface EntryTotals {
  repack: number;
  machines: Record<string, number>;
  entries: Array<{ id: number; created_at: Date; created_by: string; repack_qty: number; machines: Array<{ machine_name: string; quantity: number }> }>;
}

/** Ngày [00:00, 24:00) giờ VN dưới dạng mốc UTC. */
function vnDayRange(dateKey: string): [Date, Date] {
  const start = vnStartOfDay(dateKey);
  return [start, new Date(start.getTime() + DAY_MS)];
}

/** So sánh nhị phân như SQLite (ORDER BY mặc định). */
const binCmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function parseIntId(v: unknown): number | null {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

@Injectable()
export class WarehouseService {
  constructor(private readonly db: DbService) {}

  // ---------------------------------------------------------------------------------
  // Quyền & tiện ích
  // ---------------------------------------------------------------------------------
  /** = warehouseCanEdit cũ: Super Admin hoặc có quyền trang `kho_edit` (Admin thường cũng cần kho_edit). */
  canEdit(u: DbUser | null | undefined): boolean {
    if (!u || !u.isActive) return false;
    if (u.isSuper) return true;
    return (u.pagePermissions ?? []).includes('kho_edit');
  }

  /** = requireWarehouseEdit cũ. */
  requireEdit(u: DbUser) {
    if (!this.canEdit(u)) throw new ApiError(403, 'Bạn chưa được cấp quyền chỉnh sửa dữ liệu Kho.');
  }

  actor(u: DbUser): string {
    return u && u.isSuper ? 'Quản trị hệ thống' : (u && (u.fullName || u.username)) || '';
  }

  /** = warehouseDateKey cũ (mặc định: hôm nay theo giờ VN). */
  dateKey(value: unknown): string {
    const v = String(value ?? '');
    // Ngày không tồn tại (vd 2026-02-31) cũng coi như không hợp lệ để tránh lỗi ép kiểu date của Postgres.
    return isDateKey(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v ? v : vnDateKey();
  }

  /** Khóa theo ngày làm việc: tuần tự hóa nhập/sửa/xóa phiếu và chốt ngày của cùng một ngày. */
  private lockDate(t: TxQueryable, dateKey: string) {
    return t.get('SELECT pg_advisory_xact_lock(7202, hashtext(?))', ['warehouse_daily:' + dateKey]);
  }

  private async isClosed(q: Queryable, dateKey: string) {
    return !!(await q.get('SELECT 1 AS x FROM warehouse_daily_closings WHERE work_date=?', [dateKey]));
  }

  /** Bọc lỗi không mong đợi thành 500 với câu thông báo cũ (lỗi nghiệp vụ 4xx giữ nguyên). */
  private async wrap<T>(message: string, tag: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error(tag, e);
      throw new ApiError(500, message);
    }
  }

  private audit(q: Queryable, u: DbUser, actor: string, actionType: string, targetId: unknown, orderNumber: string, details: unknown) {
    return q.run(
      'INSERT INTO audit_logs(action_type,target_id,order_number,details,actor,actor_id) VALUES(?,?,?,?::jsonb,?,?)',
      [actionType, String(targetId), orderNumber || '', JSON.stringify(details), actor, u?.id ?? null],
    );
  }

  // ---------------------------------------------------------------------------------
  // Helper tính toán (port từ server cũ)
  // ---------------------------------------------------------------------------------
  /**
   * = warehouseSyncOrderProduction: sản lượng đơn = baseline + tổng phiếu Kho; ghi vào đơn đầu tiên của nhóm,
   * các đơn còn lại trong nhóm = 0. Khóa các dòng đơn của nhóm để tránh ghi chồng khi nhập đồng thời.
   */
  async syncOrderProduction(t: TxQueryable, orderKey: string): Promise<number> {
    const key = String(orderKey || '');
    if (!key) return 0;
    const rows = await t.all<{ id: string }>(
      'SELECT id FROM orders WHERE group_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END, created_at FOR UPDATE',
      [key, key],
    );
    const baseline = Number((await t.get('SELECT baseline_tons FROM warehouse_production_baselines WHERE order_key=?', [key]))?.baseline_tons) || 0;
    const total = await this.entryGrandTotal(t, key);
    const finalTotal = baseline + total;
    if (rows.length) {
      await t.run('UPDATE orders SET actual_produced=0 WHERE group_id=?', [key]);
      await t.run('UPDATE orders SET actual_produced=? WHERE id=?', [finalTotal, rows[0].id]);
    }
    return finalTotal;
  }

  /** Tổng sản lượng máy + sang bao của mọi phiếu Kho thuộc một đơn. */
  private async entryGrandTotal(q: Queryable, key: string): Promise<number> {
    const r = await q.get(
      `SELECT COALESCE(SUM(COALESCE(l.quantity,0)),0)
              + COALESCE((SELECT SUM(repack_qty) FROM warehouse_daily_entries WHERE order_key=?),0) AS total
         FROM warehouse_daily_entries h LEFT JOIN warehouse_daily_entry_lines l ON l.entry_id=h.id
        WHERE h.order_key=?`,
      [key, key],
    );
    return Number(r?.total) || 0;
  }

  /** = warehouseGroupedOrders: gộp đơn theo group_id (đơn mới nhất của nhóm làm đại diện). */
  async groupedOrders(q: Queryable): Promise<GroupedOrder[]> {
    const rows = await q.all(
      `SELECT id, group_id, order_number, packaging_code, grain_size, quantity, actual_produced, machine_name, status
         FROM orders ORDER BY created_at DESC`,
    );
    const map = new Map<string, GroupedOrder>();
    for (const o of rows) {
      const key = o.group_id || o.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          orderId: o.id,
          orderNumber: o.order_number,
          packagingCode: o.packaging_code || '',
          grainSize: o.grain_size || '',
          orderTotal: Number(o.quantity) || 0,
          producedCumulative: 0,
          machineNames: [],
          status: o.status,
        });
      }
      const x = map.get(key)!;
      x.orderTotal = Math.max(x.orderTotal, Number(o.quantity) || 0);
      x.producedCumulative += Number(o.actual_produced) || 0;
      if (o.machine_name && !x.machineNames.includes(o.machine_name)) x.machineNames.push(o.machine_name);
      if (o.status === 'running') x.status = 'running';
    }
    return [...map.values()];
  }

  /**
   * = warehouseSuggestedOrderKeys + warehouseDailyMachines (gộp 1 truy vấn):
   * các đơn có thao tác Bắt đầu chạy / Chạy tiếp / Chạy thêm máy trong ngày (giờ VN) và các máy tương ứng.
   */
  async dailyRunInfo(q: Queryable, dateKey: string): Promise<{ keys: Set<string>; machines: Map<string, string[]> }> {
    const [from, to] = vnDayRange(dateKey);
    const rows = await q.all<{ order_key: string; machine_name: string | null }>(
      `SELECT DISTINCT o.group_id AS order_key, e.machine_name
         FROM order_events e JOIN orders o ON o.id=e.order_id
        WHERE e.created_at >= ? AND e.created_at < ? AND e.event_type = ANY(?::text[])`,
      [from, to, RUN_EVENTS],
    );
    const keys = new Set<string>();
    const machines = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.order_key) continue;
      keys.add(r.order_key);
      if (!machines.has(r.order_key)) machines.set(r.order_key, []);
      const name = r.machine_name ?? '';
      if (name.trim() !== '' && !machines.get(r.order_key)!.includes(name)) machines.get(r.order_key)!.push(name);
    }
    for (const list of machines.values()) list.sort(binCmp);
    return { keys, machines };
  }

  /** = warehouseSuggestedOrderKeys. */
  async suggestedOrderKeys(q: Queryable, dateKey: string): Promise<Set<string>> {
    return (await this.dailyRunInfo(q, dateKey)).keys;
  }

  /** = warehouseDailyMachines. */
  async dailyMachines(q: Queryable, dateKey: string, orderKey: string): Promise<string[]> {
    return (await this.dailyRunInfo(q, dateKey)).machines.get(orderKey) ?? [];
  }

  /**
   * = warehouseProductionForDate (sản lượng 'Sửa Thực tế' trong ngày theo nhóm đơn).
   * Server cũ tính nhưng không dùng kết quả trong /api/warehouse/daily; giữ lại để tương thích.
   */
  async productionForDate(q: Queryable, dateKey: string): Promise<Map<string, number>> {
    const [from, to] = vnDayRange(dateKey);
    const rows = await q.all(
      `SELECT o.group_id AS order_key, SUM(COALESCE(h.new_value,0)-COALESCE(h.old_value,0)) AS produced
         FROM order_history h LEFT JOIN orders o ON o.id=h.order_id
        WHERE h.created_at >= ? AND h.created_at < ? AND h.action='Sửa Thực tế'
        GROUP BY o.group_id`,
      [from, to],
    );
    return new Map(rows.filter((x) => x.order_key).map((x) => [x.order_key as string, Math.max(0, Number(x.produced) || 0)]));
  }

  /** = warehouseDailyEntryTotals. */
  async dailyEntryTotals(q: Queryable, dateKey: string): Promise<Map<string, EntryTotals>> {
    const headers = await q.all('SELECT * FROM warehouse_daily_entries WHERE work_date=? ORDER BY id', [dateKey]);
    const lines = await q.all(
      `SELECT l.entry_id, l.machine_name, SUM(l.quantity) AS quantity
         FROM warehouse_daily_entry_lines l JOIN warehouse_daily_entries h ON h.id=l.entry_id
        WHERE h.work_date=? GROUP BY l.entry_id, l.machine_name ORDER BY l.entry_id, l.machine_name`,
      [dateKey],
    );
    const linesByEntry = new Map<number, Array<{ machine_name: string; quantity: number }>>();
    for (const l of lines) {
      if (!linesByEntry.has(l.entry_id)) linesByEntry.set(l.entry_id, []);
      linesByEntry.get(l.entry_id)!.push({ machine_name: l.machine_name, quantity: Number(l.quantity) || 0 });
    }
    const byOrder = new Map<string, EntryTotals>();
    for (const h of headers) {
      if (!byOrder.has(h.order_key)) byOrder.set(h.order_key, { repack: 0, machines: {}, entries: [] });
      const x = byOrder.get(h.order_key)!;
      x.repack += Number(h.repack_qty) || 0;
      const ls = linesByEntry.get(h.id) ?? [];
      for (const l of ls) x.machines[l.machine_name] = (x.machines[l.machine_name] || 0) + (Number(l.quantity) || 0);
      x.entries.push({ id: h.id, created_at: h.created_at, created_by: h.created_by, repack_qty: Number(h.repack_qty) || 0, machines: ls });
    }
    return byOrder;
  }

  // ---------------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------------
  async overview(u: DbUser) {
    const items = (category: WarehouseCategory, order: string) =>
      this.db.all(`SELECT ${ITEM_COLUMNS[category]} FROM warehouse_items WHERE category=? ORDER BY ${order}`, [category]);
    const [goods, packaging, materials, transactions, closingDates] = await Promise.all([
      items('goods', 'lower(name), id'),
      items('packaging', 'lower(name), lot_number, id'),
      items('materials', 'lower(shelf_number), id'),
      this.db.all(
        `SELECT id, category, item_id, item_name, action, quantity, note, created_by, created_at
           FROM warehouse_transactions ORDER BY created_at DESC, id DESC LIMIT 300`,
      ),
      this.db.all('SELECT work_date, created_by, closed_at FROM warehouse_daily_closings ORDER BY work_date DESC LIMIT 365'),
    ]);
    const canEdit = this.canEdit(u);
    return { isAdmin: canEdit, canEdit, isSuper: Boolean(u && u.isSuper), goods, packaging, materials, transactions, closingDates };
  }

  async snapshots() {
    try {
      const rows = await this.db.all(
        `SELECT DISTINCT ON (work_date) work_date, version, created_by, created_at
           FROM warehouse_daily_snapshots ORDER BY work_date DESC, version DESC, id DESC`,
      );
      return { rows };
    } catch (e) {
      console.error('[KHO] Lịch lưu trữ:', e);
      throw new ApiError(500, 'Không tải được lịch lưu trữ.');
    }
  }

  async daily(dateParam: unknown) {
    const dateKey = this.dateKey(dateParam);
    const closing = await this.db.get('SELECT * FROM warehouse_daily_closings WHERE work_date=?', [dateKey]);
    const latest = await this.db.get(
      'SELECT * FROM warehouse_daily_snapshots WHERE work_date=? ORDER BY version DESC, id DESC LIMIT 1',
      [dateKey],
    );
    if (closing && latest) {
      const snap: any = latest.snapshot || {};
      // Dữ liệu lịch sử lấy hoàn toàn từ ảnh chụp tại thời điểm chốt, không đọc lại bảng nhập hiện tại.
      const archived = new Map<string, any>();
      for (const h of snap.entries || []) {
        if (!archived.has(h.order_key)) archived.set(h.order_key, { order_key: h.order_key, repack: 0, machines: {}, entries: [] });
        const group = archived.get(h.order_key);
        group.repack += Number(h.repack_qty) || 0;
        for (const line of h.machines || []) {
          group.machines[line.machine_name] = (group.machines[line.machine_name] || 0) + (Number(line.quantity) || 0);
        }
        group.entries.push({ id: h.id, created_at: h.created_at, created_by: h.created_by, repack_qty: Number(h.repack_qty) || 0, machines: h.machines || [] });
      }
      return {
        date: dateKey,
        closed: true,
        createdBy: latest.created_by,
        closedAt: latest.created_at,
        version: latest.version,
        rows: snap.rows || [],
        suggestions: snap.suggestions || [],
        entries: [...archived.values()],
      };
    }
    // Tương thích lịch sử chốt cũ trước khi có ảnh chụp.
    if (closing) {
      const lines = await this.db.all('SELECT * FROM warehouse_daily_closing_lines WHERE closing_id=? ORDER BY order_number', [closing.id]);
      return { date: dateKey, closed: true, createdBy: closing.created_by, closedAt: closing.closed_at, rows: lines, suggestions: [], entries: [] };
    }

    const [run, allOrders, totals, priorRepack] = await Promise.all([
      this.dailyRunInfo(this.db, dateKey),
      this.groupedOrders(this.db),
      this.dailyEntryTotals(this.db, dateKey),
      this.db.all(
        `SELECT l.order_key, SUM(l.repack_today) AS total
           FROM warehouse_daily_closing_lines l JOIN warehouse_daily_closings c ON c.id=l.closing_id
          WHERE c.work_date < ? GROUP BY l.order_key`,
        [dateKey],
      ),
    ]);
    const picked = allOrders.filter((o) => run.keys.has(o.key));
    const notes = new Map<string, string>();
    if (picked.length) {
      const bl = await this.db.all('SELECT order_key, note FROM warehouse_production_baselines WHERE order_key = ANY(?::text[])', [picked.map((o) => o.key)]);
      for (const b of bl) notes.set(b.order_key, b.note || '');
    }
    const suggestions = picked.map((o) => ({
      order_key: o.key,
      order_number: o.orderNumber,
      packaging_code: o.packagingCode,
      grain_size: o.grainSize,
      order_total: o.orderTotal,
      status: o.status,
      produced_cumulative: o.producedCumulative,
      note: notes.get(o.key) || '',
      machines: run.machines.get(o.key) ?? [],
    }));
    const priorRepackMap = new Map<string, number>(priorRepack.map((x) => [x.order_key, Number(x.total) || 0]));
    const byKey = new Map(allOrders.map((o) => [o.key, o]));
    const rows = suggestions.map((o) => {
      const t = totals.get(o.order_key) || { repack: 0, machines: {}, entries: [] };
      const producedToday = Object.values(t.machines).reduce((a, b) => a + b, 0);
      const repackToday = t.repack;
      const producedCumulative = Number(byKey.get(o.order_key)?.producedCumulative) || 0;
      const repackCumulative = (priorRepackMap.get(o.order_key) || 0) + repackToday;
      return {
        ...o,
        produced_today: producedToday,
        produced_cumulative: producedCumulative,
        machine_totals: t.machines,
        repack_today: repackToday,
        repack_cumulative: repackCumulative,
        remaining: Math.max(0, o.order_total - producedCumulative),
        entries: t.entries,
      };
    });
    return {
      date: dateKey,
      closed: false,
      rows,
      suggestions,
      entries: [...totals.entries()].map(([order_key, v]) => ({ order_key, ...v })),
    };
  }

  /** Điều chỉnh trực tiếp sản lượng cộng dồn và ghi chú của đơn hàng tại Kho. */
  async adjustOrderProduction(u: DbUser, keyParam: string, b: any) {
    this.requireEdit(u);
    b = b || {};
    const key = String(keyParam || '').trim();
    const produced = Number(b.producedCumulative);
    const note = String(b.note || '').trim().slice(0, 1000);
    if (!key) throw new ApiError(400, 'Thiếu mã đơn hàng.');
    if (!Number.isFinite(produced) || produced < 0) throw new ApiError(400, 'Khối lượng đã sản xuất phải là số không âm.');
    const grouped = await this.db.get('SELECT order_number FROM orders WHERE group_id=? ORDER BY created_at DESC LIMIT 1', [key]);
    if (!grouped) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
    const actor = this.actor(u);
    await this.wrap('Không thể cập nhật sản lượng cộng dồn.', '[KHO] Điều chỉnh sản lượng cộng dồn:', () =>
      this.db.tx(async (t) => {
        const rows = await t.all<{ id: string }>(
          'SELECT id FROM orders WHERE group_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END, created_at FOR UPDATE',
          [key, key],
        );
        const entryTotal = await this.entryGrandTotal(t, key);
        const baseline = Math.max(0, produced - entryTotal);
        await t.run(
          `INSERT INTO warehouse_production_baselines(order_key,baseline_tons,note) VALUES(?,?,?)
           ON CONFLICT(order_key) DO UPDATE SET baseline_tons=excluded.baseline_tons, note=excluded.note`,
          [key, baseline, note],
        );
        if (rows.length) {
          await t.run('UPDATE orders SET actual_produced=0 WHERE group_id=?', [key]);
          await t.run('UPDATE orders SET actual_produced=? WHERE id=?', [produced, rows[0].id]);
        }
        await this.audit(t, u, actor, 'ADJUST_WAREHOUSE_CUMULATIVE', key, grouped.order_number, { producedCumulative: produced, note });
      }),
    );
    return { ok: true, producedCumulative: produced, note };
  }

  private cleanMachines(machines: any[], strict: boolean, message: string) {
    const cleaned: Array<{ name: string; qty: number }> = [];
    for (const m of machines) {
      const name = String(m?.machineName || '').trim();
      const qty = strict ? Number(m?.quantity) : Number(m?.quantity) || 0;
      if (!name || !Number.isFinite(qty) || qty < 0) throw new ApiError(400, message);
      if (qty > 0) cleaned.push({ name, qty });
    }
    return cleaned;
  }

  private async insertLines(t: TxQueryable, entryId: number, lines: Array<{ name: string; qty: number }>) {
    for (const m of lines) {
      await t.run('INSERT INTO warehouse_daily_entry_lines(entry_id,machine_name,quantity) VALUES(?,?,?)', [entryId, m.name, m.qty]);
    }
  }

  async createDailyEntry(u: DbUser, b: any) {
    this.requireEdit(u);
    b = b || {};
    const dateKey = this.dateKey(b.date);
    const orderKey = String(b.orderKey || '').trim();
    const now = new Date();
    const actor = this.actor(u);
    return this.wrap('Không thể lưu lần nhập.', '[KHO] Lưu nhập sản lượng:', () =>
      this.db.tx(async (t) => {
        await this.lockDate(t, dateKey);
        if (await this.isClosed(t, dateKey)) {
          throw new ApiError(409, 'Ngày đã chốt. Không thể nhập thêm; Admin có thể tạo bản chốt mới sau khi điều chỉnh dữ liệu trước khi chốt.');
        }
        if (!orderKey) throw new ApiError(400, 'Thiếu đơn hàng.');
        const allowed = await this.suggestedOrderKeys(t, dateKey);
        if (!allowed.has(orderKey)) throw new ApiError(400, 'Đơn hàng không nằm trong danh sách vận hành của ngày đã chọn.');
        const repack = Number(b.repackQty) || 0;
        if (!Number.isFinite(repack) || repack < 0) throw new ApiError(400, 'Khối lượng sang bao không hợp lệ.');
        const cleaned = this.cleanMachines(Array.isArray(b.machines) ? b.machines : [], false, 'Dữ liệu máy hoặc sản lượng không hợp lệ.');
        if (repack <= 0 && !cleaned.length) throw new ApiError(400, 'Hãy nhập sản lượng ít nhất một máy hoặc khối lượng sang bao.');
        const h = await t.get<{ id: number }>(
          `INSERT INTO warehouse_daily_entries(work_date,order_key,order_number,repack_qty,created_by,created_at)
           VALUES(?,?,?,?,?,?) RETURNING id`,
          [dateKey, orderKey, String(b.orderNumber || ''), repack, actor, now],
        );
        await this.insertLines(t, h!.id, cleaned);
        const actual = await this.syncOrderProduction(t, orderKey);
        return { ok: true, id: h!.id, actualProduced: actual, createdAt: now.toISOString(), createdBy: actor };
      }),
    );
  }

  async updateDailyEntry(u: DbUser, idParam: string, b: any) {
    this.requireEdit(u);
    b = b || {};
    const id = parseIntId(idParam);
    const now = new Date();
    const actor = this.actor(u);
    return this.wrap('Không thể cập nhật lần nhập Kho.', '[KHO] Sửa lần nhập:', () =>
      this.db.tx(async (t) => {
        const peek = id ? await t.get('SELECT work_date FROM warehouse_daily_entries WHERE id=?', [id]) : undefined;
        if (!peek) throw new ApiError(404, 'Không tìm thấy lần nhập Kho.');
        await this.lockDate(t, peek.work_date);
        const old = await t.get('SELECT * FROM warehouse_daily_entries WHERE id=? FOR UPDATE', [id]);
        if (!old) throw new ApiError(404, 'Không tìm thấy lần nhập Kho.');
        if (await this.isClosed(t, old.work_date)) throw new ApiError(409, 'Ngày đã chốt. Không thể sửa bản ghi đã chốt.');
        const repack = Number(b.repackQty);
        if (!Number.isFinite(repack) || repack < 0) throw new ApiError(400, 'Sản lượng sang bao không hợp lệ.');
        if (!Array.isArray(b.machines)) throw new ApiError(400, 'Thiếu danh sách sản lượng máy.');
        const cleaned = this.cleanMachines(b.machines, true, 'Tên máy hoặc sản lượng không hợp lệ.');
        if (repack <= 0 && !cleaned.length) throw new ApiError(400, 'Bản ghi phải có sản lượng máy hoặc sang bao lớn hơn 0.');
        await t.run('UPDATE warehouse_daily_entries SET repack_qty=?, created_by=?, created_at=? WHERE id=?', [repack, actor, now, id]);
        await t.run('DELETE FROM warehouse_daily_entry_lines WHERE entry_id=?', [id]);
        await this.insertLines(t, id!, cleaned);
        const total = await this.syncOrderProduction(t, old.order_key);
        await this.audit(t, u, actor, 'EDIT_WAREHOUSE_DAILY_ENTRY', id, old.order_number, {
          workDate: old.work_date,
          repackQty: repack,
          machines: cleaned,
          actualProduced: total,
        });
        return { ok: true, actualProduced: total };
      }),
    );
  }

  /** Xóa đúng một lần nhập kho; không ảnh hưởng đơn hàng hoặc sự kiện vận hành. */
  async deleteDailyEntry(u: DbUser, idParam: string) {
    this.requireEdit(u);
    const n = Number(idParam);
    if (!Number.isSafeInteger(n) || n <= 0) throw new ApiError(400, 'Mã lần nhập không hợp lệ.');
    const id = parseIntId(idParam);
    const actor = this.actor(u);
    return this.wrap('Không thể xóa lần nhập kho.', '[KHO] Xóa lần nhập:', () =>
      this.db.tx(async (t) => {
        const peek = id ? await t.get('SELECT work_date FROM warehouse_daily_entries WHERE id=?', [id]) : undefined;
        if (!peek) throw new ApiError(404, 'Không tìm thấy lần nhập kho.');
        await this.lockDate(t, peek.work_date);
        const entry = await t.get('SELECT * FROM warehouse_daily_entries WHERE id=? FOR UPDATE', [id]);
        if (!entry) throw new ApiError(404, 'Không tìm thấy lần nhập kho.');
        if (await this.isClosed(t, entry.work_date)) throw new ApiError(409, 'Ngày này đã chốt kho. Không thể xóa bản ghi.');
        const lines = await t.all('SELECT machine_name, quantity FROM warehouse_daily_entry_lines WHERE entry_id=? ORDER BY id', [id]);
        await t.run('DELETE FROM warehouse_daily_entry_lines WHERE entry_id=?', [id]);
        await t.run('DELETE FROM warehouse_daily_entries WHERE id=?', [id]);
        const actual = await this.syncOrderProduction(t, entry.order_key);
        await this.audit(t, u, actor, 'DELETE_WAREHOUSE_DAILY_ENTRY', id, entry.order_number || '', {
          entry,
          machines: lines,
          actualProducedAfterDelete: actual,
        });
        return { ok: true, id, workDate: entry.work_date, orderKey: entry.order_key };
      }),
    );
  }

  /** Chốt ngày: lưu ảnh chụp (phiên bản mới) của bảng Kho trong ngày. */
  async closeDay(u: DbUser, b: any) {
    this.requireEdit(u);
    const dateKey = this.dateKey(b && b.date);
    const now = new Date();
    const actor = this.actor(u);
    return this.wrap('Không thể lưu bản chốt ngày.', '[KHO] Lỗi chốt ngày:', () =>
      this.db.tx(async (t) => {
        await this.lockDate(t, dateKey);
        const [run, allOrders, totals] = await Promise.all([
          this.dailyRunInfo(t, dateKey),
          this.groupedOrders(t),
          this.dailyEntryTotals(t, dateKey),
        ]);
        const suggestions = allOrders
          .filter((o) => run.keys.has(o.key))
          .map((o) => ({
            order_key: o.key,
            order_number: o.orderNumber,
            packaging_code: o.packagingCode,
            grain_size: o.grainSize,
            order_total: o.orderTotal,
            status: o.status,
            produced_cumulative: o.producedCumulative,
            machines: run.machines.get(o.key) ?? [],
          }));
        const byKey = new Map(allOrders.map((o) => [o.key, o]));
        const rows = suggestions.map((o) => {
          const tt = totals.get(o.order_key) || { repack: 0, machines: {}, entries: [] };
          const produced = Object.values(tt.machines).reduce((a, c) => a + c, 0);
          const cumulative = Number(byKey.get(o.order_key)?.producedCumulative) || 0;
          return {
            ...o,
            produced_today: produced,
            produced_cumulative: cumulative,
            machine_totals: tt.machines,
            repack_today: tt.repack,
            remaining: Math.max(0, o.order_total - cumulative),
          };
        });
        const headers = await t.all('SELECT * FROM warehouse_daily_entries WHERE work_date=? ORDER BY id', [dateKey]);
        const lineRows = headers.length
          ? await t.all('SELECT entry_id, machine_name, quantity FROM warehouse_daily_entry_lines WHERE entry_id = ANY(?::int[]) ORDER BY id', [headers.map((h) => h.id)])
          : [];
        const entries = headers.map((h: Row) => ({
          ...h,
          machines: lineRows.filter((l) => l.entry_id === h.id).map((l) => ({ machine_name: l.machine_name, quantity: l.quantity })),
        }));

        const existing = await t.get<{ id: number }>('SELECT id FROM warehouse_daily_closings WHERE work_date=? FOR UPDATE', [dateKey]);
        let closingId: number;
        if (existing) {
          closingId = existing.id;
          await t.run('UPDATE warehouse_daily_closings SET created_by=?, closed_at=? WHERE id=?', [actor, now, closingId]);
        } else {
          const ins = await t.get<{ id: number }>(
            'INSERT INTO warehouse_daily_closings(work_date,created_by,closed_at) VALUES(?,?,?) RETURNING id',
            [dateKey, actor, now],
          );
          closingId = ins!.id;
        }
        const version = (Number((await t.get('SELECT MAX(version) AS v FROM warehouse_daily_snapshots WHERE work_date=?', [dateKey]))?.v) || 0) + 1;
        await t.run(
          'INSERT INTO warehouse_daily_snapshots(work_date,version,snapshot,created_by,created_at) VALUES(?,?,?::jsonb,?,?)',
          [dateKey, version, JSON.stringify({ rows, suggestions, entries }), actor, now],
        );
        await this.audit(t, u, actor, existing ? 'REClose_WAREHOUSE_DAILY' : 'CLOSE_WAREHOUSE_DAILY', closingId, '', {
          date: dateKey,
          version,
          rowCount: rows.length,
          entryCount: entries.length,
        });
        return { ok: true, date: dateKey, version };
      }),
    );
  }

  // ---------------------------------------------------------------------------------
  // Danh mục hàng hóa / bao bì / vật tư (bảng warehouse_items theo category)
  // ---------------------------------------------------------------------------------
  async createItem(u: DbUser, b: any) {
    this.requireEdit(u);
    b = b || {};
    const category = String(b.category || '');
    const name = String(b.name || '').trim();
    if (!isCategory(category) || !name) throw new ApiError(400, 'Thông tin danh mục không hợp lệ.');
    const qty = Number(b.quantity) || 0;
    return this.wrap('Không thể tạo danh mục.', '[KHO] Tạo danh mục:', async () => {
      let row: Row | undefined;
      if (category === 'goods') {
        row = await this.db.get(
          'INSERT INTO warehouse_items(category,code,name,grain_size,unit,quantity) VALUES(?,?,?,?,?,?) RETURNING id',
          [category, String(b.code || ''), name, String(b.grainSize || ''), String(b.unit || 'tấn'), qty],
        );
      } else if (category === 'packaging') {
        row = await this.db.get(
          'INSERT INTO warehouse_items(category,name,lot_number,unit,quantity) VALUES(?,?,?,?,?) RETURNING id',
          [category, name, String(b.lotNumber || ''), String(b.unit || 'bao'), qty],
        );
      } else {
        row = await this.db.get(
          'INSERT INTO warehouse_items(category,shelf_number,name,unit,quantity) VALUES(?,?,?,?,?) RETURNING id',
          [category, String(b.shelfNumber || '').trim(), name, String(b.unit || 'cái'), qty],
        );
      }
      return { ok: true, id: row!.id };
    });
  }

  async updateItem(u: DbUser, categoryParam: string, idParam: string, b: any) {
    this.requireEdit(u);
    b = b || {};
    const category = String(categoryParam);
    if (!isCategory(category)) throw new ApiError(400, 'Loại danh mục không hợp lệ.');
    const id = parseIntId(idParam);
    const qty = Number(b.quantity) || 0;
    return this.wrap('Không thể cập nhật danh mục.', '[KHO] Sửa danh mục:', async () => {
      if (id) {
        if (category === 'goods') {
          await this.db.run('UPDATE warehouse_items SET code=?,name=?,grain_size=?,unit=?,quantity=? WHERE id=? AND category=?', [
            String(b.code || ''), String(b.name || ''), String(b.grainSize || ''), String(b.unit || 'tấn'), qty, id, category,
          ]);
        } else if (category === 'packaging') {
          await this.db.run('UPDATE warehouse_items SET name=?,lot_number=?,unit=?,quantity=? WHERE id=? AND category=?', [
            String(b.name || ''), String(b.lotNumber || ''), String(b.unit || 'bao'), qty, id, category,
          ]);
        } else {
          await this.db.run('UPDATE warehouse_items SET shelf_number=?,name=?,unit=?,quantity=? WHERE id=? AND category=?', [
            String(b.shelfNumber || ''), String(b.name || ''), String(b.unit || 'cái'), qty, id, category,
          ]);
        }
      }
      return { ok: true };
    });
  }

  async deleteItem(u: DbUser, categoryParam: string, idParam: string) {
    this.requireEdit(u);
    const category = String(categoryParam);
    if (!isCategory(category)) throw new ApiError(400, 'Loại danh mục không hợp lệ.');
    const id = parseIntId(idParam);
    if (id) await this.db.run('DELETE FROM warehouse_items WHERE id=? AND category=?', [id, category]);
    return { ok: true };
  }

  async createTransaction(u: DbUser, b: any) {
    this.requireEdit(u);
    b = b || {};
    const category = String(b.category || '');
    const action = String(b.action || '');
    const qty = Number(b.quantity);
    if (!isCategory(category) || !['in', 'out'].includes(action) || !Number.isFinite(qty) || qty <= 0) {
      throw new ApiError(400, 'Thông tin nhập/xuất không hợp lệ.');
    }
    const id = parseIntId(b.itemId);
    const actor = displayName(u);
    return this.wrap('Không thể lưu giao dịch kho.', '[KHO] Giao dịch kho:', () =>
      this.db.tx(async (t) => {
        const item = id ? await t.get('SELECT * FROM warehouse_items WHERE id=? AND category=? FOR UPDATE', [id, category]) : undefined;
        if (!item) throw new ApiError(404, 'Không tìm thấy mặt hàng.');
        if (action === 'out' && Number(item.quantity) < qty) throw new ApiError(400, 'Số lượng tồn không đủ để xuất.');
        const next = Number(item.quantity) + (action === 'in' ? qty : -qty);
        await t.run('UPDATE warehouse_items SET quantity=? WHERE id=?', [next, id]);
        await t.run(
          'INSERT INTO warehouse_transactions(category,item_id,item_name,action,quantity,note,created_by) VALUES(?,?,?,?,?,?,?)',
          [category, id, item.name, action, qty, String(b.note || ''), actor],
        );
        await this.audit(t, u, actor, 'WAREHOUSE_STOCK_' + action.toUpperCase(), id, '', {
          category,
          item: item.name,
          quantity: qty,
          note: b.note || '',
        });
        return { ok: true, quantity: next };
      }),
    );
  }
}
