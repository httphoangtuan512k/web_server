import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { DbUser } from '../../auth/auth.types';
import { CurrentUser, RequireAdmin } from '../../auth/decorators';
import { ApiError } from '../../common/api-error';
import { isDateKey, vnDateKey, vnDateTime, vnStartOfDay } from '../../common/time';
import { DbService, Row } from '../../db/db.service';

const actorName = (u: DbUser) => u.fullName || u.username;

/** Dòng order_history dạng JSON thuần (giống history_logs cũ, thời gian ISO). */
const plainHistory = (r: Row) => ({
  ...r,
  created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
});

@Controller('api/history')
export class HistoryController {
  constructor(private readonly db: DbService) {}

  @Get()
  async list() {
    return this.db.all('SELECT * FROM order_history ORDER BY created_at DESC LIMIT 50');
  }

  // Chỉ Super Admin được sửa/xóa bản ghi lịch sử.
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    if (!u || !u.isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được sửa lịch sử.');
    const b = body ?? {};
    const hid = Number(id);
    return this.db.tx(async (t) => {
      const old = Number.isSafeInteger(hid) ? await t.get('SELECT * FROM order_history WHERE id = ? FOR UPDATE', [hid]) : undefined;
      if (!old) throw new ApiError(404, 'Không tìm thấy bản ghi lịch sử.');

      const allowed = ['order_number', 'machine_name', 'user_name', 'action', 'old_value', 'new_value', 'created_at'];
      const updates: Record<string, string> = {};
      for (const key of allowed) if (Object.prototype.hasOwnProperty.call(b, key)) updates[key] = String(b[key] ?? '');
      if (!Object.keys(updates).length) throw new ApiError(400, 'Không có dữ liệu thay đổi.');

      const before = plainHistory(old);
      const next: Row = { ...before, ...updates };
      if (!String(next.order_number).trim() || !String(next.user_name).trim() || !String(next.action).trim() || !String(next.created_at).trim()) {
        throw new ApiError(400, 'Số đơn, người thao tác, hành động và thời gian không được để trống.');
      }
      // Postgres: old_value/new_value là số, created_at là timestamptz.
      for (const k of ['old_value', 'new_value']) {
        const raw = next[k];
        if (raw === null || raw === undefined || String(raw).trim() === '') next[k] = 0;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n)) throw new ApiError(400, 'Giá trị cũ/mới phải là số.');
          next[k] = n;
        }
      }
      const createdAt = new Date(String(next.created_at).trim());
      if (Number.isNaN(createdAt.getTime())) throw new ApiError(400, 'Thời gian không hợp lệ.');
      next.created_at = createdAt.toISOString();

