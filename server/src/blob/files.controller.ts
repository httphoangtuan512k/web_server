/**
 * FILE NÀY LÀM GÌ
 *   - GET /api/files/<pathname> – phục vụ ảnh (đơn hàng, bảo trì, avatar) từ Blob private.
 *   - Giống thủ kho: nhận phiếu yêu cầu, kiểm tra hợp lệ, rồi lấy ảnh trong kho đưa ra.
 *   - Yêu cầu đăng nhập (guard toàn cục). Thư mục documents/ và backups/ phải đi qua API riêng có kiểm tra quyền.
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - Trình duyệt gọi khi hiển thị thẻ <img src="/api/files/orders/....jpg">.
 *   - Được đăng ký trong `server/src/blob/blob.module.ts`.
 *
 * LUỒNG CHÍNH
 *   - Lấy pathname từ URL, chỉ cho phép thư mục orders / maintenance / avatars, chặn "..".
 *   - Đọc file từ Blob; không có thì báo 404.
 *   - Đặt các header (loại file, kích thước, cache) rồi "bơm" dữ liệu thẳng về trình duyệt.
 */

// Controller/Get: decorator khai báo quầy và route GET. Req/Res: decorator lấy request/response gốc của Express.
import { Controller, Get, Req, Res } from '@nestjs/common';
// Kiểu Request/Response của Express.
import type { Request, Response } from 'express';
// Readable: công cụ stream của Node.js, dùng để chuyển stream kiểu web sang kiểu Node.
import { Readable } from 'stream';
// Lỗi có mã HTTP + câu tiếng Việt.
import { ApiError } from '../common/api-error';
// Dịch vụ đọc file trên Blob.
import { BlobService } from './blob.service';

/**
 * GET /api/files/<pathname> – phục vụ ảnh (đơn hàng, bảo trì, avatar) từ Blob private.
 * Yêu cầu đăng nhập (guard toàn cục). Thư mục documents/ và backups/ phải đi qua API riêng có kiểm tra quyền.
 */
@Controller('api/files')
export class FilesController {
  // NestJS tự đưa BlobService vào (dependency injection).
  constructor(private readonly blob: BlobService) {}

  /**
   * Trả nội dung một file ảnh.
   * - '*path' = bắt mọi đường dẫn phía sau /api/files/ (vd orders/2026/a.jpg).
   * - Nhận vào: req (để đọc đường dẫn), res (để gửi dữ liệu).
   * - Trả về: không trả giá trị; dữ liệu được ghi thẳng vào res.
   * - Dùng @Res() nên NestJS không tự gửi response; hàm tự lo việc gửi.
   */
  @Get('*path')
  async serve(@Req() req: Request, @Res() res: Response) {
    // Bỏ phần "/api/files/" ở đầu đường dẫn và giải mã ký tự đặc biệt → pathname trên Blob.
    const pathname = decodeURIComponent(req.path.replace(/^\/api\/files\//, ''));
    // Thư mục = đoạn đầu tiên trước dấu '/' (vd "orders").
    const folder = pathname.split('/')[0];
    // Chỉ cho phép 3 thư mục ảnh; và chặn ".." (mẹo "lùi thư mục" để đọc trộm file khác).
    if (!['orders', 'maintenance', 'avatars'].includes(folder) || pathname.includes('..')) {
      // Báo 404 (không nói rõ lý do để không gợi ý cho kẻ xấu).
      throw new ApiError(404, 'Không tìm thấy tệp.');
    }
    // Đọc file từ Blob.
    const r = await this.blob.get(pathname);
    // Không có file → 404.
    if (!r || !r.stream) throw new ApiError(404, 'Không tìm thấy tệp.');
    // Header Content-Type: báo trình duyệt loại file (vd image/jpeg) để hiển thị đúng.
    res.setHeader('Content-Type', r.blob.contentType || 'application/octet-stream');
    // Header Content-Length: kích thước file (byte), nếu biết.
    if (r.blob.size) res.setHeader('Content-Length', String(r.blob.size));
    // Tên file có uuid ngẫu nhiên, nội dung không đổi -> cache lâu trên trình duyệt (private).
    // max-age=31536000 giây = 1 năm; immutable = không bao giờ đổi; private = chỉ trình duyệt người dùng lưu.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    // Chuyển stream kiểu web thành stream Node rồi "pipe" (nối ống) thẳng sang response gửi về trình duyệt.
    Readable.fromWeb(r.stream as any).pipe(res);
  }
}
