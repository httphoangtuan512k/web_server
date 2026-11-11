// File này: đồng bộ dữ liệu từ server cũ (SQLite) sang Postgres + Vercel Blob. Dùng ở: npm run db:import.
import './load-env';
/**
 * Đồng bộ dữ liệu từ server cũ (SQLite web/data/superwhite.db) sang Neon Postgres (schema mới) + Vercel Blob.
 *
 *   npm run db:import -- <superwhite.db> [--excel-dir <web/data/excel/files>] [--excel-db <postgres-url-cũ>] [--wipe]
 *
 * - Có thể chạy lại nhiều lần (vd: lần cuối trước khi chuyển hẳn sang hệ thống mới):
 *     + mặc định: chỉ thêm dòng chưa có (ON CONFLICT DO NOTHING)
 *     + --wipe : làm rỗng các bảng nghiệp vụ rồi import lại toàn bộ (dữ liệu tạo trên hệ thống mới sẽ mất!)
 * - Ảnh base64 -> Blob, tên file theo hash nội dung (không sinh file trùng khi chạy lại).
 * - Chuẩn hóa: chuỗi ngày ISO -> timestamptz, 0/1 -> boolean, JSON text -> jsonb, '' -> NULL cho khóa ngoại.
 * - 3 bảng hàng hóa / bao bì / vật tư gộp vào warehouse_items (id mới, giao dịch được ánh xạ lại).
 * - Bảng đời cũ warehouse_production_* được lưu nguyên vào legacy_records.
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { Pool, PoolClient } from 'pg';
import { BlobService } from '../src/blob/blob.service';
import { getPool } from '../src/db/db.service';

// R = một dòng dữ liệu bất kỳ (tên cột → giá trị).
type R = Record<string, any>;
// Tham số dòng lệnh; flag('--x') lấy giá trị đứng sau cờ --x.
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
// File SQLite = tham số đầu tiên không phải cờ (và không phải giá trị của --excel-*).
const sqlitePath = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--excel')));
// Có --wipe thì xóa sạch rồi import lại.
const WIPE = args.includes('--wipe');

// ------------------------------------------------------------------ chuẩn hóa giá trị
/** Chuỗi ngày giờ cũ → Date (rỗng/sai → null). */
const ts = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  // 'YYYY-MM-DD HH:MM:SS' (CURRENT_TIMESTAMP của SQLite) là giờ UTC.
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') + 'Z' : s);
  return Number.isNaN(d.getTime()) ? null : d;
};
// Chuẩn hóa: ngày (mặc định bây giờ), 0/1 → boolean, số, chuỗi, rỗng → null.
const tsNow = (v: unknown) => ts(v) ?? new Date();
const bool = (v: unknown) => v === 1 || v === '1' || v === true;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const nullIfEmpty = (v: unknown) => (v === null || v === undefined || v === '' ? null : v);
/** Đọc chuỗi JSON; rỗng thì dùng fallback, hỏng thì gói vào { raw }. */
const jsonOr = (v: unknown, fallback: unknown) => {
  if (v === null || v === undefined || v === '') return fallback;
  try {
    return JSON.parse(String(v));
  } catch {
    return { raw: String(v) };
  }
};
/** Chuỗi JSON → mảng chữ (vd danh sách quyền). */
const strArray = (v: unknown): string[] => {
  const x = jsonOr(v, []);
  return Array.isArray(x) ? x.map(String) : [];
};

