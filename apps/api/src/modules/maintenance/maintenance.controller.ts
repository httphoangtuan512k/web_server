import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DbUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators';
import { MaintenanceService } from './maintenance.service';

@Controller('api/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(@CurrentUser() user: DbUser) {
    return this.maintenance.list(user);
  }

  @Get('export')
  async export(@CurrentUser() user: DbUser, @Query('month') month: unknown, @Res() res: Response) {
    const { filename, buffer } = await this.maintenance.exportMonth(user, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.maintenance.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: DbUser, @Param('id') id: string, @Body() body: any) {
    return this.maintenance.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: DbUser, @Param('id') id: string) {
    return this.maintenance.remove(user, id);
  }
}
