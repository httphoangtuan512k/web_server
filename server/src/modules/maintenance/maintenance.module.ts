/**
 * File này: đăng ký module Bảo trì – bảo dưỡng (controller + service).
 * Dùng ở: app.module.ts; MaintenanceService được xuất cho module khác dùng (vd cron xuất Excel hằng ngày).
 */
import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

// Xuất MaintenanceService để module khác (cron) gọi exportDay.
@Module({ controllers: [MaintenanceController], providers: [MaintenanceService], exports: [MaintenanceService] })
export class MaintenanceModule {}
