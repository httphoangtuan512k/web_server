import { Module } from '@nestjs/common';
import { PlcController } from './plc.controller';
import { PlcService } from './plc.service';

@Module({ controllers: [PlcController], providers: [PlcService], exports: [PlcService] })
export class PlcModule {}
