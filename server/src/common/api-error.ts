/**
 * FILE NÀY LÀM GÌ
 *   - Định nghĩa `ApiError`: một loại "lỗi" có mã HTTP và câu thông báo tiếng Việt.
 *   - Lỗi trả về đúng định dạng của server cũ: HTTP <status> + `{ "error": "<message>" }`.
 *   - Mã HTTP là con số quy ước: 400 = dữ liệu sai, 401 = chưa đăng nhập, 403 = không có quyền,
 *     404 = không tìm thấy, 500 = máy chủ lỗi.
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - Hầu hết các controller/service trong server/src khi cần báo lỗi cho người dùng.
 *   - Dùng: `throw new ApiError(404, 'Không tìm thấy đơn hàng.')`
 *
 * LUỒNG CHÍNH
 *   - Code nghiệp vụ "ném" (throw) một ApiError → NestJS dừng xử lý →
 *     HttpExceptionFilter gửi về trình duyệt JSON `{ error: "..." }` với mã HTTP tương ứng.
 */

// HttpException: lớp lỗi HTTP có sẵn của NestJS, ApiError sẽ "kế thừa" (dựa trên) nó.
import { HttpException } from '@nestjs/common';

/**
 * Lỗi trả về đúng định dạng của server cũ: HTTP <status> + `{ "error": "<message>" }`.
 * Dùng: `throw new ApiError(404, 'Không tìm thấy đơn hàng.')`
 * "class ... extends HttpException" = tạo loại lỗi mới, có mọi tính năng của HttpException.
 */
export class ApiError extends HttpException {
  /**
   * Hàm tạo lỗi.
   * - status: mã HTTP (vd 404).
   * - message: câu thông báo cho người dùng.
   * - extra (không bắt buộc, dấu "?"): thêm các trường phụ vào JSON trả về, vd { code: 'X' }.
   */
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    // super(...) = gọi hàm tạo của lớp cha HttpException với nội dung JSON và mã HTTP.
    // "...(extra || {})" = trải các trường của extra vào object (nếu không có extra thì trải object rỗng).
    super({ error: message, ...(extra || {}) }, status);
  }
}
