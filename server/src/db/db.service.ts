/**
 * File này: kết nối Postgres và cung cấp cách truy vấn: Drizzle ORM (db.orm), SQL thuần (all/get/run), transaction (tx).
 * Dùng ở: hầu hết service/controller và các script trong server/scripts.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient, types } from 'pg';
import * as schema from './schema';

// BIGINT (COUNT, SUM số nguyên) và NUMERIC trả về number thay vì string, giống better-sqlite3.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));
// DATE giữ nguyên chuỗi 'YYYY-MM-DD' (không đổi sang Date để tránh lệch múi giờ).
types.setTypeParser(1082, (v) => v);

// Kiểu của đối tượng Drizzle ORM (biết hết các bảng trong schema).
export type Orm = NodePgDatabase<typeof schema>;
export { schema };

// Tham số truyền vào câu SQL; một dòng kết quả (tên cột → giá trị).
export type Params = unknown[];
export type Row = Record<string, any>;

/** Kết quả của run(): số dòng bị ảnh hưởng và các dòng RETURNING. */
export interface RunResult<T = Row> {
  /** Số dòng bị ảnh hưởng (tương đương `changes` của better-sqlite3). */
  changes: number;
  /** Các dòng trả về khi câu lệnh có RETURNING (vd: `RETURNING id` thay cho lastInsertRowid). */
  rows: T[];
}

/**
 * Đổi placeholder `?` kiểu SQLite sang `$1, $2…` của Postgres (bỏ qua `?` nằm trong chuỗi '…' / "…").
 * Câu lệnh đã dùng `$n` thì giữ nguyên.
 */
export function toPgPlaceholders(sql: string): string {
  let out = '';
  // n: số thứ tự placeholder; quote: đang ở trong chuỗi '…' hoặc "…" nào (null = không).
  let n = 0;
  let quote: string | null = null;
  // Duyệt từng ký tự của câu SQL.
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    // Trong chuỗi: chép nguyên; gặp dấu đóng thì thoát chuỗi.
    if (quote) {
      out += c;
      if (c === quote) {
        // Hai dấu nháy liền nhau ('') là nháy thoát, vẫn ở trong chuỗi.
        if (sql[i + 1] === quote) out += sql[++i];
        else quote = null;
      }
      continue;
    }
    // Gặp dấu mở chuỗi.
    if (c === "'" || c === '"') {
      quote = c;
      out += c;
      continue;
    }
    // Gặp "?" ngoài chuỗi: thay bằng $1, $2…
    if (c === '?') {
      out += '$' + ++n;
      continue;
    }
    out += c;
  }
  return out;
}

/** API truy vấn dùng chung cho pool và transaction – đặt tên giống better-sqlite3 cho dễ port. */
export interface Queryable {
  // all: lấy mọi dòng; get: lấy dòng đầu; run: chạy lệnh sửa dữ liệu.
  all<T = Row>(sql: string, params?: Params): Promise<T[]>;
  get<T = Row>(sql: string, params?: Params): Promise<T | undefined>;
  run<T = Row>(sql: string, params?: Params): Promise<RunResult<T>>;
}

// Nơi chạy truy vấn: cả "hồ kết nối" (Pool) hoặc một kết nối riêng (PoolClient, dùng cho transaction).
type Executor = Pool | PoolClient;

/** Queryable trong transaction, có thêm orm chạy cùng transaction. */
export interface TxQueryable extends Queryable {
  orm: Orm;
}

/** Tạo bộ hàm all/get/run chạy trên một Executor. */
function makeQueryable(exec: () => Executor): Queryable {
  // Hàm chạy SQL chung: đổi "?" thành $n, đổi undefined thành null.
  const q = async (sql: string, params: Params = []) =>
    exec().query(toPgPlaceholders(sql), params.map((p) => (p === undefined ? null : p)));
  return {
    async all<T = Row>(sql: string, params?: Params) {
      return (await q(sql, params)).rows as T[];
    },
    async get<T = Row>(sql: string, params?: Params) {
      return (await q(sql, params)).rows[0] as T | undefined;
    },
    async run<T = Row>(sql: string, params?: Params) {
      const r = await q(sql, params);
      return { changes: r.rowCount ?? 0, rows: r.rows as T[] };
    },
  };
}

