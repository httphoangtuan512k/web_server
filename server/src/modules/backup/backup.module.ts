import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({ imports: [MaintenanceModule], controllers: [BackupController], providers: [BackupService], exports: [BackupService] })
export class BackupModule {}
