/**
 * File này: API trang Tài liệu (/api/tai-lieu/...) – danh sách, tải lên/xuống, cập nhật phiên bản, khóa sửa, phân quyền, lịch sử.
 * Dùng ở: trang /tai-lieu (file Excel dùng chung, lưu trên Vercel Blob).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';
import { CurrentUser } from '../../auth/decorators';
import type { DbUser } from '../../auth/auth.types';
import { DocumentsService } from './documents.service';

/** Content-Disposition với tên gốc tiếng Việt (RFC 5987) + tên ASCII dự phòng. */
function contentDisposition(name: string) {
  const fallback = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Phân hệ tài liệu Excel dùng chung (excel-manager.js cũ). File nằm trên Vercel Blob (private) dưới documents/. */
@Controller('api/tai-lieu')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  /** Danh sách tài liệu người dùng được xem. */
  @Get('files')
  list(@CurrentUser() user: DbUser) {
    return this.docs.list(this.docs.assertUser(user));
  }

  /** Bước 2 của upload: file đã nằm trên Blob, body = { pathname, originalName, size, contentType }. */
  @Post('upload')
  @HttpCode(200)
  upload(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.upload(this.docs.assertUser(user), body);
  }

  /** Danh sách người dùng có thể chia quyền. */
  @Get('users')
  users(@CurrentUser() user: DbUser) {
    this.docs.assertUser(user);
    return this.docs.users();
  }

  /** Xem phân quyền của 1 tài liệu (chủ sở hữu / Super Admin). */
  @Get(':id/permissions')
  getPermissions(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.getPermissions(id, this.docs.assertUser(user));
  }

  /** Lưu phân quyền của 1 tài liệu (chủ sở hữu / Super Admin). */
  @Put(':id/permissions')
  setPermissions(@Param('id') id: string, @CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.setPermissions(id, this.docs.assertUser(user), body);
  }

  /** Tải file về: đặt header rồi truyền dữ liệu từ Blob thẳng xuống trình duyệt. */
  @Get(':id/download')
  async download(@Param('id') id: string, @CurrentUser() user: DbUser, @Res() res: Response) {
    const { file, blob } = await this.docs.openForDownload(id, this.docs.assertUser(user));
    res.setHeader('Content-Type', file.mime_type || blob.blob.contentType || 'application/octet-stream');
    if (blob.blob.size) res.setHeader('Content-Length', String(blob.blob.size));
    res.setHeader('Content-Disposition', contentDisposition(file.original_name));
    res.setHeader('Cache-Control', 'private, no-store');
    // Chuyển luồng dữ liệu (stream) từ Blob sang phản hồi, không cần nạp cả file vào bộ nhớ.
    Readable.fromWeb(blob.stream as any).pipe(res);
  }

  /** Cập nhật phiên bản: body = { pathname, originalName, size, contentType, lockToken?, expectedVersion? }. */
  @Post(':id/update')
  @HttpCode(200)
  update(@Param('id') id: string, @CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.update(id, this.docs.assertUser(user), body);
  }

  /** Nhận khóa chỉnh sửa 3 phút (không ai khác cập nhật được trong lúc đó). */
  @Post(':id/lock')
  @HttpCode(200)
  lock(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.lock(id, this.docs.assertUser(user));
  }

  /** Gia hạn khóa chỉnh sửa thêm 3 phút. */
  @Put(':id/lock/renew')
  renew(@Param('id') id: string, @CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.renewLock(id, this.docs.assertUser(user), body?.token);
  }

  /** Nhả khóa chỉnh sửa. */
  @Delete(':id/lock')
  unlock(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.unlock(id, this.docs.assertUser(user));
  }

  /** Xóa tài liệu (xóa mềm). */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.remove(id, this.docs.assertUser(user));
  }

  /** Lịch sử thao tác trên tài liệu (chủ sở hữu / Super Admin). */
  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.history(id, this.docs.assertUser(user));
  }
}
