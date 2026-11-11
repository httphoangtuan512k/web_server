/**
 * File này: lớp lỗi ApiError – báo lỗi kèm mã HTTP (400/401/403/404…) và câu tiếng Việt.
 * Dùng ở: hầu hết controller/service khi cần báo lỗi cho người dùng.
 */
import { HttpException } from '@nestjs/common';

/**
 * Lỗi trả về đúng định dạng của server cũ: HTTP <status> + `{ "error": "<message>" }`.
 * Dùng: `throw new ApiError(404, 'Không tìm thấy đơn hàng.')`
 */
export class ApiError extends HttpException {
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    // Nội dung JSON = { error, ...các trường phụ nếu có }.
    super({ error: message, ...(extra || {}) }, status);
  }
}
