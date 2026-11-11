import './server/scripts/load-env';
import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit: schema ở server/src/db/schema.ts, migration sinh vào server/db/migrations. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/src/db/schema.ts',
  out: './server/db/migrations',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
