/**
 * File này: module đăng nhập – gồm API login/logout/me, dịch vụ phiên và guard kiểm tra quyền.
 * Dùng ở: app.module.ts.
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';

@Global()
@Module({
  controllers: [AuthController],
  // APP_GUARD: AuthGuard chạy trước mọi API của ứng dụng.
  providers: [SessionService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [SessionService],
})
export class AuthModule {}
