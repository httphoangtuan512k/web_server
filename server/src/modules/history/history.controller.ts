/**
 * File này: API lịch sử thao tác đơn /api/history (xem, Super Admin sửa/xóa) và nhật ký theo ngày /api/logs (admin).
 * Dùng ở: trang Quản trị > Nhật ký (quan-tri/nhat-ky), trang Vận hành (khung lịch sử).
 */
import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import type { DbUser } from '../../auth/auth.types';
import { CurrentUser, RequireAdmin } from '../../auth/decorators';
import { ApiError } from '../../common/api-error';
import { isDateKey, vnDateKey, vnDateTime, vnStartOfDay } from '../../common/time';
import { DbService, Row } from '../../db/db.service';

/** Tên người thao tác: họ tên, thiếu thì tên đăng nhập. */
const actorName = (u: DbUser) => u.fullName || u.username;

/** Dòng order_history dạng JSON thuần (giống history_logs cũ, thời gian ISO). */
const plainHistory = (r: Row) => ({
  ...r,
  created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
});

@Controller('api/history')
export class HistoryController {
  constructor(private readonly db: DbService) {}

  /** GET /api/history – 50 dòng lịch sử thao tác mới nhất (ai đăng nhập cũng xem được). */
  @Get()
  async list() {
    return this.db.all('SELECT * FROM order_history ORDER BY created_at DESC LIMIT 50');
  }

  // Chỉ Super Admin được sửa/xóa bản ghi lịch sử.
  /** PATCH /api/history/:id – sửa 1 bản ghi lịch sử và ghi audit trước/sau. */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    if (!u || !u.isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được sửa lịch sử.');
    const b = body ?? {};
    const hid = Number(id);
    // Transaction: sửa + ghi audit cùng thành công hoặc cùng hủy.
    return this.db.tx(async (t) => {
      // Khóa bản ghi cần sửa (id phải là số nguyên).
      const old = Number.isSafeInteger(hid) ? await t.get('SELECT * FROM order_history WHERE id = ? FOR UPDATE', [hid]) : undefined;
      if (!old) throw new ApiError(404, 'Không tìm thấy bản ghi lịch sử.');

      // Chỉ nhận các trường cho phép có trong body.
      const allowed = ['order_number', 'machine_name', 'user_name', 'action', 'old_value', 'new_value', 'created_at'];
      const updates: Record<string, string> = {};
      for (const key of allowed) if (Object.prototype.hasOwnProperty.call(b, key)) updates[key] = String(b[key] ?? '');
      if (!Object.keys(updates).length) throw new ApiError(400, 'Không có dữ liệu thay đổi.');

      // Gộp bản cũ + thay đổi; các trường chính không được trống.
      const before = plainHistory(old);
      const next: Row = { ...before, ...updates };
      if (!String(next.order_number).trim() || !String(next.user_name).trim() || !String(next.action).trim() || !String(next.created_at).trim()) {
        throw new ApiError(400, 'Số đơn, người thao tác, hành động và thời gian không được để trống.');
      }
      // Postgres: old_value/new_value là số, created_at là timestamptz.
      for (const k of ['old_value', 'new_value']) {
        const raw = next[k];
        // Trống → 0; không phải số → 400.
        if (raw === null || raw === undefined || String(raw).trim() === '') next[k] = 0;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n)) throw new ApiError(400, 'Giá trị cũ/mới phải là số.');
          next[k] = n;
        }
      }
      // Kiểm thời gian hợp lệ.
      const createdAt = new Date(String(next.created_at).trim());
      if (Number.isNaN(createdAt.getTime())) throw new ApiError(400, 'Thời gian không hợp lệ.');
      next.created_at = createdAt.toISOString();

