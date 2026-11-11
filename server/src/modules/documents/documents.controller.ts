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

  @Get('users')
  users(@CurrentUser() user: DbUser) {
    this.docs.assertUser(user);
    return this.docs.users();
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.getPermissions(id, this.docs.assertUser(user));
  }

  @Put(':id/permissions')
  setPermissions(@Param('id') id: string, @CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.setPermissions(id, this.docs.assertUser(user), body);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @CurrentUser() user: DbUser, @Res() res: Response) {
    const { file, blob } = await this.docs.openForDownload(id, this.docs.assertUser(user));
    res.setHeader('Content-Type', file.mime_type || blob.blob.contentType || 'application/octet-stream');
    if (blob.blob.size) res.setHeader('Content-Length', String(blob.blob.size));
    res.setHeader('Content-Disposition', contentDisposition(file.original_name));
    res.setHeader('Cache-Control', 'private, no-store');
    Readable.fromWeb(blob.stream as any).pipe(res);
  }

  /** Cập nhật phiên bản: body = { pathname, originalName, size, contentType, lockToken?, expectedVersion? }. */
  @Post(':id/update')
  @HttpCode(200)
  update(@Param('id') id: string, @CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.update(id, this.docs.assertUser(user), body);
  }

  @Post(':id/lock')
  @HttpCode(200)
  lock(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.lock(id, this.docs.assertUser(user));
  }

  @Put(':id/lock/renew')
  renew(@Param('id') id: string, @CurrentUser() user: DbUser, @Body() body: any) {
    return this.docs.renewLock(id, this.docs.assertUser(user), body?.token);
  }

  @Delete(':id/lock')
  unlock(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.unlock(id, this.docs.assertUser(user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.remove(id, this.docs.assertUser(user));
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.docs.history(id, this.docs.assertUser(user));
  }
}
