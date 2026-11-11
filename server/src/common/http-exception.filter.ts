/**
 * File này: bộ bắt lỗi chung – mọi lỗi của API đều trả về dạng { error: "câu thông báo" }.
 * Dùng ở: bootstrap.ts (app.useGlobalFilters).
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

/** Chuẩn hóa mọi lỗi về `{ error: string }` như Express cũ. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /** NestJS tự gọi khi có lỗi; gửi JSON lỗi về trình duyệt. */
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    // Response đã gửi dở thì không gửi lỗi được nữa.
    if (res.headersSent) return;
    // Lỗi HTTP có chủ đích (ApiError, BadRequest…): giữ mã, chuẩn hóa nội dung.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // Đã đúng dạng { error } (do ApiError tạo) thì gửi nguyên.
      if (body && typeof body === 'object' && typeof (body as any).error === 'string' && !('statusCode' in body)) {
        return res.status(status).json(body);
      }
      // Dạng mặc định của Nest: rút câu thông báo ra.
      const message = typeof body === 'string' ? body : (body as any)?.message ?? exception.message;
      // Lỗi cú pháp JSON của body-parser bị Nest bọc thành BadRequestException với câu tiếng Anh.
      if (status === 400 && /JSON|Unexpected token|Unexpected end/i.test(String(message))) {
        return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
      }
      // Nhiều lỗi (mảng) thì nối bằng dấu phẩy.
      return res.status(status).json({ error: Array.isArray(message) ? message.join(', ') : String(message) });
    }
    // Lỗi khi đọc body: quá 5 MB hoặc JSON hỏng.
    const err = exception as any;
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
    // Lỗi bất ngờ: ghi log, trả câu chung (không lộ chi tiết kỹ thuật).
    console.error('Lỗi Server:', exception);
    return res.status(500).json({ error: 'Máy chủ gặp lỗi.' });
  }
}
