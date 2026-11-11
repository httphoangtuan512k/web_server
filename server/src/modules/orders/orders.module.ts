/**
 * File này: đăng ký module Đơn hàng (gắn OrdersController vào app NestJS).
 * Dùng ở: app.module.ts – để các API /api/orders hoạt động.
 */
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';

// Module chỉ có 1 controller, không có service riêng.
@Module({ controllers: [OrdersController], providers: [], exports: [] })
export class OrdersModule {}
