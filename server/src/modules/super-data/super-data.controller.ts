/**
 * File này: API trình quản trị dữ liệu gốc (/api/super-data/...) – xem, sửa, xóa từng dòng của các bảng cho phép.
 * Dùng ở: trang Quản trị › Dữ liệu (/quan-tri/du-lieu), chỉ Super Admin.
 */
import { Body, Controller, Delete, Get, Param, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequireSuper } from '../../auth/decorators';
import { SuperDataService } from './super-data.service';

/** Trình quản trị dữ liệu gốc – chỉ Super Admin. */
@Controller('api/super-data')
@RequireSuper()
export class SuperDataController {
  constructor(private readonly svc: SuperDataService) {}

  /** Danh sách bảng được phép xem. */
  @Get('tables')
  async tables(@Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.svc.tables();
  }

  /** Đọc tối đa 200 dòng của 1 bảng, có thể tìm theo ?q=. */
  @Get(':table')
  async read(@Param('table') table: string, @Query('q') q: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.svc.read(table, q);
    res.set('Cache-Control', 'no-store');
    return result;
  }

  /** Sửa 1 dòng: body { key: khóa chính, values: cột mới }. */
  @Patch(':table')
  update(@Param('table') table: string, @Body() body: any) {
    return this.svc.update(table, body);
  }

  /** Xóa 1 dòng: body { key: khóa chính }. */
  @Delete(':table')
  remove(@Param('table') table: string, @Body() body: any) {
    return this.svc.remove(table, body);
  }
}
