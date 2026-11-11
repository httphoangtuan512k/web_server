/**
 * FILE NÀY LÀM GÌ
 *   - BlobService: "thủ kho" của các file (ảnh đơn hàng, ảnh bảo trì, avatar, tài liệu Excel, bản sao lưu).
 *   - File thật nằm trên Vercel Blob (dịch vụ lưu file trên mạng của Vercel), ở chế độ private
 *     (không ai xem được nếu không đi qua API của app).
 *   - Cung cấp các thao tác: lưu (put), đọc (get/readBuffer), liệt kê (list), xóa (delete),
 *     và chuyển ảnh dạng "data:image/...;base64" thành file thật (persistImage).
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - FilesController (trả ảnh cho trình duyệt), các module đơn hàng, bảo trì, tài liệu, sao lưu, người dùng…
 *   - Script `server/scripts/import-sqlite.ts` dùng khi đồng bộ dữ liệu từ server cũ.
 *
 * LUỒNG CHÍNH
 *   - Đường dẫn trong app có dạng '/api/files/<thư mục>/<tên file>'; trên Blob chỉ là '<thư mục>/<tên file>'.
 *   - Hai hàm tĩnh pathnameFromAppUrl / appUrl đổi qua lại giữa hai dạng đó.
 *   - Các hàm còn lại gọi thư viện @vercel/blob để thao tác thật.
 */

// Injectable: decorator đánh dấu class là "dịch vụ" để NestJS tự tạo và đưa vào nơi cần dùng.
import { Injectable } from '@nestjs/common';
// Các hàm của thư viện Vercel Blob: del = xóa, get = đọc, list = liệt kê, put = lưu.
import { del, get, list, put } from '@vercel/blob';
// createHash: tạo "mã băm" (hash) – một dấu vân tay ngắn đại diện cho nội dung.
// Hai nội dung giống hệt nhau luôn cho cùng một mã băm.
import { createHash } from 'crypto';

/** Tiền tố đường dẫn công khai trong app; file thật nằm ở Vercel Blob (store private). */
export const FILES_PREFIX = '/api/files/';

/**
 * Các thư mục được phép trên Blob.
 * "type A = 'x' | 'y'" = kiểu chỉ nhận đúng một trong các giá trị liệt kê (dấu | nghĩa là "hoặc").
 */
export type BlobFolder = 'orders' | 'maintenance' | 'avatars' | 'documents' | 'backups' | 'baotri-exports';

/**
 * Bảng tra: loại file (MIME type – nhãn mô tả kiểu nội dung, vd 'image/png') → đuôi file.
 * Dùng khi lưu ảnh để đặt tên file có đuôi đúng.
 */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

// @Injectable(): NestJS sẽ tạo một BlobService duy nhất và dùng chung cho cả ứng dụng.
@Injectable()
export class BlobService {
  /**
   * '/api/files/orders/a.jpg' -> 'orders/a.jpg'. Trả về null nếu không phải file của app.
   * - "static" = hàm gọi thẳng trên class (BlobService.pathnameFromAppUrl(...)) không cần tạo đối tượng.
   * - Nhận vào: giá trị bất kỳ. Trả về: pathname trên Blob hoặc null.
   */
  static pathnameFromAppUrl(value: unknown): string | null {
    // Không phải chuỗi, hoặc không bắt đầu bằng '/api/files/' → không phải file của app.
    if (typeof value !== 'string' || !value.startsWith(FILES_PREFIX)) return null;
    // Cắt bỏ phần tiền tố, rồi giải mã ký tự đặc biệt (vd "%20" → dấu cách).
    return decodeURIComponent(value.slice(FILES_PREFIX.length));
  }

  /**
   * Ngược lại với hàm trên: 'orders/a b.jpg' → '/api/files/orders/a%20b.jpg'.
   * - Nhận vào: pathname trên Blob. Trả về: đường dẫn dùng trong app.
   */
  static appUrl(pathname: string): string {
    // Tách theo dấu '/', mã hóa từng đoạn cho an toàn trên URL, ghép lại và thêm tiền tố.
    return FILES_PREFIX + pathname.split('/').map(encodeURIComponent).join('/');
  }

