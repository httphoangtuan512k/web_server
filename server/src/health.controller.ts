import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators';
import { DbService } from './db/db.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Public()
  @Get()
  async health() {
    const r = await this.db.get<{ now: string }>('SELECT now()::text AS now');
    return { ok: true, db: r?.now ?? null };
  }
}
