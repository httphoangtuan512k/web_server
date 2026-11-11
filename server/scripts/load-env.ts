/**
 * File này: nạp biến môi trường cho các script DB giống Next.js: .env.local rồi .env (biến đã có sẵn trong shell được ưu tiên).
 * Dùng ở: các script trong server/scripts và drizzle.config.ts. Muốn chạy với Neon thật: DATABASE_URL=<neon-url> npm run db:migrate
 */
import { config } from 'dotenv';
import { join } from 'path';

// Thư mục gốc dự án (lùi 2 cấp từ server/scripts).
const root = join(__dirname, '..', '..');
// Đọc lần lượt .env.local rồi .env (không in thông báo).
for (const file of ['.env.local', '.env']) config({ path: join(root, file), quiet: true });
