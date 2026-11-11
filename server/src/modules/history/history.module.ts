/**
 * File này: đăng ký module Lịch sử (lịch sử thao tác đơn + nhật ký theo ngày).
 * Dùng ở: app.module.ts – trang Quản trị > Nhật ký, trang Vận hành gọi các API này.
 */
import { Module } from '@nestjs/common';
import { HistoryController, LogsController } from './history.controller';

// Gồm 2 controller: /api/history và /api/logs.
@Module({ controllers: [HistoryController, LogsController], providers: [], exports: [] })
export class HistoryModule {}