      // Ghi bản sửa vào DB.
      await t.run(
        `UPDATE order_history SET order_number = ?, machine_name = ?, user_name = ?, action = ?, old_value = ?, new_value = ?, created_at = ? WHERE id = ?`,
        [next.order_number, next.machine_name, next.user_name, next.action, next.old_value, next.new_value, createdAt, old.id],
      );
      // Ghi audit EDIT_HISTORY (trước/sau).
      await t.run(
        `INSERT INTO audit_logs (action_type, target_id, order_number, details, actor, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['EDIT_HISTORY', String(old.id), old.order_number, JSON.stringify({ before, after: next }), actorName(u), u.id, new Date()],
      );
      return { ok: true };
    });
  }

  /** DELETE /api/history/:id – Super Admin xóa 1 bản ghi lịch sử, lưu bản đã xóa vào audit. */
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: DbUser) {
    if (!u || !u.isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được xóa lịch sử.');
    const hid = Number(id);
    return this.db.tx(async (t) => {
      // Khóa bản ghi; không có → 404.
      const old = Number.isSafeInteger(hid) ? await t.get('SELECT * FROM order_history WHERE id = ? FOR UPDATE', [hid]) : undefined;
      if (!old) throw new ApiError(404, 'Không tìm thấy bản ghi lịch sử.');
      // Xóa rồi ghi audit DELETE_HISTORY.
      await t.run('DELETE FROM order_history WHERE id = ?', [old.id]);
      await t.run(
        `INSERT INTO audit_logs (action_type, target_id, order_number, details, actor, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['DELETE_HISTORY', String(old.id), old.order_number, JSON.stringify({ deleted: plainHistory(old) }), actorName(u), u.id, new Date()],
      );
      return { ok: true };
    });
  }
}

// =====================================================================================
// NHẬT KÝ THEO NGÀY: GET /api/logs?date=YYYY-MM-DD (admin)
// =====================================================================================
/** Một dòng nhật ký trả cho trang: nguồn history (thao tác) / event (vận hành) / audit (kiểm toán). */
export interface LogItem {
  id: string;
  source: 'history' | 'event' | 'audit';
  time: string;
  actor: string;
  action: string;
  orderNumber: string;
  machineName: string;
  detail: string;
  oldValue: number | null;
  newValue: number | null;
}

// Mã audit → nhãn tiếng Việt hiển thị.
const AUDIT_LABELS: Record<string, string> = {
  EDIT_HISTORY: 'Sửa lịch sử',
  DELETE_HISTORY: 'Xóa lịch sử',
  EDIT_ORDER_CREATED_AT: 'Sửa ngày tạo đơn',
  CLOSE_WAREHOUSE_DAILY: 'Chốt kho cuối ngày',
  RECLOSE_WAREHOUSE_DAILY: 'Chốt lại kho cuối ngày',
  ADJUST_WAREHOUSE_CUMULATIVE: 'Điều chỉnh lũy kế sản lượng',
  EDIT_WAREHOUSE_DAILY_ENTRY: 'Sửa phiếu nhập kho',
  DELETE_WAREHOUSE_DAILY_ENTRY: 'Xóa phiếu nhập kho',
  WAREHOUSE_STOCK_IN: 'Nhập kho',
  WAREHOUSE_STOCK_OUT: 'Xuất kho',
  EDIT_MAINTENANCE: 'Sửa bảo trì',
  DELETE_MAINTENANCE: 'Xóa bảo trì',
};

// Tên cột order_history → tên tiếng Việt (dùng khi mô tả "đã sửa gì").
const HISTORY_FIELD_LABELS: Record<string, string> = {
  order_number: 'số đơn',
  machine_name: 'máy',
  user_name: 'người thao tác',
  action: 'hành động',
  old_value: 'giá trị cũ',
  new_value: 'giá trị mới',
  created_at: 'thời gian',
};

/** Định dạng số kiểu VN (vd 1.234,5); không phải số thì giữ nguyên chữ. */
const fmtNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : String(v ?? '');
};
/** Định dạng thời gian theo giờ VN; sai định dạng thì giữ nguyên. */
const fmtTime = (v: unknown) => {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : vnDateTime(d);
};
/** Là số khác 0? */
const nz = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};
/** Đổi sang số; trống/không phải số → null. */
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** Cắt chuỗi dài quá n ký tự, thêm "…". */
const clip = (s: string, n = 300) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Mô tả dòng lịch sử thao tác: "cũ → mới" nếu có số. */
function historyDetail(r: Row): string {
  const parts: string[] = [];
  if (nz(r.old_value) || nz(r.new_value)) parts.push(`${fmtNum(r.old_value)} → ${fmtNum(r.new_value)}`);
  return parts.join(' · ');
}

