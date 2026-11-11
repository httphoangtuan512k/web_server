/**
 * File này: đăng ký module Sao lưu (sao lưu DB lên Blob + cron hằng ngày).
 * Dùng ở: app.module.ts; cần MaintenanceModule để cron xuất Excel bảo trì.
 */
import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

// Nạp MaintenanceModule để dùng MaintenanceService.exportDay trong cron.
@Module({ imports: [MaintenanceModule], controllers: [BackupController], providers: [BackupService], exports: [BackupService] })
export class BackupModule {}
