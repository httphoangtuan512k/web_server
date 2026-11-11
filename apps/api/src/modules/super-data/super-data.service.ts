import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/api-error';
import { DbService } from '../../db/db.service';

/** Bảng được phép truy cập + nhãn tiếng Việt (thứ tự = thứ tự hiển thị). */
export const SUPER_DATA_LABELS: Record<string, string> = {
  users: 'Tài khoản nhân viên',
  orders: 'Đơn hàng',
  order_history: 'Lịch sử đơn hàng',
  order_events: 'Sự kiện vận hành',
  audit_logs: 'Nhật ký quản trị',
  user_sessions: 'Phiên đăng nhập',
  maintenance_records: 'Bảo trì - bảo dưỡng',
  warehouse_items: 'Hàng hóa / Bao bì / Vật tư',
  warehouse_transactions: 'Giao dịch kho',
  warehouse_daily_entries: 'Phiếu nhập sản lượng theo ngày',
  warehouse_daily_entry_lines: 'Chi tiết phiếu nhập sản lượng',
  warehouse_daily_closings: 'Chốt kho theo ngày',
  warehouse_daily_closing_lines: 'Chi tiết chốt kho',
  warehouse_daily_snapshots: 'Ảnh chụp chốt kho',
  warehouse_production_baselines: 'Sản lượng nền theo đơn',
  plc_machine_states: 'Trạng thái vận hành PLC',
  app_settings: 'Cấu hình hệ thống',
};
/** Cột nhạy cảm không bao giờ hiển thị/chỉnh sửa (is_super giữ như server cũ: không cho nâng quyền tại đây). */
const HIDDEN_COLUMNS = new Set(['password_hash', 'session_key', 'api_key_hash', 'is_super']);
const NO_DELETE = new Set(['users', 'user_sessions']);
const ROW_LIMIT = 200;

type Kind = 'boolean' | 'int' | 'float' | 'json' | 'array' | 'timestamptz' | 'timestamp' | 'date' | 'uuid' | 'text';

interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
  readonly: boolean;
  kind: Kind;
  /** Kiểu phần tử nếu là mảng. */
  elemKind?: Kind;
  /** Ép kiểu tham số trong SQL – chỉ lấy từ bảng cố định bên dưới. */
  cast: string;
}

const SCALAR: Record<string, { kind: Kind; cast: string }> = {
  boolean: { kind: 'boolean', cast: 'boolean' },
  smallint: { kind: 'int', cast: 'smallint' },
  integer: { kind: 'int', cast: 'integer' },
  bigint: { kind: 'int', cast: 'bigint' },
  'double precision': { kind: 'float', cast: 'double precision' },
  real: { kind: 'float', cast: 'real' },
  numeric: { kind: 'float', cast: 'numeric' },
  jsonb: { kind: 'json', cast: 'jsonb' },
  json: { kind: 'json', cast: 'json' },
  'timestamp with time zone': { kind: 'timestamptz', cast: 'timestamptz' },
  'timestamp without time zone': { kind: 'timestamp', cast: 'timestamp' },
  date: { kind: 'date', cast: 'date' },
  uuid: { kind: 'uuid', cast: 'uuid' },
  text: { kind: 'text', cast: 'text' },
  'character varying': { kind: 'text', cast: 'text' },
  character: { kind: 'text', cast: 'text' },
};
/** udt_name của phần tử mảng → kiểu. */
const ARRAY_ELEM: Record<string, { kind: Kind; cast: string }> = {
  _text: { kind: 'text', cast: 'text[]' },
  _varchar: { kind: 'text', cast: 'text[]' },
  _int2: { kind: 'int', cast: 'smallint[]' },
  _int4: { kind: 'int', cast: 'integer[]' },
  _int8: { kind: 'int', cast: 'bigint[]' },
  _float8: { kind: 'float', cast: 'double precision[]' },
  _numeric: { kind: 'float', cast: 'numeric[]' },
  _bool: { kind: 'boolean', cast: 'boolean[]' },
  _uuid: { kind: 'uuid', cast: 'uuid[]' },
};

const qi = (name: string) => `"${name.replace(/"/g, '""')}"`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class CoerceError extends Error {}

@Injectable()
export class SuperDataService {
  constructor(private readonly db: DbService) {}

