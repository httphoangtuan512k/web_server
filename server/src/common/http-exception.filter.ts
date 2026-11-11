import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

/** Chuẩn hóa mọi lỗi về `{ error: string }` như Express cũ. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (body && typeof body === 'object' && typeof (body as any).error === 'string' && !('statusCode' in body)) {
        return res.status(status).json(body);
      }
      const message = typeof body === 'string' ? body : (body as any)?.message ?? exception.message;
      // Lỗi cú pháp JSON của body-parser bị Nest bọc thành BadRequestException với câu tiếng Anh.
      if (status === 400 && /JSON|Unexpected token|Unexpected end/i.test(String(message))) {
        return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
      }
      return res.status(status).json({ error: Array.isArray(message) ? message.join(', ') : String(message) });
    }
    const err = exception as any;
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
    console.error('Lỗi Server:', exception);
    return res.status(500).json({ error: 'Máy chủ gặp lỗi.' });
  }
}
