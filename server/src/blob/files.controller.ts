/**
 * File này: GET /api/files/<pathname> – trả ảnh (đơn hàng, bảo trì, avatar) từ Blob private.
 * Dùng ở: thẻ <img src="/api/files/..."> trên giao diện.
 */
import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'stream';
import { ApiError } from '../common/api-error';
import { BlobService } from './blob.service';

/**
 * GET /api/files/<pathname> – phục vụ ảnh (đơn hàng, bảo trì, avatar) từ Blob private.
 * Yêu cầu đăng nhập (guard toàn cục). Thư mục documents/ và backups/ phải đi qua API riêng có kiểm tra quyền.
 */
@Controller('api/files')
export class FilesController {
  constructor(private readonly blob: BlobService) {}

  /** Trả nội dung một file ảnh ('*path' = mọi đường con sau /api/files/). */
  @Get('*path')
  async serve(@Req() req: Request, @Res() res: Response) {
    // Lấy pathname trên Blob từ URL.
    const pathname = decodeURIComponent(req.path.replace(/^\/api\/files\//, ''));
    const folder = pathname.split('/')[0];
    // Chỉ cho 3 thư mục ảnh; chặn ".." (lùi thư mục để đọc trộm).
    if (!['orders', 'maintenance', 'avatars'].includes(folder) || pathname.includes('..')) {
      throw new ApiError(404, 'Không tìm thấy tệp.');
    }
    const r = await this.blob.get(pathname);
    if (!r || !r.stream) throw new ApiError(404, 'Không tìm thấy tệp.');
    // Báo loại file và kích thước cho trình duyệt.
    res.setHeader('Content-Type', r.blob.contentType || 'application/octet-stream');
    if (r.blob.size) res.setHeader('Content-Length', String(r.blob.size));
    // Tên file có uuid ngẫu nhiên, nội dung không đổi -> cache lâu trên trình duyệt (private).
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    // Chuyển dữ liệu thẳng từ Blob về trình duyệt.
    Readable.fromWeb(r.stream as any).pipe(res);
  }
}
