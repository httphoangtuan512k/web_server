/**
 * File này: API Bảo trì – bảo dưỡng /api/maintenance; chỉ nhận yêu cầu rồi chuyển cho MaintenanceService xử lý.
 * Dùng ở: trang Bảo trì (bao-tri).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { DbUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators';
import { MaintenanceService } from './maintenance.service';

// Quyền được kiểm trong service (requireAccess): admin, Super Admin hoặc có quyền trang 'baotri'.
@Controller('api/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  /** GET /api/maintenance – danh sách phiếu bảo trì (tối đa 1000, mới nhất trước). */
  @Get()
  list(@CurrentUser() user: DbUser) {
    return this.maintenance.list(user);
  }

  /** GET /api/maintenance/export?month=YYYY-MM – tải Excel bảo trì của tháng (có ảnh). */
  @Get('export')
  async export(@CurrentUser() user: DbUser, @Query('month') month: unknown, @Res() res: Response) {
    // Tạo file rồi gửi về trình duyệt để tải xuống.
    const { filename, buffer } = await this.maintenance.exportMonth(user, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }

  /** POST /api/maintenance – tạo phiếu bảo trì mới. */
  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.maintenance.create(user, body);
  }

  /** PATCH /api/maintenance/:id – sửa phiếu đã lưu (chỉ Super Admin). */
  @Patch(':id')
  update(@CurrentUser() user: DbUser, @Param('id') id: string, @Body() body: any) {
    return this.maintenance.update(user, id, body);
  }

  /** DELETE /api/maintenance/:id – xóa phiếu (chỉ Super Admin). */
  @Delete(':id')
  remove(@CurrentUser() user: DbUser, @Param('id') id: string) {
    return this.maintenance.remove(user, id);
  }
}