// ------------------------------------------------------------------ helpers
/** Đánh dấu giá trị jsonb (để mảng JSON không bị pg hiểu thành mảng Postgres). */
class Json {
  constructor(readonly v: unknown) {}
}
// Bọc giá trị thành Json (null giữ nguyên).
const J = (v: unknown) => (v === null || v === undefined ? null : new Json(v));
/** INSERT một dòng; mặc định bỏ qua nếu đã có (chạy lại không trùng). Trả về dòng vừa thêm. */
async function insert(c: PoolClient, table: string, row: R, conflict = 'ON CONFLICT DO NOTHING') {
  // Cột = khóa của object; giá trị Json đổi thành chuỗi JSON.
  const cols = Object.keys(row);
  const values = cols.map((k) => (row[k] instanceof Json ? JSON.stringify(row[k].v) : row[k]));
  // Ghép câu INSERT với $1, $2… cho từng cột.
  const sql = `INSERT INTO "${table}" (${cols.map((c2) => `"${c2}"`).join(',')}) VALUES (${cols
    .map((_, i) => `$${i + 1}`)
    .join(',')}) ${conflict} RETURNING *`;
  return (await c.query(sql, values)).rows[0];
}
/** Đặt bộ đếm id tự tăng = id lớn nhất hiện có (vì đã chèn id cũ thủ công). */
async function resetIdentity(c: PoolClient, table: string, col = 'id') {
  await c.query(
    `SELECT setval(pg_get_serial_sequence('"${table}"','${col}'), GREATEST((SELECT COALESCE(MAX("${col}"),0) FROM "${table}"),1), (SELECT COUNT(*)>0 FROM "${table}"))`,
  );
}
/** Đếm số dòng trong bảng (để đối chiếu). */
const count = async (c: PoolClient, table: string, where = '') =>
  (await c.query(`SELECT COUNT(*)::int AS n FROM "${table}" ${where}`)).rows[0].n as number;

