/** File này: gom controller + service Tài liệu thành 1 module NestJS. Dùng ở: app.module.ts (trang /tai-lieu). */
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

// Khai báo controller (đường dẫn API) và service (xử lý) của module.
@Module({ controllers: [DocumentsController], providers: [DocumentsService] })
export class DocumentsModule {}
