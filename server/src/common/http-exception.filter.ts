/**
 * FILE NÀY LÀM GÌ
 *   - Bộ lọc lỗi chung: bắt MỌI lỗi xảy ra trong API và trả về trình duyệt theo một dạng duy nhất
 *     `{ error: "câu thông báo" }` như Express cũ.
 *   - Giống bộ phận chăm sóc khách hàng: dù bên trong hỏng chỗ nào, khách chỉ nhận một lời giải thích gọn, dễ hiểu.
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - `server/src/bootstrap.ts` đăng ký bằng `app.useGlobalFilters(new HttpExceptionFilter())`.
 *
 * LUỒNG CHÍNH
 *   - Nếu response đã bắt đầu gửi → bỏ qua (không gửi được nữa).
 *   - Nếu là lỗi HTTP (ApiError, BadRequest…) → giữ mã HTTP, chuẩn hóa nội dung thành { error }.
 *   - Nếu là lỗi đọc body (quá lớn / JSON sai) → trả 413 / 400 với câu tiếng Việt.
 *   - Lỗi khác (lỗi bất ngờ) → ghi log và trả 500 "Máy chủ gặp lỗi."
 */

// ArgumentsHost: "hộp" chứa request/response hiện tại. Catch: decorator đánh dấu bộ bắt lỗi.
// ExceptionFilter: bản mẫu (interface) mà bộ lọc lỗi phải tuân theo. HttpException: lớp lỗi HTTP.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
// Kiểu dữ liệu Response của Express (chỉ kiểu, không phải code chạy).
import type { Response } from 'express';

/**
 * Chuẩn hóa mọi lỗi về `{ error: string }` như Express cũ.
 * - @Catch() không có tham số = bắt tất cả mọi loại lỗi.
 * - "implements ExceptionFilter" = cam kết class này có hàm catch() đúng mẫu NestJS yêu cầu.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * NestJS tự gọi hàm này mỗi khi có lỗi.
   * - exception: lỗi vừa xảy ra ("unknown" = chưa biết là loại gì).
   * - host: nơi lấy ra request/response.
   * - Trả về: không cần; hàm tự gửi response JSON.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    // Lấy đối tượng response (để gửi trả lời) trong ngữ cảnh HTTP.
    const res = host.switchToHttp().getResponse<Response>();
    // Nếu response đã gửi phần đầu rồi thì không thể gửi lỗi nữa → dừng.
    if (res.headersSent) return;
    // Trường hợp 1: lỗi HTTP có chủ đích (instanceof = "có phải là một HttpException không").
    if (exception instanceof HttpException) {
      // Lấy mã HTTP (vd 404).
      const status = exception.getStatus();
      // Lấy nội dung lỗi (có thể là chữ hoặc object).
      const body = exception.getResponse();
      // Nếu nội dung đã đúng dạng { error: "..." } (do ApiError tạo) và không phải dạng mặc định của Nest
      // (dạng mặc định có trường statusCode) → gửi nguyên như vậy.
      if (body && typeof body === 'object' && typeof (body as any).error === 'string' && !('statusCode' in body)) {
        return res.status(status).json(body);
      }
      // Ngược lại, rút ra câu thông báo: nếu body là chữ thì dùng luôn; nếu là object thì lấy body.message;
      // nếu vẫn không có thì lấy exception.message.
      const message = typeof body === 'string' ? body : (body as any)?.message ?? exception.message;
      // Lỗi cú pháp JSON của body-parser bị Nest bọc thành BadRequestException với câu tiếng Anh.
      // Regex /JSON|Unexpected token|Unexpected end/i: tìm một trong các cụm từ này, không phân biệt hoa thường.
      if (status === 400 && /JSON|Unexpected token|Unexpected end/i.test(String(message))) {
        // Thay bằng câu tiếng Việt dễ hiểu.
        return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
      }
      // Gửi lỗi: nếu message là danh sách (nhiều lỗi) thì nối bằng dấu phẩy, nếu không thì đổi sang chữ.
      return res.status(status).json({ error: Array.isArray(message) ? message.join(', ') : String(message) });
    }
    // Trường hợp 2: lỗi không phải HttpException. "as any" = tạm bỏ kiểm tra kiểu để đọc trường bất kỳ.
    const err = exception as any;
    // Lỗi do body gửi lên vượt 5 MB → 413 (quá lớn).
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
    // Lỗi do JSON gửi lên sai cú pháp → 400.
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
    // Trường hợp 3: lỗi bất ngờ → in chi tiết ra log máy chủ để lập trình viên điều tra.
    console.error('Lỗi Server:', exception);
    // Trả người dùng câu chung chung (không lộ chi tiết kỹ thuật) với mã 500.
    return res.status(500).json({ error: 'Máy chủ gặp lỗi.' });
  }
}
