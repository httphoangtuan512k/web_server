/** File này: gom controller + service Super Data (sửa dữ liệu thô) thành 1 module. Dùng ở: app.module.ts. */
import { Module } from '@nestjs/common';
import { SuperDataController } from './super-data.controller';
import { SuperDataService } from './super-data.service';

// Khai báo controller (đường dẫn API) và service (xử lý) của module.
@Module({ controllers: [SuperDataController], providers: [SuperDataService] })
export class SuperDataModule {}
