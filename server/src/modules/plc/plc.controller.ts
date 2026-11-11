import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public, RequirePage, RequireSuper } from '../../auth/decorators';
import type { DbUser } from '../../auth/auth.types';
import { PlcService } from './plc.service';

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

  @Get('plc/latest')
  @RequirePage('vanhanh')
  latest(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.latest();
  }

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

  @Get('plc/history')
  @RequirePage('vanhanh')
  history(@Query() query: any, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.history(query);
  }

  @Get('superadmin/plc-device')
  @RequireSuper()
  device(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.deviceInfo();
  }

  @Post('superadmin/plc-device/key')
  @RequireSuper()
  @HttpCode(200)
  createKey(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.createKey();
  }

  @Delete('superadmin/plc-device/key')
  @RequireSuper()
  revokeKey(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.plc.revokeKey();
  }
}