// ------------------------------------------------------------------ main
/** Đọc SQLite cũ, chèn lần lượt từng nhóm bảng vào Postgres trong 1 transaction. */
async function main() {
  // Mở file SQLite cũ (chỉ đọc).
  if (!sqlitePath || !existsSync(sqlitePath)) throw new Error('Cần đường dẫn tới superwhite.db');
  const lite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  // Danh sách bảng có trong SQLite; all() đọc cả bảng (không có bảng → rỗng).
  const has = new Set((lite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as R[]).map((r) => r.name));
  const all = (table: string, order = 'rowid'): R[] => (has.has(table) ? (lite.prepare(`SELECT * FROM "${table}" ORDER BY ${order}`).all() as R[]) : []);
  // Kết nối Blob, Postgres; mượn 1 kết nối riêng cho transaction.
  const blob = new BlobService();
  const pool = getPool();
  const c = await pool.connect();
  // Báo cáo: số dòng nguồn (SQLite) so với đích (Postgres).
  const report: R[] = [];
  const done = async (source: string, src: number, target: string, where = '') =>
    report.push({ source, sqlite: src, target, postgres: await count(c, target, where) });

  try {
    // Bắt đầu transaction: lỗi giữa chừng thì hủy toàn bộ.
    await c.query('BEGIN');
    // --wipe: làm rỗng mọi bảng nghiệp vụ, đặt lại bộ đếm id.
    if (WIPE) {
      await c.query(`TRUNCATE users, user_sessions, orders, order_history, order_events, audit_logs, maintenance_records,
        warehouse_items, warehouse_transactions, warehouse_daily_entries, warehouse_daily_entry_lines, warehouse_daily_closings,
        warehouse_daily_closing_lines, warehouse_daily_snapshots, warehouse_production_baselines, plc_devices, plc_machine_states,
        plc_telemetry_history, legacy_records RESTART IDENTITY CASCADE`);
      console.log('Đã làm rỗng các bảng nghiệp vụ.');
    }

    // users (+ order_status_permissions gộp vào users.order_permissions)
    // Gom quyền đơn hàng theo user (user_id → danh sách quyền).
    const orderPerms = new Map<number, string[]>();
    for (const p of all('order_status_permissions')) {
      orderPerms.set(p.user_id, [...(orderPerms.get(p.user_id) || []), String(p.status)]);
    }
    // Chèn từng user; avatar base64 được chuyển lên Blob.
    const users = all('users', 'id');
    let avatars = 0;
    for (const u of users) {
      const avatar = str(u.avatar).startsWith('data:') ? (avatars++, await blob.persistImage(u.avatar, 'avatars')) : str(u.avatar);
      await insert(c, 'users', {
        id: u.id,
        username: u.username,
        password_hash: u.password_hash,
        full_name: str(u.full_name),
        position: str(u.position),
        avatar_url: avatar,
        role: u.role === 'admin' ? 'admin' : 'user',
        is_super: bool(u.is_super),
        is_active: bool(u.active),
        page_permissions: strArray(u.page_permissions),
        order_permissions: orderPerms.get(u.id) || [],
        created_at: tsNow(u.created_at),
        updated_at: tsNow(u.created_at),
      });
    }
    // Đặt lại bộ đếm id và ghi báo cáo.
    await resetIdentity(c, 'users');
    await done(`users (+${orderPerms.size} quyền đơn, ${avatars} avatar)`, users.length, 'users');
    // userRef: id user còn tồn tại thì giữ, không thì null.
    const userIds = new Set(users.map((u) => u.id));
    const userRef = (v: unknown) => (userIds.has(Number(v)) ? Number(v) : null);

    // user_sessions
    const sessions = all('login_sessions', 'id');
    for (const s of sessions) {
      await insert(c, 'user_sessions', {
        id: s.id,
        session_key: s.session_key,
        user_id: userRef(s.user_id),
        username: s.username,
        full_name: str(s.full_name),
        role: str(s.role) || 'user',
        is_super: bool(s.is_super),
        login_at: tsNow(s.login_at),
        last_seen_at: tsNow(s.last_seen_at || s.login_at),
        logout_at: ts(s.logout_at),
        ip_address: str(s.ip_address),
        user_agent: str(s.user_agent),
      });
    }
    await resetIdentity(c, 'user_sessions');
    await done('login_sessions', sessions.length, 'user_sessions');

    // orders: chèn đơn gốc trước, đơn con sau (khóa ngoại parent_order_id)
    const orders = all('orders', 'created_at');
    // Sắp xếp: đơn gốc (không có parent) lên trước.
    const orderIds = new Set(orders.map((o) => o.id));
    orders.sort((a, b) => Number(!!nullIfEmpty(a.parent_order_id) && a.parent_order_id !== a.id) - Number(!!nullIfEmpty(b.parent_order_id) && b.parent_order_id !== b.id));
    // Chèn từng đơn; ảnh base64 → Blob; parent không hợp lệ → null.
    let orderImages = 0;
    for (const o of orders) {
      const img = str(o.image_data).startsWith('data:') ? (orderImages++, await blob.persistImage(o.image_data, 'orders')) : str(o.image_data);
      const parent = nullIfEmpty(o.parent_order_id);
      await insert(c, 'orders', {
        id: o.id,
        parent_order_id: parent && parent !== o.id && orderIds.has(parent) ? parent : null,
        order_number: str(o.order_number),
        item_code: str(o.item_code),
        packaging_code: str(o.packaging_code),
        quantity: num(o.quantity),
        image_url: img,
        whiteness: str(o.whiteness),
        grain_size: str(o.grain_size),
        bag_weight: str(o.bag_weight),
        coating_rate: str(o.coating_rate),
        stone_type: str(o.stone_type),
        impurity: str(o.impurity),
        pallet: str(o.pallet),
        extra_bag: str(o.extra_bag),
        order_command: str(o.order_command),
        machine_name: str(o.machine_name),
        run_on_machine: num(o.run_on_machine),
        actual_produced: num(o.actual_produced),
        kho_bu: num(o.kho_bu),
        status: ['new', 'running', 'completed'].includes(o.status) ? o.status : 'new',
        is_paused: bool(o.is_paused),
        export_date: str(o.export_date),
        creator_name: str(o.creator_name),
        runner_name: str(o.runner_name),
        confirmer_name: str(o.confirmer_name),
        kho_name: str(o.kho_name),
        created_by: userRef(o.created_by),
        updated_by: userRef(o.updated_by),
        created_at: tsNow(o.created_at),
        updated_at: tsNow(o.updated_at || o.created_at),
        completed_at: ts(o.completed_at) ?? (o.status === 'completed' ? ts(o.updated_at) : null),
      });
    }
    await done(`orders (${orderImages} ảnh)`, orders.length, 'orders');

    // order_history, order_events, audit_logs
    const hist = all('history_logs', 'id');
    for (const h of hist) {
      await insert(c, 'order_history', {
        id: h.id, order_id: str(h.order_id), order_number: str(h.order_number), machine_name: str(h.machine_name),
        user_name: str(h.user_name), action: str(h.action), old_value: num(h.old_value), new_value: num(h.new_value), created_at: tsNow(h.created_at),
      });
    }
    await resetIdentity(c, 'order_history');
    await done('history_logs', hist.length, 'order_history');

    const events = all('operation_events', 'id');
    for (const e of events) {
      await insert(c, 'order_events', {
        id: e.id, order_id: str(e.order_id), order_number: str(e.order_number), event_type: str(e.event_type), machine_name: str(e.machine_name),
        machine_count: num(e.machine_count), actual_tons: num(e.actual_tons), user_name: str(e.user_name), created_at: tsNow(e.created_at),
      });
    }
    await resetIdentity(c, 'order_events');
    await done('operation_events', events.length, 'order_events');

    const audits = all('audit_logs', 'id');
    for (const a of audits) {
      await insert(c, 'audit_logs', {
        id: a.id, action_type: str(a.action_type), target_id: a.target_id === null ? null : String(a.target_id), order_number: str(a.order_number),
        details: J(jsonOr(a.details, null)), actor: str(a.actor), created_at: tsNow(a.created_at),
      });
    }
    await resetIdentity(c, 'audit_logs');
    await done('audit_logs', audits.length, 'audit_logs');

    // maintenance_records
    const maint = all('maintenance_records', 'id');
    let maintImages = 0;
    for (const m of maint) {
      // Ảnh base64 → Blob, đếm số ảnh đã chuyển.
      const img = async (v: unknown) => (str(v).startsWith('data:') ? (maintImages++, await blob.persistImage(v, 'maintenance')) : str(v));
      await insert(c, 'maintenance_records', {
        id: m.id, equipment: str(m.equipment), fault_description: str(m.fault_description), fault_image_url: await img(m.fault_image),
        repair_content: str(m.repair_content), after_status: str(m.after_status), after_image_url: await img(m.after_image),
        created_by: str(m.created_by), created_at: tsNow(m.created_at), updated_at: ts(m.updated_at),
      });
    }
    await resetIdentity(c, 'maintenance_records');
    await done(`maintenance_records (${maintImages} ảnh)`, maint.length, 'maintenance_records');

    // warehouse_items (gộp 3 bảng) + transactions
    const itemMap = new Map<string, number>(); // `${category}:${oldId}` -> id mới
    // 3 bảng cũ → category mới + cột riêng từng loại (đơn vị mặc định).
    const sources: Array<[string, string, (r: R) => R]> = [
      ['warehouse_goods', 'goods', (r) => ({ code: str(r.code), grain_size: str(r.grain_size), unit: str(r.unit) || 'tấn' })],
      ['warehouse_packaging', 'packaging', (r) => ({ lot_number: str(r.lot_number), unit: str(r.unit) || 'bao' })],
      ['warehouse_materials', 'materials', (r) => ({ shelf_number: str(r.shelf_number), unit: str(r.unit) || 'cái' })],
    ];
    let itemCount = 0;
    // Tìm mặt hàng đã có (khi chạy lại); chưa có thì chèn; nhớ id cũ → id mới.
    for (const [table, category, extra] of sources) {
      for (const r of all(table, 'id')) {
        itemCount++;
        const existing = (
          await c.query(`SELECT id FROM warehouse_items WHERE category=$1 AND name=$2 AND code=$3 AND lot_number=$4 AND shelf_number=$5 LIMIT 1`, [
            category, str(r.name), str(r.code), str(r.lot_number), str(r.shelf_number),
          ])
        ).rows[0];
        const row = existing ?? (await insert(c, 'warehouse_items', {
          category, name: str(r.name), quantity: num(r.quantity), ...extra(r),
          created_at: tsNow(r.updated_at), updated_at: tsNow(r.updated_at),
        }));
        itemMap.set(`${category}:${r.id}`, row.id);
      }
    }
    await done('warehouse_goods/packaging/materials', itemCount, 'warehouse_items');

    // Giao dịch kho: đổi item_id cũ sang id mới.
    const txs = all('warehouse_transactions', 'id');
    for (const t of txs) {
      await insert(c, 'warehouse_transactions', {
        id: t.id, item_id: itemMap.get(`${t.category}:${t.item_id}`) ?? null, category: str(t.category), item_name: str(t.item_name),
        action: str(t.action), quantity: num(t.quantity), note: str(t.note), created_by: str(t.created_by), created_at: tsNow(t.created_at),
      });
    }
    await resetIdentity(c, 'warehouse_transactions');
    await done('warehouse_transactions', txs.length, 'warehouse_transactions');

    // warehouse daily
    const entries = all('warehouse_daily_entries', 'id');
    for (const e of entries) {
      await insert(c, 'warehouse_daily_entries', {
        id: e.id, work_date: str(e.work_date), order_key: str(e.order_key), order_number: str(e.order_number), repack_qty: num(e.repack_qty),
        created_by: str(e.created_by), created_at: tsNow(e.created_at),
      });
    }
    await resetIdentity(c, 'warehouse_daily_entries');
    await done('warehouse_daily_entries', entries.length, 'warehouse_daily_entries');

    const lines = all('warehouse_daily_entry_lines', 'id');
    for (const l of lines) {
      await insert(c, 'warehouse_daily_entry_lines', { id: l.id, entry_id: l.entry_id, machine_name: str(l.machine_name), quantity: num(l.quantity) });
    }
    await resetIdentity(c, 'warehouse_daily_entry_lines');
    await done('warehouse_daily_entry_lines', lines.length, 'warehouse_daily_entry_lines');

    const closings = all('warehouse_daily_closings', 'id');
    for (const k of closings) {
      await insert(c, 'warehouse_daily_closings', { id: k.id, work_date: str(k.work_date), created_by: str(k.created_by), closed_at: tsNow(k.closed_at) });
    }
    await resetIdentity(c, 'warehouse_daily_closings');
    await done('warehouse_daily_closings', closings.length, 'warehouse_daily_closings');

    const closingLines = all('warehouse_daily_lines', 'id');
    for (const l of closingLines) {
      await insert(c, 'warehouse_daily_closing_lines', {
        id: l.id, closing_id: l.closing_id, order_key: str(l.order_key), order_number: str(l.order_number), packaging_code: str(l.packaging_code),
        grain_size: str(l.grain_size), order_total: num(l.order_total), produced_today: num(l.produced_today), produced_cumulative: num(l.produced_cumulative),
        machine_names: str(l.machine_names), repack_today: num(l.repack_today), repack_cumulative: num(l.repack_cumulative), remaining: num(l.remaining),
      });
    }
    await resetIdentity(c, 'warehouse_daily_closing_lines');
    await done('warehouse_daily_lines', closingLines.length, 'warehouse_daily_closing_lines');

    const snaps = all('warehouse_daily_snapshots', 'id');
    for (const s of snaps) {
      await insert(c, 'warehouse_daily_snapshots', {
        id: s.id, work_date: str(s.work_date), version: Number(s.version) || 1, snapshot: J(jsonOr(s.snapshot_json, {})),
        created_by: str(s.created_by), created_at: tsNow(s.created_at),
      });
    }
    await resetIdentity(c, 'warehouse_daily_snapshots');
    await done('warehouse_daily_snapshots', snaps.length, 'warehouse_daily_snapshots');

    const baselines = all('warehouse_order_production_baseline');
    for (const b of baselines) {
      await insert(c, 'warehouse_production_baselines', {
        order_key: str(b.order_key), baseline_tons: num(b.baseline_tons), note: str(b.note), initialized_at: tsNow(b.initialized_at),
      });
    }
    await done('warehouse_order_production_baseline', baselines.length, 'warehouse_production_baselines');

    // bảng kho đời cũ -> legacy_records
    let legacy = 0;
    for (const t of ['warehouse_production_entries', 'warehouse_production_reports', 'warehouse_production_report_lines']) {
      for (const r of all(t)) {
        // Chỉ thêm nếu chưa lưu dòng này.
        const exists = await c.query(`SELECT 1 FROM legacy_records WHERE source_table=$1 AND data->>'id'=$2`, [t, String(r.id)]);
        if (!exists.rowCount) await insert(c, 'legacy_records', { source_table: t, data: J(r) });
        legacy++;
      }
    }
    await done('warehouse_production_* (đời cũ)', legacy, 'legacy_records');

    // PLC
    const DEVICE = 'MAY_B';
    // Lấy API key và bản tin mới nhất của máy B từ SQLite.
    const key = has.has('plc_api_keys') ? (lite.prepare('SELECT * FROM plc_api_keys WHERE device_id=?').get(DEVICE) as R | undefined) : undefined;
    const last = has.has('plc_telemetry_history')
      ? (lite.prepare('SELECT * FROM plc_telemetry_history WHERE device_id=? ORDER BY id DESC LIMIT 1').get(DEVICE) as R | undefined)
      : undefined;
    // Thêm/cập nhật thiết bị PLC, giữ bản tin và mốc thời gian mới hơn.
    await insert(
      c,
      'plc_devices',
      {
        device_id: DEVICE,
        api_key_hash: key?.key_hash ?? null,
        api_key_active: key ? bool(key.active) : false,
        api_key_created_at: ts(key?.created_at),
        api_key_revoked_at: ts(key?.revoked_at),
        last_payload: last ? J(jsonOr(last.payload_json, null)) : null,
        last_received_at: ts(last?.received_at),
        last_history_at: ts(last?.received_at),
      },
      `ON CONFLICT (device_id) DO UPDATE SET api_key_hash=EXCLUDED.api_key_hash, api_key_active=EXCLUDED.api_key_active,
        api_key_created_at=EXCLUDED.api_key_created_at, api_key_revoked_at=EXCLUDED.api_key_revoked_at,
        last_payload=COALESCE(EXCLUDED.last_payload, plc_devices.last_payload),
        last_received_at=GREATEST(EXCLUDED.last_received_at, plc_devices.last_received_at),
        last_history_at=GREATEST(EXCLUDED.last_history_at, plc_devices.last_history_at)`,
    );
    // Trạng thái tính toán từng máy.
    const states = all('plc_operation_state');
    for (const s of states) {
      await insert(c, 'plc_machine_states', { machine_id: s.machine_id, device_id: DEVICE, state: J(jsonOr(s.state_json, {})), updated_at: tsNow(s.updated_at) });
    }
    await done('plc_operation_state', states.length, 'plc_machine_states');

    // Lịch sử bản tin PLC.
    const history = all('plc_telemetry_history', 'id');
    for (const h of history) {
      await insert(c, 'plc_telemetry_history', {
        id: h.id, device_id: str(h.device_id) || DEVICE, received_at: tsNow(h.received_at), payload: J(jsonOr(h.payload_json, {})),
      });
    }
    await resetIdentity(c, 'plc_telemetry_history');
    await done('plc_telemetry_history', history.length, 'plc_telemetry_history');

    // Mọi thứ OK → lưu chính thức.
    await c.query('COMMIT');
  } catch (e) {
    // Lỗi → hủy toàn bộ thay đổi.
    await c.query('ROLLBACK');
    throw e;
  } finally {
    // Luôn trả kết nối về hồ.
    c.release();
  }

  // Import tài liệu Excel (ngoài transaction), rồi in báo cáo.
  await importDocuments(blob, pool, report);
  console.table(report);
  // Cảnh báo bảng nào ở Postgres ít dòng hơn SQLite.
  const bad = report.filter((r) => r.postgres < r.sqlite && !String(r.source).includes('goods/packaging'));
  console.log(bad.length ? `⚠ Kiểm tra lại: ${bad.map((b) => b.target).join(', ')}` : '✅ Import hoàn tất, số dòng khớp.');
  await pool.end();
}

