/**
 * File này: giữ một bản NestJS đã khởi động sẵn để dùng lại cho mọi request (khởi động rất tốn thời gian).
 * Dùng ở: pages/api/[...path].ts.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './bootstrap';

// Handler = hàm nhận (request, response) để xử lý.
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
// Bộ nhớ đệm: app đang/đã khởi động (null = chưa).
let cached: Promise<Handler> | null = null;

/** Handler cho Vercel Function: khởi tạo Nest 1 lần rồi tái sử dụng giữa các request. */
export function getHandler(): Promise<Handler> {
  // Lần đầu: khởi động app, lấy máy chủ Express làm handler.
  if (!cached) {
    cached = createApp().then(({ server }) => server as unknown as Handler);
    // Khởi động lỗi thì xóa đệm để lần sau thử lại.
    cached.catch(() => (cached = null));
  }
  return cached;
}
