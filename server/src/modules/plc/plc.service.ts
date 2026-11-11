/**
 * File này: xử lý PLC Máy B – nhận số liệu, tính & lưu tồn phễu/silo, lịch sử, chỉnh thông số, quản lý API Key.
 * Dùng ở: plc.controller.ts (C# Máy B, trang Vận hành / PLC, Quản trị › Hệ thống).
 */
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

// Giới hạn 1 gói dữ liệu PLC: 256 KB.
const PLC_MAX_PAYLOAD_BYTES = 256 * 1024;

/** Băm SHA-256 API Key (DB chỉ lưu bản băm, không lưu khóa thật). */
export function plcKeyHash(value: string): string {
  return createHash('sha256').update(String(value)).digest('hex');
}

/** So sánh 2 chuỗi hex với thời gian cố định (chống đoán khóa qua thời gian phản hồi). */
export function safeEqualHex(a: unknown, b: unknown): boolean {
  try {
    const x = Buffer.from(String(a || ''), 'hex');
    const y = Buffer.from(String(b || ''), 'hex');
    return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

// Ngày giờ → chuỗi ISO (không có → chuỗi rỗng).
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : '');
// Đang kết nối nếu bản tin cuối không cũ hơn 5 giây.
const isConnected = (lastReceivedAt: Date | null | undefined) =>
  Boolean(lastReceivedAt && Date.now() - new Date(lastReceivedAt).getTime() <= PLC_CONNECTED_MS);

@Injectable()
export class PlcService {
  constructor(private readonly db: DbService) {}

  /** = requirePlcOperator cũ (chạy sau @RequirePage('vanhanh')). */
  assertOperator(user: DbUser) {
    if (!user || !user.isActive) throw new ApiError(403, 'Tài khoản không hoạt động.');
    // Super Admin, admin hoặc có quyền 'vanhanh'/'all' thì cho qua.
    const perms = user.orderPermissions ?? [];
    if (user.isSuper || user.role === 'admin' || perms.includes('vanhanh') || perms.includes('all')) return;
    throw new ApiError(403, 'Tài khoản chưa được cấp quyền vận hành máy.');
  }

  /** = requirePlcApiKey cũ. */
  async assertApiKey(supplied: string) {
    if (!supplied || supplied.length > 256) throw new ApiError(401, 'API Key không hợp lệ.');
    // So bản băm khóa gửi lên với bản băm khóa đang hoạt động trong DB.
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
    // FOR UPDATE: khóa dòng tới hết transaction, yêu cầu khác phải chờ.
    return (await t.get<{ last_received_at: Date | null; last_history_at: Date | null }>(
      'SELECT last_received_at, last_history_at FROM plc_devices WHERE device_id = ? FOR UPDATE',
      [deviceId],
    ))!;
  }

  /** Đọc state 4 máy; máy chưa có dữ liệu thì dùng mặc định. */
  private async loadStates(q: Queryable): Promise<Record<PlcMachine, PlcState>> {
    const rows = await q.all<{ machine_id: string; state: unknown }>(
      'SELECT machine_id, state FROM plc_machine_states WHERE machine_id = ANY(?::text[])',
      [[...PLC_MACHINES]],
    );
    const byId = new Map(rows.map((r) => [r.machine_id, r.state]));
    return Object.fromEntries(PLC_MACHINES.map((m) => [m, plcStateFrom(byId.get(m))])) as Record<PlcMachine, PlcState>;
  }

  /** Lưu state nhiều máy trong 1 câu lệnh (chưa có thì thêm, có rồi thì cập nhật). */
  private async saveStates(t: Queryable, deviceId: string, states: Array<[PlcMachine, PlcState]>, at: Date) {
    // Dựng danh sách giá trị và cụm "(?, ?, ?::jsonb, ?)" cho từng máy.
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

  /** Nhận 1 bản tin của PLC (4 máy): kiểm khóa, tính tồn, lưu state, mỗi 60 giây lưu lịch sử. */
  async telemetry(apiKey: string, body: any) {
    await this.assertApiKey(apiKey);
    // Kiểm tra dữ liệu: đúng thiết bị, đủ 4 máy.
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
    // Đóng gói và chặn gói quá 256 KB.
    const payload = { device_id: deviceId, source_timestamp: String(body.timestamp || ''), machines };
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > PLC_MAX_PAYLOAD_BYTES) throw new ApiError(413, 'Dữ liệu PLC vượt quá 256 KB.');

    try {
      // Transaction: mọi bước cùng thành công hoặc cùng hủy.
      return await this.db.tx(async (t) => {
        // Khóa dòng thiết bị: 2 bản tin đồng thời được xử lý tuần tự, không làm sai bộ đếm/tồn silo.
        const dev = await this.lockDevice(t, deviceId);
        const now = Date.now(); // lấy sau khi có khóa để thứ tự thời gian khớp thứ tự xử lý
        const receivedAtDate = new Date(now);
        const receivedAt = receivedAtDate.toISOString();
        // Cách bản tin trước > 5 giây (hoặc chưa từng nhận) = vừa kết nối lại.
        const previousAt = dev.last_received_at ? new Date(dev.last_received_at).getTime() : 0;
        const reconnect = !previousAt || now - previousAt > PLC_RECONNECT_MS;

        // Tính tồn phễu/silo cho 4 máy rồi lưu.
        const states = await this.loadStates(t);
        for (const machine of PLC_MACHINES) plcProcessMachine(machine, states[machine], machines[machine], receivedAt, reconnect);
        await this.saveStates(t, deviceId, PLC_MACHINES.map((m) => [m, states[m]]), receivedAtDate);

        // Đủ 60 giây từ lần lưu trước → ghi lịch sử.
        const last = dev.last_history_at ? new Date(dev.last_history_at).getTime() : 0;
        const historySaved = now - last >= PLC_HISTORY_INTERVAL_MS;
        if (historySaved) {
          await t.run('INSERT INTO plc_telemetry_history (device_id, received_at, payload) VALUES (?, ?, ?::jsonb)', [
            deviceId,
            receivedAtDate,
            serialized,
          ]);
        }
        // Cập nhật bản tin cuối, thời điểm nhận (và thời điểm lưu lịch sử nếu có).
        await t.run(
          `UPDATE plc_devices SET last_payload = ?::jsonb, last_received_at = ?,
             last_history_at = CASE WHEN ? THEN ? ELSE last_history_at END
           WHERE device_id = ?`,
          [serialized, receivedAtDate, historySaved, receivedAtDate, deviceId],
        );
        return { ok: true, device_id: deviceId, received_at: receivedAt, history_saved: historySaved };
      });
    } catch (e) {
      // Lỗi đã có mã thì ném tiếp; lỗi lạ → ghi log, báo 500.
      if (e instanceof ApiError) throw e;
      console.error('[PLC] Không lưu được trạng thái/lịch sử:', e);
      throw new ApiError(500, 'Không thể lưu trạng thái vận hành.');
    }
  }

  /** Số liệu mới nhất + state 4 máy + đang kết nối hay không. */
  async latest() {
    // Chạy song song 2 truy vấn.
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

  /** Người vận hành sửa 1 thông số (mức phễu đầy, tồn silo, hệ số) của 1 máy. */
  async updateOperationState(machineParam: string, body: any) {
    // Kiểm tra tên máy, thông số được phép sửa, giá trị là số ≥ 0.
    const machine = String(machineParam || '').toLowerCase() as PlcMachine;
    if (!PLC_MACHINES.includes(machine)) throw new ApiError(400, 'Máy không hợp lệ.');
    const key = String(body?.key || '');
    const value = plcNum(body?.value);
    if (!PLC_EDITABLE_KEYS.has(key) || !Number.isFinite(value) || value < 0) throw new ApiError(400, 'Thông số cập nhật không hợp lệ.');
    try {
      return await this.db.tx(async (t) => {
        // Khóa thiết bị để không đè lên bản tin PLC đang xử lý.
        await this.lockDevice(t, PLC_DEVICE_ID);
        // Đọc state, gán giá trị mới, lưu lại.
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

  /** Lịch sử số liệu PLC theo khoảng ngày (tối đa 1440 dòng). */
  async history(query: any) {
    // Đọc và kiểm tra tham số lọc.
    const limit = Math.min(1440, Math.max(1, Number(query?.limit) || 120));
    const from = String(query?.from || '').trim();
    const to = String(query?.to || '').trim();
    const bad = (v: string) => v && (!isDateKey(v) || Number.isNaN(vnStartOfDay(v).getTime()));
    if (bad(from) || bad(to)) throw new ApiError(400, 'Ngày lọc không hợp lệ.');
    // Dựng điều kiện WHERE theo giờ Việt Nam (gồm trọn ngày "to").
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
    // Lấy bản ghi mới nhất trước, rồi đảo lại thành cũ → mới.
    const rows = await this.db.all<{ id: number; received_at: Date; payload: unknown }>(
      `SELECT id, received_at, payload FROM plc_telemetry_history WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
      args,
    );
    return { rows: rows.reverse().map((r) => ({ id: r.id, received_at: iso(r.received_at), payload: r.payload })) };
  }

  /** Tình trạng API Key và kết nối của Máy B (không trả khóa/bản băm). */
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

  /** Tạo API Key mới (thay khóa cũ); khóa chỉ hiển thị 1 lần. */
  async createKey() {
    // Khóa ngẫu nhiên "sw_" + 64 ký tự hex.
    const key = 'sw_' + randomBytes(32).toString('hex');
    const now = new Date();
    // Lưu bản băm, bật khóa, xóa mốc thu hồi.
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

  /** Thu hồi API Key đang dùng; revoked = true nếu có khóa bị tắt. */
  async revokeKey() {
    const r = await this.db.run(
      'UPDATE plc_devices SET api_key_active = FALSE, api_key_revoked_at = ? WHERE device_id = ? AND api_key_active = TRUE',
      [new Date(), PLC_DEVICE_ID],
    );
    return { ok: true, revoked: r.changes > 0 };
  }
}
