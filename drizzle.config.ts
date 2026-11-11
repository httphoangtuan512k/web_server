/**
 * File này: cấu hình Drizzle Kit – công cụ sinh migration SQL từ bản thiết kế bảng.
 * Dùng ở: npm run db:generate / db:studio.
 */
// Nạp DATABASE_URL… từ .env.local trước.
import './server/scripts/load-env';
import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit: schema ở server/src/db/schema.ts, migration sinh vào server/db/migrations. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/src/db/schema.ts',
  out: './server/db/migrations',
  // Tên camelCase trong code thành snake_case trong DB (createdAt → created_at).
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Hỏi xác nhận thay đổi nguy hiểm; in chi tiết SQL.
  strict: true,
  verbose: true,
});