/** Mô tả sự kiện vận hành: số máy, sản lượng (nếu có). */
function eventDetail(r: Row): string {
  const parts: string[] = [];
  if (nz(r.machine_count)) parts.push(`Số máy: ${fmtNum(r.machine_count)}`);
  if (nz(r.actual_tons)) parts.push(`Sản lượng: ${fmtNum(r.actual_tons)} tấn`);
  return parts.join(' · ');
}

/** Dịch chi tiết audit (JSON) thành câu dễ đọc theo từng loại; loại lạ → hiện JSON rút gọn. */
function auditDetail(type: string, target: string | null, d: any): { detail: string; machineName: string } {
  const obj = d && typeof d === 'object' ? d : null;
  try {
    switch (type) {
      // Sửa lịch sử: liệt kê trường thay đổi "cũ → mới".
      case 'EDIT_HISTORY': {
        const before = obj?.before || {};
        const after = obj?.after || {};
        const changes = Object.keys(HISTORY_FIELD_LABELS)
          .filter((k) => String(before[k] ?? '') !== String(after[k] ?? ''))
          .map((k) => {
            const f = k === 'created_at' ? fmtTime : (x: unknown) => String(x ?? '');
            return `${HISTORY_FIELD_LABELS[k]}: ${f(before[k]) || '(trống)'} → ${f(after[k]) || '(trống)'}`;
          });
        return {
          detail: `Bản ghi #${target ?? before.id ?? ''}` + (before.action ? ` (${before.action})` : '') + (changes.length ? ` – ${changes.join('; ')}` : ' – không đổi'),
          machineName: String(after.machine_name ?? before.machine_name ?? ''),
        };
      }
      // Xóa lịch sử: tóm tắt bản ghi đã xóa.
      case 'DELETE_HISTORY': {
        const x = obj?.deleted || {};
        const val = nz(x.old_value) || nz(x.new_value) ? `, ${fmtNum(x.old_value)} → ${fmtNum(x.new_value)}` : '';
        return {
          detail: `Bản ghi #${target ?? x.id ?? ''}: ${x.action ?? ''} – ${x.user_name ?? ''}, ${fmtTime(x.created_at)}${val}`,
          machineName: String(x.machine_name ?? ''),
        };
      }
      // Sửa ngày tạo đơn.
      case 'EDIT_ORDER_CREATED_AT':
        return { detail: `Ngày tạo: ${fmtTime(obj?.before)} → ${fmtTime(obj?.after)}`, machineName: '' };
      // Chốt / chốt lại kho cuối ngày.
      case 'CLOSE_WAREHOUSE_DAILY':
      case 'RECLOSE_WAREHOUSE_DAILY':
        return {
          detail: `Ngày ${obj?.date ?? ''}` + (obj?.version ? `, phiên bản ${obj.version}` : '') + (obj?.rowCount !== undefined ? `, ${obj.rowCount} dòng` : ''),
          machineName: '',
        };
      // Điều chỉnh lũy kế sản lượng.
      case 'ADJUST_WAREHOUSE_CUMULATIVE':
        return { detail: `Lũy kế: ${fmtNum(obj?.producedCumulative)} tấn` + (obj?.note ? ` – ${obj.note}` : ''), machineName: '' };
      // Sửa / xóa phiếu nhập kho: ngày, tổng sản lượng, danh sách máy.
      case 'EDIT_WAREHOUSE_DAILY_ENTRY':
      case 'DELETE_WAREHOUSE_DAILY_ENTRY': {
        const entry = obj?.entry || {};
        const date = obj?.workDate || entry.work_date || '';
        const machines: any[] = Array.isArray(obj?.machines) ? obj.machines : [];
        const names = machines.map((m) => m?.machine_name || m?.machineName).filter(Boolean);
        const total = obj?.actualProduced ?? obj?.actualProducedAfterDelete;
        return {
          detail:
            `Phiếu #${target ?? ''}` + (date ? ` ngày ${date}` : '') + (total !== undefined ? `, tổng sản lượng ${fmtNum(total)} tấn` : ''),
          machineName: [...new Set(names)].join(', '),
        };
      }
      // Nhập / xuất kho.
      case 'WAREHOUSE_STOCK_IN':
      case 'WAREHOUSE_STOCK_OUT':
        return {
          detail: `${type.endsWith('IN') ? 'Nhập' : 'Xuất'} ${fmtNum(obj?.quantity)} – ${obj?.item ?? ''}` + (obj?.note ? ` (${obj.note})` : ''),
          machineName: '',
        };
      // Sửa / xóa phiếu bảo trì: tên thiết bị.
      case 'EDIT_MAINTENANCE':
      case 'DELETE_MAINTENANCE': {
        const x = obj?.before || obj?.deleted || {};
        return { detail: `Thiết bị: ${x.equipment ?? ''}`, machineName: '' };
      }
    }
  } catch {
    /* rơi xuống mặc định */
  }
  // Mặc định: không có chi tiết → rỗng; có → hiện chuỗi/JSON cắt ngắn.
  if (d === null || d === undefined || d === '') return { detail: '', machineName: '' };
  return { detail: clip(typeof d === 'string' ? d : JSON.stringify(d)), machineName: '' };
}

