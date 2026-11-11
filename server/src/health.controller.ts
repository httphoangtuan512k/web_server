/**
 * File này: GET /api/health – kiểm tra API và cơ sở dữ liệu còn hoạt động không.
 * Dùng ở: đăng ký trong app.module.ts; người quản trị/công cụ giám sát gọi.
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators';
import { DbService } from './db/db.service';

@Controller('api/health')
export class HealthController {
  // NestJS tự đưa DbService vào để dùng.
  constructor(private readonly db: DbService) {}

  /** Không cần đăng nhập; trả { ok: true, db: giờ hiện tại của DB }. */
  @Public()
  @Get()
  async health() {
    // Hỏi DB giờ hiện tại – trả lời được nghĩa là DB đang chạy.
    const r = await this.db.get<{ now: string }>('SELECT now()::text AS now');
    return { ok: true, db: r?.now ?? null };
  }
}
