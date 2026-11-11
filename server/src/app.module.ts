/**
 * File này: module gốc của API NestJS – liệt kê mọi "phòng ban" (module) của ứng dụng.
 * Dùng ở: server/src/bootstrap.ts (NestFactory.create(AppModule)).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BlobModule } from './blob/blob.module';
import { DbModule } from './db/db.module';
import { BackupModule } from './modules/backup/backup.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HistoryModule } from './modules/history/history.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PlcModule } from './modules/plc/plc.module';
import { SuperDataModule } from './modules/super-data/super-data.module';
import { UsersModule } from './modules/users/users.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { HealthController } from './health.controller';

// @Module: "nhãn" khai báo các module con và controller của ứng dụng.
@Module({
  // Module nền tảng (DB, file, đăng nhập) trước, rồi các module nghiệp vụ.
  imports: [
    DbModule,
    BlobModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    HistoryModule,
    MaintenanceModule,
    BackupModule,
    WarehouseModule,
    SuperDataModule,
    PlcModule,
    DocumentsModule,
  ],
  // Chỉ có /api/health đặt trực tiếp ở module gốc.
  controllers: [HealthController],
})
export class AppModule {}