  /**
   * Lưu một file lên Blob.
   * - pathname: tên/đường dẫn muốn lưu, vd 'orders/abc.jpg'.
   * - body: nội dung (Buffer = dữ liệu nhị phân, hoặc chuỗi).
   * - contentType: loại nội dung (không bắt buộc).
   * - opts.random: true (mặc định) = thêm đuôi ngẫu nhiên vào tên để không trùng;
   *   false = giữ đúng tên và cho phép ghi đè.
   * - Trả về: { pathname thật trên Blob, url gốc của Blob, appUrl dạng '/api/files/...' }.
   */
  async put(pathname: string, body: Buffer | string, contentType?: string, opts: { random?: boolean } = {}) {
    // Gọi thư viện Vercel Blob để tải file lên.
    const res = await put(pathname, body, {
      // File riêng tư: chỉ đọc được qua token của server.
      access: 'private',
      // "??" = nếu opts.random không được truyền thì dùng true.
      addRandomSuffix: opts.random ?? true,
      // Chỉ cho ghi đè khi người gọi chủ động truyền random: false.
      allowOverwrite: opts.random === false,
      contentType,
    });
    // Trả về thông tin file đã lưu, kèm đường dẫn dùng trong app.
    return { pathname: res.pathname, url: res.url, appUrl: BlobService.appUrl(res.pathname) };
  }

  /**
   * Đọc file (stream) theo pathname; null nếu không tồn tại.
   * "Stream" = dòng dữ liệu chảy từng đoạn, như nước chảy qua ống, không cần chờ tải hết mới dùng.
   */
  async get(pathname: string) {
    // Đọc file private từ Blob.
    return get(pathname, { access: 'private' });
  }

  /**
   * Đọc toàn bộ nội dung file vào bộ nhớ.
   * - Nhận vào: pathname. Trả về: Buffer (toàn bộ dữ liệu) hoặc null nếu không có file.
   * - Dùng khi cần xử lý cả file một lúc (vd đọc file Excel, file sao lưu).
   */
  async readBuffer(pathname: string): Promise<Buffer | null> {
    // Mở file dạng stream.
    const r = await this.get(pathname);
    // Không có file hoặc không có dữ liệu → trả null.
    if (!r || !r.stream) return null;
    // Mảng (danh sách) chứa từng mẩu dữ liệu đọc được.
    const chunks: Buffer[] = [];
    // Lấy "đầu đọc" của stream để đọc từng mẩu.
    const reader = (r.stream as ReadableStream<Uint8Array>).getReader();
    // "for (;;)" = vòng lặp không điều kiện dừng sẵn; sẽ thoát bằng "break" bên trong.
    for (;;) {
      // Đọc mẩu tiếp theo. done = true khi đã hết dữ liệu; value = mẩu dữ liệu.
      const { done, value } = await reader.read();
      // Hết dữ liệu → thoát vòng lặp.
      if (done) break;
      // Cất mẩu vừa đọc vào danh sách.
      chunks.push(Buffer.from(value));
    }
    // Nối tất cả các mẩu thành một khối dữ liệu hoàn chỉnh.
    return Buffer.concat(chunks);
  }

