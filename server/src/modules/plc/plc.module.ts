/** File này: gom controller + service PLC thành 1 module NestJS. Dùng ở: app.module.ts. */
import { Module } from '@nestjs/common';
import { PlcController } from './plc.controller';
import { PlcService } from './plc.service';

// Khai báo controller (đường dẫn API) và service (xử lý) của module.
@Module({ controllers: [PlcController], providers: [PlcService], exports: [PlcService] })
export class PlcModule {}
