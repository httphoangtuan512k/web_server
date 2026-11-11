/**
 * FILE NÀY LÀM GÌ
 *   - Gom các phần làm việc với Vercel Blob (kho lưu file trên mạng: ảnh, tài liệu, bản sao lưu)
 *     thành một module của NestJS.
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - Được nạp trong `server/src/app.module.ts`.
 *   - BlobService được các module nghiệp vụ (đơn hàng, bảo trì, tài liệu, sao lưu…) dùng để lưu/đọc file.
 *
 * LUỒNG CHÍNH
 *   - Đăng ký BlobService (dịch vụ lưu/đọc/xóa file).
 *   - Đăng ký FilesController (GET /api/files/... trả ảnh) và UploadsController (cấp quyền upload).
 *   - Đánh dấu @Global để mọi module khác dùng BlobService mà không phải import lại.
 */

// Global: decorator làm module dùng được ở mọi nơi. Module: decorator khai báo module.
import { Global, Module } from '@nestjs/common';
// Dịch vụ thao tác file trên Vercel Blob.
import { BlobService } from './blob.service';
// Controller trả file ảnh cho trình duyệt.
import { FilesController } from './files.controller';
// Controller cấp "vé" upload thẳng lên Blob.
import { UploadsController } from './uploads.controller';

// @Global(): như "kho dụng cụ chung" của cả nhà máy – phòng nào cũng lấy được BlobService.
@Global()
// providers: các dịch vụ do module này tạo ra; controllers: các "quầy" nhận request;
// exports: dịch vụ cho phép module khác dùng.
@Module({ providers: [BlobService], controllers: [FilesController, UploadsController], exports: [BlobService] })
export class BlobModule {}