  async tableInfo(table: unknown) {
    if (typeof table !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new ApiError(400, 'Tên bảng không hợp lệ.');
    if (!Object.prototype.hasOwnProperty.call(SUPER_DATA_LABELS, table)) throw new ApiError(400, 'Bảng dữ liệu không được phép truy cập.');
    const [cols, pkRows] = await Promise.all([
      this.db.all<{
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
        is_generated: string;
        is_identity: string;
      }>(
        `SELECT column_name, data_type, udt_name, is_nullable, is_generated, is_identity
           FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = ?
          ORDER BY ordinal_position`,
        [table],
      ),
      this.db.all<{ name: string }>(
        `SELECT a.attname AS name
           FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
          WHERE con.contype = 'p' AND n.nspname = current_schema() AND c.relname = ?
          ORDER BY k.ord`,
        [table],
      ),
    ]);
    if (!cols.length) throw new ApiError(400, 'Bảng dữ liệu không được phép truy cập.');
    const primaryKey = pkRows.map((r) => r.name);
    if (!primaryKey.length) throw new ApiError(400, 'Bảng không có khóa chính, không thể chỉnh sửa an toàn.');
    const info: ColumnInfo[] = cols.map((c) => {
      let type = c.data_type;
      let kind: Kind = 'text';
      let elemKind: Kind | undefined;
      let cast = '';
      if (c.data_type === 'ARRAY') {
        type = `${c.udt_name.replace(/^_/, '')}[]`;
        const e = ARRAY_ELEM[c.udt_name];
        kind = 'array';
        elemKind = e?.kind ?? 'text';
        cast = e?.cast ?? '';
        if (c.udt_name === '_text') type = 'text[]';
      } else if (c.data_type === 'USER-DEFINED') {
        type = c.udt_name;
      } else if (SCALAR[c.data_type]) {
        kind = SCALAR[c.data_type].kind;
        cast = SCALAR[c.data_type].cast;
      }
      return {
        name: c.column_name,
        type,
        notnull: c.is_nullable === 'NO',
        pk: primaryKey.includes(c.column_name),
        readonly: c.is_generated === 'ALWAYS' || c.is_identity === 'YES',
        kind,
        elemKind,
        cast,
      };
    });
    return { table, label: SUPER_DATA_LABELS[table], info, primaryKey };
  }

  async tables() {
    const rows = await this.db.all<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' AND table_name = ANY(?::text[])`,
      [Object.keys(SUPER_DATA_LABELS)],
    );
    const exists = new Set(rows.map((r) => r.table_name));
    return Object.keys(SUPER_DATA_LABELS)
      .filter((name) => exists.has(name))
      .map((name) => ({ name, label: SUPER_DATA_LABELS[name] }));
  }

  async read(tableParam: string, qParam: unknown) {
    const { table, label, info, primaryKey } = await this.tableInfo(tableParam);
    const visible = info.filter((c) => !HIDDEN_COLUMNS.has(c.name));
    const columns = visible.map((c) => ({ name: c.name, type: c.type, notnull: c.notnull, pk: c.pk, readonly: c.readonly }));
    const q = String(qParam ?? '').trim().slice(0, 150);
    const orderBy = primaryKey.map(qi).join(', ');
    let rows: Record<string, any>[];
    try {
      if (q) {
        const where = visible.map((c) => `CAST(${qi(c.name)} AS TEXT) ILIKE $1`).join(' OR ');
        rows = await this.db.all(`SELECT * FROM ${qi(table)} WHERE (${where}) ORDER BY ${orderBy} LIMIT ${ROW_LIMIT}`, [`%${q}%`]);
      } else {
        rows = await this.db.all(`SELECT * FROM ${qi(table)} ORDER BY ${orderBy} LIMIT ${ROW_LIMIT}`);
      }
    } catch (e) {
      console.error('[SUPER DATA]', e);
      throw new ApiError(400, 'Không thể đọc dữ liệu.');
    }
    return {
      table,
      label,
      primaryKey,
      columns,
      rows: rows.map((row) => ({
        key: Object.fromEntries(primaryKey.map((k) => [k, row[k]])),
        values: Object.fromEntries(visible.map((c) => [c.name, row[c.name]])),
      })),
    };
  }

