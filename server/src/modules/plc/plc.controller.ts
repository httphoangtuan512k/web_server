/**
 * File này: các đường dẫn API của PLC Máy B (/api/plc/..., /api/superadmin/plc-device...).
 * Dùng ở: chương trình C# trên Máy B, trang Vận hành / PLC, trang Quản trị › Hệ thống.
 */
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public, RequirePage, RequireSuper } from '../../auth/decorators';
import type { DbUser } from '../../auth/auth.types';
import { PlcService } from './plc.service';

// Cấm trình duyệt lưu đệm số liệu cũ.
const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

@Controller('api')
export class PlcController {
  constructor(private readonly plc: PlcService) {}

  /** C# Máy B gửi một payload gồm dữ liệu của cả 4 máy trong mỗi lần POST (xác thực bằng header x-api-key). */
  @Public()
  @Post('plc/telemetry')
  @HttpCode(200)
  telemetry(@Headers('x-api-key') apiKey: string | undefined, @Body() body: any) {
    return this.plc.telemetry(String(apiKey || ''), body);
  }

  /** Số liệu mới nhất + tồn phễu/silo 4 máy (quyền trang Vận hành). */
  @Get('plc/latest')
  @RequirePage('vanhanh')
  latest(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.latest();
  }

  /** Sửa 1 thông số vận hành của 1 máy (cần quyền vận hành). */
  @Patch('plc/operation-state/:machine')
  @RequirePage('vanhanh')
  async updateOperationState(
    @Param('machine') machine: string,
    @Body() body: any,
    @CurrentUser() user: DbUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.plc.assertOperator(user);
    const result = await this.plc.updateOperationState(machine, body);
    noStore(res);
    return result;
  }

  /** Lịch sử số liệu theo ngày (quyền trang Vận hành). */
  @Get('plc/history')
  @RequirePage('vanhanh')
  history(@Query() query: any, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.history(query);
  }

  /** Super Admin: xem tình trạng API Key / kết nối. */
  @Get('superadmin/plc-device')
  @RequireSuper()
  device(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.deviceInfo();
  }

  /** Super Admin: tạo API Key mới. */
  @Post('superadmin/plc-device/key')
  @RequireSuper()
  @HttpCode(200)
  createKey(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.createKey();
  }

  /** Super Admin: thu hồi API Key. */
  @Delete('superadmin/plc-device/key')
  @RequireSuper()
  revokeKey(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.revokeKey();
  }
}
