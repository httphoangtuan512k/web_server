/**
 * File này: đăng ký module Người dùng (quản lý tài khoản + lịch sử đăng nhập).
 * Dùng ở: app.module.ts – trang Quản trị > Người dùng gọi các API này.
 */
import { Module } from '@nestjs/common';
import { LoginSessionsController, UsersController } from './users.controller';

// Gồm 2 controller: /api/users và /api/super/login-sessions.
@Module({ controllers: [UsersController, LoginSessionsController], providers: [], exports: [] })
export class UsersModule {}
