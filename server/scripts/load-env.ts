/**
 * Nạp biến môi trường cho các script DB giống Next.js: .env.local rồi .env (biến đã có sẵn trong shell được ưu tiên).
 * Muốn chạy với Neon thật: DATABASE_URL=<neon-url> npm run db:migrate
 */
import { config } from 'dotenv';
import { join } from 'path';

const root = join(__dirname, '..', '..');
for (const file of ['.env.local', '.env']) config({ path: join(root, file), quiet: true });