/** Làm sạch chuỗi kết nối DB để tránh cảnh báo của driver pg. */
function cleanConnectionString(url: string): string {
  // pg tự xử lý SSL; bỏ các tham số libpq mà driver không cần để tránh cảnh báo.
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    // pg hiện coi 'require' là 'verify-full'; ghi rõ để tắt cảnh báo. DB local (không sslmode) giữ nguyên.
    if (u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'verify-full');
    return u.toString();
  } catch {
    // Không phải URL hợp lệ thì giữ nguyên.
    return url;
  }
}

// "Hồ kết nối" dùng chung cả ứng dụng (tạo 1 lần).
let sharedPool: Pool | null = null;
/** Lấy (hoặc tạo lần đầu) hồ kết nối tới Postgres. */
export function getPool(): Pool {
  if (!sharedPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Thiếu biến môi trường DATABASE_URL');
    sharedPool = new Pool({
      connectionString: cleanConnectionString(url),
      // Tối đa 5 kết nối (đổi qua DB_POOL_MAX); đóng kết nối rảnh/hết chờ sau 10 giây.
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    // Ghi log lỗi kết nối thay vì làm sập app.
    sharedPool.on('error', (e) => console.error('[DB] pool error:', e.message));
  }
  return sharedPool;
}

/**
 * Truy cập DB:
 *  - `db.orm` : Drizzle ORM có kiểu (ưu tiên cho CRUD):  `db.orm.select().from(schema.orders).where(eq(schema.orders.id, id))`
 *  - `db.all / db.get / db.run` : SQL thuần với placeholder `?` (cho truy vấn tổng hợp phức tạp).
 *  - `db.tx(async (t) => …)` : transaction; `t.orm` và `t.all/get/run` cùng chạy trong transaction.
 */
@Injectable()
export class DbService implements Queryable, OnModuleDestroy {
  // Bộ all/get/run chạy trên hồ kết nối chung.
  private readonly base = makeQueryable(() => getPool());
  // Drizzle ORM: tên camelCase trong code ↔ snake_case trong DB.
  readonly orm: Orm = drizzle(getPool(), { schema, casing: 'snake_case' });

  /** Lấy mọi dòng kết quả. */
  all<T = Row>(sql: string, params?: Params) {
    return this.base.all<T>(sql, params);
  }
  /** Lấy dòng đầu tiên (hoặc undefined). */
  get<T = Row>(sql: string, params?: Params) {
    return this.base.get<T>(sql, params);
  }
  /** Chạy lệnh INSERT/UPDATE/DELETE, trả số dòng bị ảnh hưởng. */
  run<T = Row>(sql: string, params?: Params) {
    return this.base.run<T>(sql, params);
  }

  /**
   * Transaction: nhiều lệnh "cùng thành công hoặc cùng hủy" (như chuyển khoản: trừ và cộng phải đi đôi).
   * Thay cho `db.transaction(() => …)()` của better-sqlite3.
   * Mọi truy vấn bên trong PHẢI dùng tham số `t`, không dùng `this`.
   */
  async tx<T>(fn: (t: TxQueryable) => Promise<T>): Promise<T> {
    // Mượn một kết nối riêng cho cả transaction.
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // Bộ truy vấn t (SQL thuần + orm) đều chạy trên kết nối này.
      const t: TxQueryable = Object.assign(makeQueryable(() => client), {
        orm: drizzle(client, { schema, casing: 'snake_case' }) as unknown as Orm,
      });
      // Chạy công việc, xong thì lưu chính thức (COMMIT).
      const result = await fn(t);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      // Có lỗi: hủy mọi thay đổi (ROLLBACK) rồi báo lỗi tiếp.
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      // Luôn trả kết nối về hồ.
      client.release();
    }
  }

  /** Khi app tắt: đóng hồ kết nối. */
  async onModuleDestroy() {
    // Trên Vercel instance được tái sử dụng; chỉ đóng pool khi chạy local.
    if (!process.env.VERCEL && sharedPool) {
      await sharedPool.end().catch(() => undefined);
      sharedPool = null;
    }
  }
}