  async update(tableParam: string, body: any) {
    const { table, info, primaryKey } = await this.tableInfo(tableParam);
    const key = body && body.key;
    const values = body && body.values;
    if (!key || typeof key !== 'object' || !values || typeof values !== 'object' || Array.isArray(values)) {
      throw new ApiError(400, 'Dữ liệu cập nhật không hợp lệ.');
    }
    for (const k of primaryKey) if (!Object.prototype.hasOwnProperty.call(key, k)) throw new ApiError(400, 'Thiếu khóa bản ghi.');
    const byName = new Map(info.map((c) => [c.name, c]));
    const allowed = new Set(info.filter((c) => !c.pk && !c.readonly && !HIDDEN_COLUMNS.has(c.name)).map((c) => c.name));
    const entries = Object.entries(values).filter(([k]) => allowed.has(k));
    if (!entries.length) throw new ApiError(400, 'Không có trường hợp lệ để cập nhật.');

    const params: unknown[] = [];
    const ph = (col: ColumnInfo, v: unknown) => {
      params.push(this.coerce(col, v));
      return `$${params.length}${col.cast ? '::' + col.cast : ''}`;
    };
    const setSql = entries.map(([k, v]) => `${qi(k)} = ${ph(byName.get(k)!, v)}`).join(', ');
    const whereSql = this.keyWhere(primaryKey, byName, key, ph);
    const r = await this.run(`UPDATE ${qi(table)} SET ${setSql} WHERE ${whereSql}`, params, 'Không thể cập nhật dữ liệu.');
    if (!r.changes) throw new ApiError(404, 'Không tìm thấy bản ghi hoặc dữ liệu không thay đổi.');
    // Không ghi audit/history cho thao tác chỉnh sửa thủ công của Super Admin (như server cũ).
    return { ok: true, changes: r.changes };
  }

  async remove(tableParam: string, body: any) {
    const { table, info, primaryKey } = await this.tableInfo(tableParam);
    if (NO_DELETE.has(table)) throw new ApiError(403, 'Bảng này được bảo vệ, không cho xóa bản ghi tại trình quản trị dữ liệu.');
    const key = body && body.key;
    if (!key || typeof key !== 'object' || primaryKey.some((k) => !Object.prototype.hasOwnProperty.call(key, k))) {
      throw new ApiError(400, 'Thiếu khóa bản ghi.');
    }
    const byName = new Map(info.map((c) => [c.name, c]));
    const params: unknown[] = [];
    const ph = (col: ColumnInfo, v: unknown) => {
      params.push(this.coerce(col, v));
      return `$${params.length}${col.cast ? '::' + col.cast : ''}`;
    };
    const whereSql = this.keyWhere(primaryKey, byName, key, ph);
    const r = await this.run(
      `DELETE FROM ${qi(table)} WHERE ${whereSql}`,
      params,
      'Không thể xóa dữ liệu. Có thể bản ghi đang được dữ liệu khác tham chiếu.',
    );
    if (!r.changes) throw new ApiError(404, 'Không tìm thấy bản ghi.');
    return { ok: true, changes: r.changes };
  }

  private keyWhere(
    primaryKey: string[],
    byName: Map<string, ColumnInfo>,
    key: Record<string, unknown>,
    ph: (c: ColumnInfo, v: unknown) => string,
  ) {
    return primaryKey
      .map((k) => {
        const col = byName.get(k)!;
        if (key[k] === null || key[k] === undefined || key[k] === '') throw new ApiError(400, 'Thiếu khóa bản ghi.');
        return `${qi(k)} = ${ph(col, key[k])}`;
      })
      .join(' AND ');
  }

  private async run(sql: string, params: unknown[], fallback: string) {
    try {
      return await this.db.run(sql, params);
    } catch (e: any) {
      throw new ApiError(400, this.pgMessage(e, fallback));
    }
  }

  private pgMessage(e: any, fallback: string): string {
    const code = String(e?.code || '');
    if (code === '23505') return `Giá trị bị trùng với bản ghi khác (ràng buộc ${e.constraint || 'duy nhất'}).`;
    if (code === '23503') {
      return fallback.startsWith('Không thể xóa')
        ? fallback
        : `Giá trị tham chiếu không tồn tại hoặc bản ghi đang được dữ liệu khác tham chiếu (ràng buộc ${e.constraint || 'khóa ngoại'}).`;
    }
    if (code === '23514') return `Giá trị không hợp lệ (vi phạm ràng buộc ${e.constraint || 'kiểm tra'}).`;
    if (code === '23502') return `Cột "${e.column || ''}" không được để trống.`;
    if (code.startsWith('22')) return `Giá trị không đúng kiểu dữ liệu: ${e.message}`;
    console.error('[SUPER DATA]', e);
    return fallback;
  }

