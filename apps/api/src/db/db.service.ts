import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient, types } from 'pg';
import * as schema from './schema';

// BIGINT (COUNT, SUM số nguyên) và NUMERIC trả về number thay vì string, giống better-sqlite3.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));
// DATE giữ nguyên chuỗi 'YYYY-MM-DD' (không đổi sang Date để tránh lệch múi giờ).
types.setTypeParser(1082, (v) => v);

export type Orm = NodePgDatabase<typeof schema>;
export { schema };

export type Params = unknown[];
export type Row = Record<string, any>;

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
  let n = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      out += c;
      if (c === quote) {
        if (sql[i + 1] === quote) out += sql[++i];
        else quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      out += c;
      continue;
    }
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
  all<T = Row>(sql: string, params?: Params): Promise<T[]>;
  get<T = Row>(sql: string, params?: Params): Promise<T | undefined>;
  run<T = Row>(sql: string, params?: Params): Promise<RunResult<T>>;
}

type Executor = Pool | PoolClient;

export interface TxQueryable extends Queryable {
  orm: Orm;
}

function makeQueryable(exec: () => Executor): Queryable {
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

function cleanConnectionString(url: string): string {
  // pg tự xử lý SSL; bỏ các tham số libpq mà driver không cần để tránh cảnh báo.
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    u.searchParams.set('sslmode', 'verify-full');
    return u.toString();
  } catch {
    return url;
  }
}

let sharedPool: Pool | null = null;
export function getPool(): Pool {
  if (!sharedPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Thiếu biến môi trường DATABASE_URL');
    sharedPool = new Pool({
      connectionString: cleanConnectionString(url),
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
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
  private readonly base = makeQueryable(() => getPool());
  readonly orm: Orm = drizzle(getPool(), { schema, casing: 'snake_case' });

  all<T = Row>(sql: string, params?: Params) {
    return this.base.all<T>(sql, params);
  }
  get<T = Row>(sql: string, params?: Params) {
    return this.base.get<T>(sql, params);
  }
  run<T = Row>(sql: string, params?: Params) {
    return this.base.run<T>(sql, params);
  }

  /**
   * Thay cho `db.transaction(() => …)()` của better-sqlite3.
   * Mọi truy vấn bên trong PHẢI dùng tham số `t`, không dùng `this`.
   */
  async tx<T>(fn: (t: TxQueryable) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const t: TxQueryable = Object.assign(makeQueryable(() => client), {
        orm: drizzle(client, { schema, casing: 'snake_case' }) as unknown as Orm,
      });
      const result = await fn(t);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    // Trên Vercel instance được tái sử dụng; chỉ đóng pool khi chạy local.
    if (!process.env.VERCEL && sharedPool) {
      await sharedPool.end().catch(() => undefined);
      sharedPool = null;
    }
  }
}