  /**
   * Liệt kê mọi file có tên bắt đầu bằng prefix (vd 'backups/').
   * - Trả về: danh sách { pathname, size (byte), uploadedAt (lúc tải lên), url }.
   * - Blob trả kết quả theo từng "trang" tối đa 1000 file, nên phải lặp đến khi hết.
   */
  async list(prefix: string) {
    // Danh sách kết quả. Array<{...}> = mảng các object có các trường như mô tả.
    const blobs: Array<{ pathname: string; size: number; uploadedAt: Date; url: string }> = [];
    // "cursor" = dấu trang: cho Blob biết lần sau đọc tiếp từ đâu. Ban đầu chưa có (undefined).
    let cursor: string | undefined;
    // Vòng lặp do…while: làm ít nhất một lần, rồi lặp lại khi điều kiện ở cuối còn đúng.
    do {
      // Lấy một trang (tối đa 1000 file) bắt đầu từ dấu trang hiện tại.
      const r = await list({ prefix, cursor, limit: 1000 });
      // Chỉ giữ 4 trường cần thiết của mỗi file rồi thêm vào danh sách kết quả ("..." = trải từng phần tử).
      blobs.push(...r.blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt, url: b.url })));
      // Còn trang sau thì lưu dấu trang mới; hết rồi thì đặt undefined để dừng.
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    // Trả về toàn bộ danh sách.
    return blobs;
  }

  /**
   * Xóa một hoặc nhiều file.
   * - Nhận vào: một chuỗi hoặc danh sách chuỗi; mỗi chuỗi là URL đầy đủ (https://…) hoặc pathname.
   * - Trả về: không có gì (chỉ xóa).
   */
  async delete(pathnameOrUrl: string | string[]) {
    // Đưa về dạng danh sách (nếu chỉ có một thì bọc vào mảng), rồi bỏ các giá trị rỗng.
    const items = (Array.isArray(pathnameOrUrl) ? pathnameOrUrl : [pathnameOrUrl]).filter(Boolean);
    // Danh sách rỗng → không có gì để xóa.
    if (!items.length) return;
    // del() cần URL đầy đủ; tra từ pathname khi cần.
    const urls: string[] = [];
    // Duyệt từng mục cần xóa.
    for (const item of items) {
      // Nếu đã là URL (bắt đầu bằng http:// hoặc https://) thì dùng luôn.
      if (/^https?:\/\//.test(item)) urls.push(item);
      else {
        // Nếu là pathname: hỏi Blob danh sách file có tiền tố này (lấy 1 kết quả).
        const found = await list({ prefix: item, limit: 1 });
        // Chọn đúng file có pathname trùng khớp hoàn toàn.
        const hit = found.blobs.find((b) => b.pathname === item);
        // Tìm thấy thì lấy URL của nó để xóa.
        if (hit) urls.push(hit.url);
      }
    }
    // Có URL nào thì xóa tất cả trong một lần gọi.
    if (urls.length) await del(urls);
  }

  /**
   * Chuẩn hóa giá trị ảnh trước khi lưu DB:
   *  - 'data:image/...;base64,...' -> upload lên Blob, trả về '/api/files/<folder>/<sha256>.<ext>'
   *    (tên theo hash nội dung: cùng ảnh không bị lưu trùng, import lại không sinh file thừa)
   *  - '/api/files/...' hoặc '' -> giữ nguyên
   *  - giá trị khác -> giữ nguyên (tương thích dữ liệu cũ)
   * Lưu ý: KHÔNG xóa ảnh cũ khi sửa/xóa bản ghi – một ảnh có thể được nhiều đơn (đơn tách) dùng chung.
   *
   * "data:image/png;base64,iVBOR..." là cách nhét cả bức ảnh vào một chuỗi chữ (base64 = cách mã hóa
   * dữ liệu nhị phân thành chữ cái). Lưu chuỗi đó vào DB rất nặng, nên ta tách ra thành file trên Blob.
   * - Nhận vào: value (giá trị ảnh), folder (thư mục lưu). Trả về: đường dẫn ảnh để lưu vào DB.
   */
  async persistImage(value: unknown, folder: BlobFolder): Promise<string> {
    // Không phải chuỗi hoặc chuỗi rỗng → coi như không có ảnh.
    if (typeof value !== 'string' || !value) return '';
    // Dùng regex tách chuỗi "data:" thành 3 phần: m[1] = loại file, m[2] = có chữ ";base64" không, m[3] = dữ liệu.
    // exec() trả null nếu không khớp.
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
    // Không phải dạng "data:" (vd đã là '/api/files/...') → giữ nguyên.
    if (!m) return value;
    // Loại file, viết thường; không có thì dùng loại chung "application/octet-stream" (dữ liệu nhị phân).
    const mime = (m[1] || 'application/octet-stream').toLowerCase();
    // Giải mã dữ liệu thành Buffer: nếu là base64 thì giải mã base64, nếu không thì giải mã kiểu URL.
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    // Tra đuôi file theo loại; không có trong bảng thì dùng 'bin'.
    const ext = EXT_BY_MIME[mime] || 'bin';
    // Tính mã băm SHA-256 của nội dung, dạng chữ hex, lấy 40 ký tự đầu làm tên file.
    const hash = createHash('sha256').update(buf).digest('hex').slice(0, 40);
    // Lưu lên Blob với tên cố định (random: false) → cùng ảnh thì cùng tên, không sinh file trùng.
    const saved = await this.put(`${folder}/${hash}.${ext}`, buf, mime, { random: false });
    // Trả về đường dẫn '/api/files/...' để lưu vào DB.
    return saved.appUrl;
  }
}
