/** File này: gom controller + service Kho thành 1 module NestJS. Dùng ở: app.module.ts (trang /kho). */
import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

// Khai báo controller (đường dẫn API) và service (xử lý) của module.
@Module({ controllers: [WarehouseController], providers: [WarehouseService], exports: [WarehouseService] })
export class WarehouseModule {}
