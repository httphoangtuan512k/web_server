/**
 * FILE NÀY LÀM GÌ
 *   - Các hàm xử lý ngày giờ theo GIỜ VIỆT NAM (UTC+7).
 *   - Server cũ chạy trên Windows giờ Việt Nam; Vercel chạy UTC (giờ quốc tế, chậm hơn VN 7 tiếng).
 *     Ví dụ: 6h sáng ngày 2 ở VN thì trên Vercel vẫn là 23h ngày 1 → nếu dùng giờ máy sẽ ra sai ngày.
 *   - Mọi "ngày làm việc", tên file theo ngày, mốc 23:59… phải dùng các hàm này thay cho
 *     getFullYear()/getMonth()/getDate()/getHours() của Date.
 *
 * AI/CHỖ NÀO DÙNG NÓ
 *   - Các module nghiệp vụ (đơn hàng, sao lưu, PLC, kho…) khi cần ngày/giờ VN.
 *
 * LUỒNG CHÍNH
 *   - vnParts(): cộng 7 tiếng vào thời điểm rồi đọc năm/tháng/ngày/giờ/phút/giây.
 *   - Các hàm khác dựa trên vnParts() để tạo chuỗi 'YYYY-MM-DD', 'HHmmss', 'YYYY-MM-DD HH:mm:ss'…
 */

// Tên múi giờ Việt Nam theo chuẩn quốc tế. "export const" = hằng số (không đổi) cho file khác dùng.
export const VN_TZ = 'Asia/Ho_Chi_Minh';
// Độ lệch giờ VN so với UTC tính bằng mili-giây: 7 giờ × 60 phút × 60 giây × 1000 ms.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam không có giờ mùa hè

/**
 * "interface" = mô tả hình dạng một object (có những trường nào, kiểu gì), giống mẫu phiếu cần điền.
 * VnParts: các thành phần ngày giờ theo giờ VN.
 */
export interface VnParts {
  // Năm, vd 2026.
  year: number;
  month: number; // 1-12
  // Ngày trong tháng (1-31).
  day: number;
  // Giờ (0-23), phút (0-59), giây (0-59).
  hour: number;
  minute: number;
  second: number;
}

/**
 * Tách một thời điểm thành năm/tháng/ngày/giờ/phút/giây theo giờ VN.
 * - Nhận vào: date (mặc định = bây giờ, nhờ "= new Date()").
 * - Trả về: object VnParts.
 */
export function vnParts(date: Date = new Date()): VnParts {
  // Tạo thời điểm mới = thời điểm gốc + 7 tiếng. getTime() = số mili-giây kể từ 1/1/1970.
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  // Đọc các thành phần bằng hàm getUTC… (không bị ảnh hưởng múi giờ máy chủ), vì đã cộng sẵn 7 tiếng.
  return {
    year: d.getUTCFullYear(),
    // getUTCMonth() trả 0-11 nên cộng 1 để thành 1-12.
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

// Hàm nhỏ: đổi số thành chuỗi 2 chữ số, thêm số 0 phía trước nếu cần (vd 5 → "05").
// Cú pháp "(n) => ..." là hàm mũi tên: cách viết hàm ngắn gọn.
const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * 'YYYY-MM-DD' theo giờ VN (thay cho localDateKey() của server cũ).
 * - Nhận vào: date (mặc định bây giờ). Trả về: chuỗi ngày, vd "2026-11-11".
 */
export function vnDateKey(date: Date = new Date()): string {
  // Lấy các thành phần ngày giờ VN.
  const p = vnParts(date);
  // Ghép chuỗi bằng template literal (chuỗi trong dấu ` `, chèn giá trị bằng ${...}).
  return `${p.year}-${p2(p.month)}-${p2(p.day)}`;
}

/**
 * 'HHmmss' theo giờ VN.
 * - Trả về: chuỗi giờ phút giây liền nhau, vd "235900" (hay dùng trong tên file).
 */
export function vnTimeKey(date: Date = new Date()): string {
  // Lấy các thành phần ngày giờ VN.
  const p = vnParts(date);
  // Ghép giờ, phút, giây (mỗi phần 2 chữ số).
  return `${p2(p.hour)}${p2(p.minute)}${p2(p.second)}`;
}

/**
 * 'YYYY-MM-DD HH:mm:ss' theo giờ VN.
 * - Trả về: vd "2026-11-11 08:30:05".
 */
export function vnDateTime(date: Date = new Date()): string {
  // Lấy các thành phần ngày giờ VN.
  const p = vnParts(date);
  // Ghép phần ngày (dùng lại vnDateKey) + khoảng trắng + giờ:phút:giây.
  return `${vnDateKey(date)} ${p2(p.hour)}:${p2(p.minute)}:${p2(p.second)}`;
}

/**
 * Hiển thị kiểu toLocaleString('vi-VN') nhưng cố định múi giờ VN.
 * - Trả về: chuỗi ngày giờ theo cách viết của người Việt, vd "08:30:05 11/11/2026".
 */
export function vnLocaleString(date: Date = new Date()): string {
  // Định dạng theo ngôn ngữ 'vi-VN' và ép múi giờ Asia/Ho_Chi_Minh.
  return date.toLocaleString('vi-VN', { timeZone: VN_TZ });
}

/**
 * Mốc 00:00 giờ VN của một dateKey, dưới dạng Date (UTC).
 * - Nhận vào: dateKey dạng 'YYYY-MM-DD'.
 * - Trả về: thời điểm nửa đêm đầu ngày đó ở VN (vd '2026-11-11' → 17:00 UTC ngày 10/11).
 */
export function vnStartOfDay(dateKey: string): Date {
  // Lấy 00:00 UTC của ngày đó (chữ Z = UTC), rồi trừ 7 tiếng để ra 00:00 giờ VN.
  return new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() - VN_OFFSET_MS);
}

/**
 * dateKey hợp lệ 'YYYY-MM-DD'?
 * - Nhận vào: giá trị bất kỳ. Trả về: true/false.
 * - "v is string" = nếu trả true thì TypeScript hiểu v chắc chắn là chuỗi.
 */
export function isDateKey(v: unknown): v is string {
  // Phải là chuỗi VÀ khớp regex: 4 chữ số - 2 chữ số - 2 chữ số (^ và $ = từ đầu đến cuối chuỗi).
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
