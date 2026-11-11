/**
 * FILE NÀY LÀM GÌ
 *   - POST /api/uploads/token – cấp token để trình duyệt upload THẲNG lên Vercel Blob
 *     (tránh giới hạn 4,5 MB body của Vercel Functions). Dùng với `upload()` của '@vercel/blob/client'.
 *   - "Token" giống một tờ giấy phép tạm thời: cho phép trình duyệt gửi đúng một file, đúng loại,
 *     không quá dung lượng, vào đúng thư mục.
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - Giao diện (frontend) gọi gián tiếp qua hàm `upload()` của thư viện @vercel/blob/client
 *     khi người dùng chọn ảnh đơn hàng/bảo trì/avatar hoặc file Excel tài liệu.
 *   - Sau khi upload xong, frontend gửi `'/api/files/' + blob.pathname` (ảnh) hoặc `blob.pathname` (tài liệu) cho API nghiệp vụ.
 *
 * LUỒNG CHÍNH
 *   - Người dùng phải đăng nhập (guard toàn cục kiểm tra).
 *   - Xem thư mục đích: documents → chỉ nhận Excel ≤ 50 MB; orders/maintenance/avatars → chỉ nhận ảnh ≤ 15 MB.
 *   - Thư mục khác hoặc đường dẫn có ".." → báo lỗi 400.
 */

// Body/Req: lấy body/request. Controller/Post: khai báo quầy & route POST. HttpCode: đặt mã HTTP trả về.
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
// Kiểu Request của Express.
import type { Request } from 'express';
// handleUpload: hàm của Vercel Blob xử lý việc cấp token upload. HandleUploadBody: kiểu dữ liệu body gửi lên.
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
// Lỗi có mã HTTP + câu tiếng Việt.
import { ApiError } from '../common/api-error';
// CurrentUser: decorator lấy người dùng đang đăng nhập.
import { CurrentUser } from '../auth/decorators';
// Kiểu dữ liệu một người dùng trong DB.
import type { DbUser } from '../auth/auth.types';

// Danh sách loại file ảnh được phép tải lên (JPEG, PNG, WebP, GIF, HEIC của iPhone).
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
// Danh sách loại file Excel được phép tải lên.
const EXCEL_TYPES = [
  // .xlsx (Excel thông thường).
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // .xlsm (Excel có macro).
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  // .xls (Excel đời cũ).
  'application/vnd.ms-excel',
  // .xlsb (Excel nhị phân có macro).
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  // Loại chung "dữ liệu nhị phân" – một số trình duyệt gửi loại này cho file Excel.
  'application/octet-stream',
];

/**
 * POST /api/uploads/token – cấp token để trình duyệt upload THẲNG lên Vercel Blob
 * (tránh giới hạn 4,5 MB body của Vercel Functions). Dùng với `upload()` của '@vercel/blob/client'.
 * Sau khi upload xong, frontend gửi `'/api/files/' + blob.pathname` (ảnh) hoặc `blob.pathname` (tài liệu) cho API nghiệp vụ.
 */
@Controller('api/uploads')
export class UploadsController {
  /**
   * POST /api/uploads/token
   * - Nhận vào: body (yêu cầu từ thư viện upload), user (người đang đăng nhập), req (request gốc).
   * - Trả về: phản hồi do handleUpload tạo (chứa token upload cho trình duyệt).
   * - @HttpCode(200): trả mã 200 (mặc định POST của NestJS là 201 "đã tạo").
   */
  @Post('token')
  @HttpCode(200)
  async token(@Body() body: HandleUploadBody, @CurrentUser() user: DbUser, @Req() req: Request) {
    // Giao cho thư viện Vercel Blob xử lý, kèm quy tắc kiểm tra riêng của app.
    return handleUpload({
      // Nội dung yêu cầu và request gốc.
      body,
      request: req,
      // Hàm chạy TRƯỚC khi cấp token: quyết định có cho upload không và với giới hạn gì.
      // Nhận vào pathname (tên file muốn lưu, vd "orders/abc.jpg").
      onBeforeGenerateToken: async (pathname) => {
        // Thư mục đích = đoạn đầu trước dấu '/'.
        const folder = pathname.split('/')[0];
        // Chặn ".." (cố tình lùi thư mục để ghi ra ngoài chỗ cho phép).
        if (pathname.includes('..')) throw new ApiError(400, 'Đường dẫn không hợp lệ.');
        // Thư mục tài liệu: chỉ nhận Excel, tối đa 50 MB (50 × 1024 × 1024 byte),
        // thêm đuôi ngẫu nhiên vào tên, ghi kèm id người upload (tokenPayload).
        if (folder === 'documents') {
          return { allowedContentTypes: EXCEL_TYPES, maximumSizeInBytes: 50 * 1024 * 1024, addRandomSuffix: true, tokenPayload: String(user.id) };
        }
        // Thư mục ảnh: chỉ nhận ảnh, tối đa 15 MB.
        if (['orders', 'maintenance', 'avatars'].includes(folder)) {
          return { allowedContentTypes: IMAGE_TYPES, maximumSizeInBytes: 15 * 1024 * 1024, addRandomSuffix: true, tokenPayload: String(user.id) };
        }
        // Thư mục khác → từ chối.
        throw new ApiError(400, 'Thư mục upload không hợp lệ.');
      },
      // Không dùng onUploadCompleted (cần URL public); frontend tự báo kết quả cho API nghiệp vụ.
    });
  }
}
