import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ApiError } from '../../common/api-error';
import type { DbUser } from '../../auth/auth.types';
import { isDateKey, vnStartOfDay } from '../../common/time';
import { DbService, Queryable } from '../../db/db.service';
import {
  PLC_CONNECTED_MS,
  PLC_DEVICE_ID,
  PLC_EDITABLE_KEYS,
  PLC_HISTORY_INTERVAL_MS,
  PLC_MACHINES,
  PLC_RECONNECT_MS,
  PlcMachine,
  PlcState,
  plcNum,
  plcProcessMachine,
  plcStateFrom,
} from './plc.logic';

const PLC_MAX_PAYLOAD_BYTES = 256 * 1024;

export function plcKeyHash(value: string): string {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function safeEqualHex(a: unknown, b: unknown): boolean {
  try {
    const x = Buffer.from(String(a || ''), 'hex');
    const y = Buffer.from(String(b || ''), 'hex');
    return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : '');
const isConnected = (lastReceivedAt: Date | null | undefined) =>
  Boolean(lastReceivedAt && Date.now() - new Date(lastReceivedAt).getTime() <= PLC_CONNECTED_MS);

@Injectable()
export class PlcService {
  constructor(private readonly db: DbService) {}

  /** = requirePlcOperator cũ (chạy sau @RequirePage('vanhanh')). */
  assertOperator(user: DbUser) {
    if (!user || !user.isActive) throw new ApiError(403, 'Tài khoản không hoạt động.');
    const perms = user.orderPermissions ?? [];
    if (user.isSuper || user.role === 'admin' || perms.includes('vanhanh') || perms.includes('all')) return;
    throw new ApiError(403, 'Tài khoản chưa được cấp quyền vận hành máy.');
  }

  /** = requirePlcApiKey cũ. */
  async assertApiKey(supplied: string) {
    if (!supplied || supplied.length > 256) throw new ApiError(401, 'API Key không hợp lệ.');
    const row = await this.db.get<{ api_key_hash: string | null }>(
      'SELECT api_key_hash FROM plc_devices WHERE device_id = ? AND api_key_active = TRUE',
      [PLC_DEVICE_ID],
    );
    if (!row || !safeEqualHex(plcKeyHash(supplied), row.api_key_hash)) {
      throw new ApiError(401, 'API Key không hợp lệ hoặc đã bị thu hồi.');
    }
  }

  /** Đảm bảo có dòng plc_devices rồi khóa nó (tuần tự hóa telemetry và chỉnh thông số). */
  private async lockDevice(t: Queryable, deviceId: string) {
    await t.run('INSERT INTO plc_devices (device_id) VALUES (?) ON CONFLICT (device_id) DO NOTHING', [deviceId]);
    return (await t.get<{ last_received_at: Date | null; last_history_at: Date | null }>(
      'SELECT last_received_at, last_history_at FROM plc_devices WHERE device_id = ? FOR UPDATE',
      [deviceId],
    ))!;
  }

  private async loadStates(q: Queryable): Promise<Record<PlcMachine, PlcState>> {
    const rows = await q.all<{ machine_id: string; state: unknown }>(
      'SELECT machine_id, state FROM plc_machine_states WHERE machine_id = ANY(?::text[])',
      [[...PLC_MACHINES]],
    );
    const byId = new Map(rows.map((r) => [r.machine_id, r.state]));
    return Object.fromEntries(PLC_MACHINES.map((m) => [m, plcStateFrom(byId.get(m))])) as Record<PlcMachine, PlcState>;
  }

  private async saveStates(t: Queryable, deviceId: string, states: Array<[PlcMachine, PlcState]>, at: Date) {
    const values: unknown[] = [];
    const tuples = states.map(([machine, state]) => {
      values.push(machine, deviceId, JSON.stringify(state), at);
      return '(?, ?, ?::jsonb, ?)';
    });
    await t.run(
      `INSERT INTO plc_machine_states (machine_id, device_id, state, updated_at) VALUES ${tuples.join(', ')}
       ON CONFLICT (machine_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at, device_id = EXCLUDED.device_id`,
      values,
    );
  }

  async telemetry(apiKey: string, body: any) {
    await this.assertApiKey(apiKey);
    body = body || {};
    const deviceId = String(body.device_id || PLC_DEVICE_ID).trim();
    if (deviceId !== PLC_DEVICE_ID) throw new ApiError(400, 'device_id không được hỗ trợ.');
    const machines = body.machines;
    if (!machines || typeof machines !== 'object' || Array.isArray(machines)) throw new ApiError(400, 'Thiếu đối tượng machines.');
    for (const name of PLC_MACHINES) {
      if (!machines[name] || typeof machines[name] !== 'object' || Array.isArray(machines[name])) {
        throw new ApiError(400, `Thiếu dữ liệu ${name}.`);
      }
    }
    const payload = { device_id: deviceId, source_timestamp: String(body.timestamp || ''), machines };
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > PLC_MAX_PAYLOAD_BYTES) throw new ApiError(413, 'Dữ liệu PLC vượt quá 256 KB.');

    try {
      return await this.db.tx(async (t) => {
        // Khóa dòng thiết bị: 2 bản tin đồng thời được xử lý tuần tự, không làm sai bộ đếm/tồn silo.
        const dev = await this.lockDevice(t, deviceId);
        const now = Date.now(); // lấy sau khi có khóa để thứ tự thời gian khớp thứ tự xử lý
        const receivedAtDate = new Date(now);
        const receivedAt = receivedAtDate.toISOString();
        const previousAt = dev.last_received_at ? new Date(dev.last_received_at).getTime() : 0;
        const reconnect = !previousAt || now - previousAt > PLC_RECONNECT_MS;

        const states = await this.loadStates(t);
        for (const machine of PLC_MACHINES) plcProcessMachine(machine, states[machine], machines[machine], receivedAt, reconnect);
        await this.saveStates(t, deviceId, PLC_MACHINES.map((m) => [m, states[m]]), receivedAtDate);

        const last = dev.last_history_at ? new Date(dev.last_history_at).getTime() : 0;
        const historySaved = now - last >= PLC_HISTORY_INTERVAL_MS;
        if (historySaved) {
          await t.run('INSERT INTO plc_telemetry_history (device_id, received_at, payload) VALUES (?, ?, ?::jsonb)', [
            deviceId,
            receivedAtDate,
            serialized,
          ]);
        }
        await t.run(
          `UPDATE plc_devices SET last_payload = ?::jsonb, last_received_at = ?,
             last_history_at = CASE WHEN ? THEN ? ELSE last_history_at END
           WHERE device_id = ?`,
          [serialized, receivedAtDate, historySaved, receivedAtDate, deviceId],
        );
        return { ok: true, device_id: deviceId, received_at: receivedAt, history_saved: historySaved };
      });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.error('[PLC] Không lưu được trạng thái/lịch sử:', e);
      throw new ApiError(500, 'Không thể lưu trạng thái vận hành.');
    }
  }

  async latest() {
    const [dev, operation_state] = await Promise.all([
      this.db.get<{ last_payload: unknown; last_received_at: Date | null }>(
        'SELECT last_payload, last_received_at FROM plc_devices WHERE device_id = ?',
        [PLC_DEVICE_ID],
      ),
      this.loadStates(this.db),
    ]);
    return {
      device_id: PLC_DEVICE_ID,
      connected: isConnected(dev?.last_received_at),
      received_at: iso(dev?.last_received_at),
      payload: dev?.last_payload ?? null,
      operation_state,
    };
  }

  async updateOperationState(machineParam: string, body: any) {
    const machine = String(machineParam || '').toLowerCase() as PlcMachine;
    if (!PLC_MACHINES.includes(machine)) throw new ApiError(400, 'Máy không hợp lệ.');
    const key = String(body?.key || '');
    const value = plcNum(body?.value);
    if (!PLC_EDITABLE_KEYS.has(key) || !Number.isFinite(value) || value < 0) throw new ApiError(400, 'Thông số cập nhật không hợp lệ.');
    try {
      return await this.db.tx(async (t) => {
        await this.lockDevice(t, PLC_DEVICE_ID);
        const row = await t.get<{ state: unknown }>('SELECT state FROM plc_machine_states WHERE machine_id = ?', [machine]);
        const state = plcStateFrom(row?.state);
        state[key] = value;
        state.updatedAt = new Date().toISOString();
        await this.saveStates(t, PLC_DEVICE_ID, [[machine, state]], new Date(state.updatedAt));
        return { ok: true, machine, operation_state: state };
      });
    } catch (e) {
      console.error('[PLC] Lỗi lưu cài đặt:', e);
      throw new ApiError(500, 'Không thể lưu cài đặt vào cơ sở dữ liệu.');
    }
  }

  async history(query: any) {
    const limit = Math.min(1440, Math.max(1, Number(query?.limit) || 120));
    const from = String(query?.from || '').trim();
    const to = String(query?.to || '').trim();
    const bad = (v: string) => v && (!isDateKey(v) || Number.isNaN(vnStartOfDay(v).getTime()));
    if (bad(from) || bad(to)) throw new ApiError(400, 'Ngày lọc không hợp lệ.');
    const where = ['device_id = ?'];
    const args: unknown[] = [PLC_DEVICE_ID];
    if (from) {
      where.push('received_at >= ?');
      args.push(vnStartOfDay(from));
    }
    if (to) {
      where.push('received_at < ?');
      args.push(new Date(vnStartOfDay(to).getTime() + 86_400_000));
    }
    args.push(limit);
    const rows = await this.db.all<{ id: number; received_at: Date; payload: unknown }>(
      `SELECT id, received_at, payload FROM plc_telemetry_history WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
      args,
    );
    return { rows: rows.reverse().map((r) => ({ id: r.id, received_at: iso(r.received_at), payload: r.payload })) };
  }

  async deviceInfo() {
    const d = await this.db.get<{
      api_key_active: boolean;
      api_key_hash: string | null;
      api_key_created_at: Date | null;
      api_key_revoked_at: Date | null;
      last_received_at: Date | null;
    }>(
      'SELECT api_key_active, api_key_hash, api_key_created_at, api_key_revoked_at, last_received_at FROM plc_devices WHERE device_id = ?',
      [PLC_DEVICE_ID],
    );
    return {
      device_id: PLC_DEVICE_ID,
      key_active: Boolean(d && d.api_key_active && d.api_key_hash),
      key_created_at: iso(d?.api_key_created_at),
      key_revoked_at: iso(d?.api_key_revoked_at),
      connected: isConnected(d?.last_received_at),
      last_received_at: iso(d?.last_received_at),
    };
  }

  async createKey() {
    const key = 'sw_' + randomBytes(32).toString('hex');
    const now = new Date();
    await this.db.run(
      `INSERT INTO plc_devices (device_id, api_key_hash, api_key_active, api_key_created_at, api_key_revoked_at)
       VALUES (?, ?, TRUE, ?, NULL)
       ON CONFLICT (device_id) DO UPDATE SET api_key_hash = EXCLUDED.api_key_hash, api_key_active = TRUE,
         api_key_created_at = EXCLUDED.api_key_created_at, api_key_revoked_at = NULL`,
      [PLC_DEVICE_ID, plcKeyHash(key), now],
    );
    return {
      ok: true,
      device_id: PLC_DEVICE_ID,
      api_key: key,
      created_at: now.toISOString(),
      warning: 'Khóa chỉ hiển thị một lần. Hãy sao chép và lưu an toàn.',
    };
  }

  async revokeKey() {
    const r = await this.db.run(
      'UPDATE plc_devices SET api_key_active = FALSE, api_key_revoked_at = ? WHERE device_id = ? AND api_key_active = TRUE',
      [new Date(), PLC_DEVICE_ID],
    );
    return { ok: true, revoked: r.changes > 0 };
  }
}
