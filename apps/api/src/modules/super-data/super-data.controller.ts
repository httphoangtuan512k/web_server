import { Body, Controller, Delete, Get, Param, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequireSuper } from '../../auth/decorators';
import { SuperDataService } from './super-data.service';

/** Trình quản trị dữ liệu gốc – chỉ Super Admin. */
@Controller('api/super-data')
@RequireSuper()
export class SuperDataController {
  constructor(private readonly svc: SuperDataService) {}

  @Get('tables')
  async tables(@Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.svc.tables();
  }

  @Get(':table')
  async read(@Param('table') table: string, @Query('q') q: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.svc.read(table, q);
    res.set('Cache-Control', 'no-store');
    return result;
  }

  @Patch(':table')
  update(@Param('table') table: string, @Body() body: any) {
    return this.svc.update(table, body);
  }

  @Delete(':table')
  remove(@Param('table') table: string, @Body() body: any) {
    return this.svc.remove(table, body);
  }
}