  // -------------------------------------------------------------------------------------------
  // Ép kiểu giá trị theo kiểu cột (báo lỗi 400 rõ ràng nếu sai)
  // -------------------------------------------------------------------------------------------
  private coerce(col: ColumnInfo, v: unknown): unknown {
    try {
      if (v === undefined) v = null;
      if (v === null || (v === '' && col.kind !== 'text')) {
        if (col.notnull) throw new CoerceError('không được để trống');
        return null;
      }
      if (col.kind === 'array') return this.coerceArray(col, v);
      if (col.kind === 'json') return this.coerceJson(v);
      return this.coerceScalar(col.kind, v);
    } catch (e) {
      if (e instanceof CoerceError) throw new ApiError(400, `Cột "${col.name}" (${col.type}) ${e.message}.`);
      throw e;
    }
  }

  private coerceScalar(kind: Kind, v: unknown): unknown {
    switch (kind) {
      case 'boolean': {
        if (typeof v === 'boolean') return v;
        if (v === 1 || v === 0) return v === 1;
        const s = String(v).trim().toLowerCase();
        if (['true', '1', 't', 'yes', 'có', 'co'].includes(s)) return true;
        if (['false', '0', 'f', 'no', 'không', 'khong'].includes(s)) return false;
        throw new CoerceError('phải là true/false');
      }
      case 'int':
      case 'float': {
        if (typeof v === 'boolean' || typeof v === 'object') throw new CoerceError('phải là số');
        const s = String(v).trim();
        const n = typeof v === 'number' ? v : s === '' ? NaN : Number(s.replace(',', '.'));
        if (!Number.isFinite(n)) throw new CoerceError('phải là số');
        if (kind === 'int' && !Number.isInteger(n)) throw new CoerceError('phải là số nguyên');
        return n;
      }
      case 'timestamptz':
      case 'timestamp': {
        if (typeof v !== 'string' && typeof v !== 'number') throw new CoerceError('phải là thời gian hợp lệ (ISO 8601)');
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) throw new CoerceError('phải là thời gian hợp lệ (ISO 8601)');
        return d.toISOString();
      }
      case 'date': {
        const s = String(v).trim();
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        const d = m ? new Date(`${s}T00:00:00Z`) : null;
        if (typeof v !== 'string' || !m || !d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
          throw new CoerceError('phải là ngày dạng YYYY-MM-DD');
        }
        return s;
      }
      case 'uuid': {
        const s = String(v).trim();
        if (typeof v !== 'string' || !UUID_RE.test(s)) throw new CoerceError('phải là UUID hợp lệ');
        return s;
      }
      default: {
        if (typeof v === 'object') throw new CoerceError('phải là chuỗi văn bản');
        return String(v);
      }
    }
  }

  private coerceJson(v: unknown): string {
    if (typeof v === 'string') {
      try {
        JSON.parse(v);
        return v;
      } catch {
        throw new CoerceError('phải là JSON hợp lệ');
      }
    }
    return JSON.stringify(v);
  }

  private coerceArray(col: ColumnInfo, v: unknown): unknown[] {
    let arr: unknown;
    if (Array.isArray(v)) arr = v;
    else if (typeof v === 'string') {
      const s = v.trim();
      if (s.startsWith('[')) {
        try {
          arr = JSON.parse(s);
        } catch {
          throw new CoerceError('phải là mảng JSON hợp lệ hoặc danh sách cách nhau bởi dấu phẩy');
        }
      } else if (s.startsWith('{') && s.endsWith('}')) {
        // Dạng literal mảng Postgres đơn giản: {a,b,c}
        arr = s.slice(1, -1).split(',').map((x) => x.trim().replace(/^"(.*)"$/, '$1')).filter((x) => x !== '');
      } else {
        arr = s === '' ? [] : s.split(',').map((x) => x.trim()).filter((x) => x !== '');
      }
    }
    if (!Array.isArray(arr)) throw new CoerceError('phải là mảng');
    const elemKind = col.elemKind ?? 'text';
    return arr.map((x) => {
      if (x === null || x === undefined) throw new CoerceError('không được chứa phần tử rỗng');
      return this.coerceScalar(elemKind, x);
    });
  }
}