@Controller('api/logs')
export class LogsController {
  constructor(private readonly db: DbService) {}

  /** GET /api/logs?date=YYYY-MM-DD – mọi nhật ký trong 1 ngày (giờ VN), mới nhất trước; chỉ admin. */
  @Get()
  @RequireAdmin()
  async list(@Query('date') dateParam?: string) {
    // Không truyền ngày → hôm nay; ngày sai → 400.
    const date = dateParam === undefined || dateParam === '' ? vnDateKey() : String(dateParam);
    if (!isDateKey(date) || Number.isNaN(vnStartOfDay(date).getTime()) || vnDateKey(vnStartOfDay(date)) !== date) throw new ApiError(400, 'Ngày không hợp lệ.');
    // Khoảng thời gian: 0h ngày đó → 0h ngày hôm sau.
    const from = vnStartOfDay(date);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const range = [from, to];

    // Đọc song song 3 bảng (Promise.all = chạy cùng lúc, chờ cả 3 xong).
    const [history, events, audits] = await Promise.all([
      this.db.all('SELECT * FROM order_history WHERE created_at >= ? AND created_at < ?', range),
      this.db.all('SELECT * FROM order_events WHERE created_at >= ? AND created_at < ?', range),
      this.db.all('SELECT * FROM audit_logs WHERE created_at >= ? AND created_at < ?', range),
    ]);

    // Đổi 3 nguồn về cùng dạng LogItem (_t, _n chỉ dùng để sắp xếp).
    const items: (LogItem & { _t: number; _n: number })[] = [
      // Lịch sử thao tác.
      ...history.map((r) => ({
        id: `history-${r.id}`,
        source: 'history' as const,
        time: (r.created_at as Date).toISOString(),
        actor: r.user_name || '',
        action: r.action || '',
        orderNumber: r.order_number || '',
        machineName: r.machine_name || '',
        detail: historyDetail(r),
        oldValue: numOrNull(r.old_value),
        newValue: numOrNull(r.new_value),
        _t: (r.created_at as Date).getTime(),
        _n: Number(r.id),
      })),
      // Sự kiện vận hành.
      ...events.map((r) => ({
        id: `event-${r.id}`,
        source: 'event' as const,
        time: (r.created_at as Date).toISOString(),
        actor: r.user_name || '',
        action: r.event_type || '',
        orderNumber: r.order_number || '',
        machineName: r.machine_name || '',
        detail: eventDetail(r),
        oldValue: null,
        newValue: null,
        _t: (r.created_at as Date).getTime(),
        _n: Number(r.id),
      })),
      // Audit: dịch mã + chi tiết sang tiếng Việt.
      ...audits.map((r) => {
        const type = String(r.action_type || '');
        const { detail, machineName } = auditDetail(type.toUpperCase(), r.target_id, r.details);
        return {
          id: `audit-${r.id}`,
          source: 'audit' as const,
          time: (r.created_at as Date).toISOString(),
          actor: r.actor || '',
          action: AUDIT_LABELS[type.toUpperCase()] || type,
          orderNumber: r.order_number || '',
          machineName,
          detail,
          oldValue: null,
          newValue: null,
          _t: (r.created_at as Date).getTime(),
          _n: Number(r.id),
        };
      }),
    ];
    // Sắp mới nhất trước (trùng giờ thì id lớn trước), bỏ _t/_n trước khi trả.
    items.sort((a, b) => b._t - a._t || b._n - a._n);
    return { date, items: items.map(({ _t, _n, ...x }) => x) };
  }
}
