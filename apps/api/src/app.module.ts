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

@Module({
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
  controllers: [HealthController],
})
export class AppModule {}
