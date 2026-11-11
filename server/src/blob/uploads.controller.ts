import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { ApiError } from '../common/api-error';
import { CurrentUser } from '../auth/decorators';
import type { DbUser } from '../auth/auth.types';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/octet-stream',
];

/**
 * POST /api/uploads/token – cấp token để trình duyệt upload THẲNG lên Vercel Blob
 * (tránh giới hạn 4,5 MB body của Vercel Functions). Dùng với `upload()` của '@vercel/blob/client'.
 * Sau khi upload xong, frontend gửi `'/api/files/' + blob.pathname` (ảnh) hoặc `blob.pathname` (tài liệu) cho API nghiệp vụ.
 */
@Controller('api/uploads')
export class UploadsController {
  @Post('token')
  @HttpCode(200)
  async token(@Body() body: HandleUploadBody, @CurrentUser() user: DbUser, @Req() req: Request) {
    return handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const folder = pathname.split('/')[0];
        if (pathname.includes('..')) throw new ApiError(400, 'Đường dẫn không hợp lệ.');
        if (folder === 'documents') {
          return { allowedContentTypes: EXCEL_TYPES, maximumSizeInBytes: 50 * 1024 * 1024, addRandomSuffix: true, tokenPayload: String(user.id) };
        }
        if (['orders', 'maintenance', 'avatars'].includes(folder)) {
          return { allowedContentTypes: IMAGE_TYPES, maximumSizeInBytes: 15 * 1024 * 1024, addRandomSuffix: true, tokenPayload: String(user.id) };
        }
        throw new ApiError(400, 'Thư mục upload không hợp lệ.');
      },
      // Không dùng onUploadCompleted (cần URL public); frontend tự báo kết quả cho API nghiệp vụ.
    });
  }
}
