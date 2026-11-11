/**
 * File này: module cơ sở dữ liệu; @Global nên mọi module khác dùng được DbService.
 * Dùng ở: app.module.ts.
 */
import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

@Global()
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}