      await t.run(
        `UPDATE order_history SET order_number = ?, machine_name = ?, user_name = ?, action = ?, old_value = ?, new_value = ?, created_at = ? WHERE id = ?`,
        [next.order_number, next.machine_name, next.user_name, next.action, next.old_value, next.new_value, createdAt, old.id],
      );
      await t.run(
        `INSERT INTO audit_logs (action_type, target_id, order_number, details, actor, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['EDIT_HISTORY', String(old.id), old.order_number, JSON.stringify({ before, after: next }), actorName(u), u.id, new Date()],
      );
      return { ok: true };
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: DbUser) {
    if (!u || !u.isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được xóa lịch sử.');
    const hid = Number(id);
    return this.db.tx(async (t) => {
      const old = Number.isSafeInteger(hid) ? await t.get('SELECT * FROM order_history WHERE id = ? FOR UPDATE', [hid]) : undefined;
      if (!old) throw new ApiError(404, 'Không tìm thấy bản ghi lịch sử.');
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

const HISTORY_FIELD_LABELS: Record<string, string> = {
  order_number: 'số đơn',
  machine_name: 'máy',
  user_name: 'người thao tác',
  action: 'hành động',
  old_value: 'giá trị cũ',
  new_value: 'giá trị mới',
  created_at: 'thời gian',
};

const fmtNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : String(v ?? '');
};
const fmtTime = (v: unknown) => {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : vnDateTime(d);
};
const nz = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clip = (s: string, n = 300) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function historyDetail(r: Row): string {
  const parts: string[] = [];
  if (nz(r.old_value) || nz(r.new_value)) parts.push(`${fmtNum(r.old_value)} → ${fmtNum(r.new_value)}`);
  return parts.join(' · ');
}

function eventDetail(r: Row): string {
  const parts: string[] = [];
  if (nz(r.machine_count)) parts.push(`Số máy: ${fmtNum(r.machine_count)}`);
  if (nz(r.actual_tons)) parts.push(`Sản lượng: ${fmtNum(r.actual_tons)} tấn`);
  return parts.join(' · ');
}

function auditDetail(type: string, target: string | null, d: any): { detail: string; machineName: string } {
  const obj = d && typeof d === 'object' ? d : null;
  try {
    switch (type) {
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
      case 'DELETE_HISTORY': {
        const x = obj?.deleted || {};
        const val = nz(x.old_value) || nz(x.new_value) ? `, ${fmtNum(x.old_value)} → ${fmtNum(x.new_value)}` : '';
        return {
          detail: `Bản ghi #${target ?? x.id ?? ''}: ${x.action ?? ''} – ${x.user_name ?? ''}, ${fmtTime(x.created_at)}${val}`,
          machineName: String(x.machine_name ?? ''),
        };
      }
      case 'EDIT_ORDER_CREATED_AT':
        return { detail: `Ngày tạo: ${fmtTime(obj?.before)} → ${fmtTime(obj?.after)}`, machineName: '' };
      case 'CLOSE_WAREHOUSE_DAILY':
      case 'RECLOSE_WAREHOUSE_DAILY':
        return {
          detail: `Ngày ${obj?.date ?? ''}` + (obj?.version ? `, phiên bản ${obj.version}` : '') + (obj?.rowCount !== undefined ? `, ${obj.rowCount} dòng` : ''),
          machineName: '',
        };
      case 'ADJUST_WAREHOUSE_CUMULATIVE':
        return { detail: `Lũy kế: ${fmtNum(obj?.producedCumulative)} tấn` + (obj?.note ? ` – ${obj.note}` : ''), machineName: '' };
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
      case 'WAREHOUSE_STOCK_IN':
      case 'WAREHOUSE_STOCK_OUT':
        return {
          detail: `${type.endsWith('IN') ? 'Nhập' : 'Xuất'} ${fmtNum(obj?.quantity)} – ${obj?.item ?? ''}` + (obj?.note ? ` (${obj.note})` : ''),
          machineName: '',
        };
      case 'EDIT_MAINTENANCE':
      case 'DELETE_MAINTENANCE': {
        const x = obj?.before || obj?.deleted || {};
        return { detail: `Thiết bị: ${x.equipment ?? ''}`, machineName: '' };
      }
    }
  } catch {
    /* rơi xuống mặc định */
  }
  if (d === null || d === undefined || d === '') return { detail: '', machineName: '' };
  return { detail: clip(typeof d === 'string' ? d : JSON.stringify(d)), machineName: '' };
}

@Controller('api/logs')
export class LogsController {
  constructor(private readonly db: DbService) {}

  @Get()
  @RequireAdmin()
  async list(@Query('date') dateParam?: string) {
    const date = dateParam === undefined || dateParam === '' ? vnDateKey() : String(dateParam);
    if (!isDateKey(date) || Number.isNaN(vnStartOfDay(date).getTime()) || vnDateKey(vnStartOfDay(date)) !== date) throw new ApiError(400, 'Ngày không hợp lệ.');
    const from = vnStartOfDay(date);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const range = [from, to];

    const [history, events, audits] = await Promise.all([
      this.db.all('SELECT * FROM order_history WHERE created_at >= ? AND created_at < ?', range),
      this.db.all('SELECT * FROM order_events WHERE created_at >= ? AND created_at < ?', range),
      this.db.all('SELECT * FROM audit_logs WHERE created_at >= ? AND created_at < ?', range),
    ]);

    const items: (LogItem & { _t: number; _n: number })[] = [
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
    items.sort((a, b) => b._t - a._t || b._n - a._n);
    return { date, items: items.map(({ _t, _n, ...x }) => x) };
  }
}
