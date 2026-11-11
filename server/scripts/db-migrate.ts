import './load-env';
/**
 * Áp dụng các migration chưa chạy trong db/migrations (Drizzle lưu trạng thái ở bảng drizzle.__drizzle_migrations).
 *   npm run db:migrate
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { getPool } from '../src/db/db.service';

async function main() {
  const pool = getPool();
  await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', 'db', 'migrations') });
  const r = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
  console.log(`Migrate OK – ${r.rowCount} bảng:`, r.rows.map((x) => x.table_name).join(', '));
  await pool.end();
}
main().catch((e) => {
  console.error('Migrate lỗi:', e);
  process.exit(1);
});