/** Kho tài liệu Excel: file trên đĩa (+ metadata từ Postgres cũ nếu có) -> Blob + bảng documents. */
async function importDocuments(blob: BlobService, pool: Pool, report: R[]) {
  // Không có --excel-dir thì bỏ qua.
  const dir = flag('--excel-dir');
  if (!dir || !existsSync(dir)) return;
  // Đuôi file → loại MIME Excel.
  const mimeByExt: Record<string, string> = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.xls': 'application/vnd.ms-excel',
    '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  };
  // Có --excel-db: đọc metadata và quyền tài liệu từ Postgres cũ.
  const oldMeta = new Map<string, R>();
  const oldPerms: R[] = [];
  const oldUrl = flag('--excel-db');
  if (oldUrl) {
    const old = new Pool({ connectionString: oldUrl });
    for (const r of (await old.query('SELECT * FROM excel_files WHERE is_deleted=FALSE')).rows) oldMeta.set(r.stored_name, r);
    oldPerms.push(...(await old.query('SELECT * FROM excel_permissions')).rows);
    await old.end();
  }
  // Chủ sở hữu mặc định = Super Admin đầu tiên.
  const owner = (await pool.query(`SELECT id, COALESCE(NULLIF(full_name,''),username) AS name FROM users WHERE is_super ORDER BY id LIMIT 1`)).rows[0];
  // Chỉ lấy file Excel trong thư mục.
  const files = readdirSync(dir).filter((n) => mimeByExt[extname(n).toLowerCase()]);
  for (const name of files) {
    const ext = extname(name).toLowerCase();
    const meta = oldMeta.get(name);
    // id tài liệu: từ metadata cũ, hoặc UUID đầu tên file, hoặc tạo mới.
    const id = meta?.id || /^[0-9a-f-]{36}/i.exec(name)?.[0] || randomUUID();
    // Đã import rồi thì bỏ qua.
    if ((await pool.query('SELECT 1 FROM documents WHERE id=$1', [id])).rowCount) continue;
    // Đọc file, tải lên Blob rồi ghi dòng documents.
    const buf = readFileSync(join(dir, name));
    const saved = await blob.put(`documents/${id}${ext}`, buf, mimeByExt[ext], { random: false });
    await pool.query(
      `INSERT INTO documents(id, original_name, blob_pathname, mime_type, size_bytes, owner_id, owner_name, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, NOW()),COALESCE($9::timestamptz, NOW()))`,
      [id, meta?.original_name || `Tài liệu ${String(id).slice(0, 8)}${ext}`, saved.pathname, mimeByExt[ext], buf.length,
        meta?.owner_user_id ?? owner?.id ?? null, meta?.owner_name ?? owner?.name ?? '', meta?.created_at ?? null, meta?.updated_at ?? null],
    );
  }
  // Chép quyền tài liệu (chỉ khi tài liệu và user đều tồn tại).
  for (const p of oldPerms) {
    await pool.query(
      `INSERT INTO document_permissions(document_id,user_id,permission,granted_by,granted_at) SELECT $1,$2,$3,$4,$5
       WHERE EXISTS (SELECT 1 FROM documents WHERE id=$1) AND EXISTS (SELECT 1 FROM users WHERE id=$2) ON CONFLICT DO NOTHING`,
      [p.file_id, p.user_id, p.permission, p.granted_by, p.granted_at],
    );
  }
  // Ghi kết quả vào báo cáo.
  report.push({ source: 'data/excel/files', sqlite: files.length, target: 'documents', postgres: (await pool.query('SELECT COUNT(*)::int n FROM documents')).rows[0].n });
}

// Chạy; lỗi thì in ra và thoát mã 1.
main().catch((e) => {
  console.error('Import lỗi:', e);
  process.exit(1);
});
