import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { Readable } from 'stream';
import type { DbUser } from '../../auth/auth.types';
import { CurrentUser, Public } from '../../auth/decorators';
import { BlobService } from '../../blob/blob.service';
import { ApiError } from '../../common/api-error';
import { vnDateKey } from '../../common/time';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { BackupService } from './backup.service';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

@Controller('api')
export class BackupController {
  constructor(
    private readonly backups: BackupService,
    private readonly maintenance: MaintenanceService,
    private readonly blob: BlobService,
  ) {}

  // Server cũ: chỉ kiểm tra is_super (không qua requireSuperAdmin) với câu thông báo riêng.

  @Get('superadmin/backups')
  async list(@CurrentUser() user: DbUser) {
    if (!user?.isSuper) throw new ApiError(403, 'Chỉ Super Admin được xem bản sao lưu.');
    try {
      const rows = await this.backups.listBackups();
      return { rows: rows.map(({ urls: _urls, ...r }) => r) };
    } catch (e) {
      console.error('[BACKUP] Đọc danh sách:', e);
      throw new ApiError(500, 'Không đọc được danh sách sao lưu.');
    }
  }

  @Post('superadmin/backups')
  @HttpCode(200)
  async create(@CurrentUser() user: DbUser) {
    if (!user?.isSuper) throw new ApiError(403, 'Chỉ Super Admin được tạo bản sao lưu.');
    const r = await this.backups.createFullBackup('manual');
    if (!r) throw new ApiError(500, 'Sao lưu thất bại. Kiểm tra quyền ghi thư mục BACKUPS.');
    return { ok: true, name: r.name, path: r.path };
  }

  @Get('superadmin/backups/download')
  async download(@CurrentUser() user: DbUser, @Query('path') path: unknown, @Res() res: Response) {
    if (!user?.isSuper) throw new ApiError(403, 'Chỉ Super Admin được tải bản sao lưu.');
    if (!this.backups.isDownloadablePath(path)) throw new ApiError(400, 'Đường dẫn bản sao lưu không hợp lệ.');
    let r: Awaited<ReturnType<BlobService['get']>> = null;
    try {
      r = await this.blob.get(path);
    } catch (e) {
      r = null;
    }
    if (!r || r.statusCode !== 200 || !r.stream) throw new ApiError(404, 'Không tìm thấy file sao lưu.');
    const filename = path.split('/').slice(-2).join('_');
    res.setHeader('Content-Type', r.blob.contentType || 'application/octet-stream');
    if (r.blob.size != null) res.setHeader('Content-Length', String(r.blob.size));
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'no-store');
    Readable.fromWeb(r.stream as any).pipe(res);
  }

  /** Vercel Cron 23:59 giờ VN: sao lưu 'daily' + xuất Excel bảo trì trong ngày + dọn bản daily cũ. */
  @Public()
  @Get('cron/daily-backup')
  async cron(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const secret = process.env.CRON_SECRET || '';
    const auth = String(req.headers.authorization || '');
    if (!secret || !safeEqual(auth, `Bearer ${secret}`)) throw new ApiError(401, 'Không có quyền chạy tác vụ định kỳ.');

    const date = vnDateKey();
    const errors: string[] = [];
    const backup = await this.backups.createFullBackup('daily');
    if (!backup) errors.push('Sao lưu thất bại hoặc đang có tiến trình sao lưu khác.');

    let maintenanceExport: { pathname: string; count: number } | null = null;
    try {
      maintenanceExport = await this.maintenance.exportDay(date);
      console.log(`[BẢO TRÌ] Đã xuất Excel kèm ảnh ngày ${date}: ${maintenanceExport.pathname}`);
    } catch (e) {
      console.error('[BẢO TRÌ] Lỗi xuất tự động:', e);
      errors.push('Không thể xuất Excel bảo trì.');
    }

    let removed: string[] = [];
    if (backup) {
      try {
        removed = await this.backups.pruneDaily();
      } catch (e) {
        console.error('[BACKUP] Lỗi dọn bản sao lưu cũ:', e);
        errors.push('Không thể xóa bản sao lưu cũ.');
      }
    }
    if (errors.length) res.status(500);
    return { ok: errors.length === 0, date, backup: backup?.name ?? null, maintenanceExport, removed, errors };
  }
}
