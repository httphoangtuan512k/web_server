import { HttpException } from '@nestjs/common';

/**
 * Lỗi trả về đúng định dạng của server cũ: HTTP <status> + `{ "error": "<message>" }`.
 * Dùng: `throw new ApiError(404, 'Không tìm thấy đơn hàng.')`
 */
export class ApiError extends HttpException {
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super({ error: message, ...(extra || {}) }, status);
  }
}
