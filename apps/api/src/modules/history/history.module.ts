import { Module } from '@nestjs/common';
import { HistoryController, LogsController } from './history.controller';

@Module({ controllers: [HistoryController, LogsController], providers: [], exports: [] })
export class HistoryModule {}
