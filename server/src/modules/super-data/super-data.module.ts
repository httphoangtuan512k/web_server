import { Module } from '@nestjs/common';
import { SuperDataController } from './super-data.controller';
import { SuperDataService } from './super-data.service';

@Module({ controllers: [SuperDataController], providers: [SuperDataService] })
export class SuperDataModule {}
