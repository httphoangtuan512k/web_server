// File này: các hàm tiện ích nhỏ (đổi giờ VN, tìm không dấu, rút gọn trình duyệt, sao chép chữ).
// Dùng ở: các trang Quản trị.
/** Tiện ích dùng chung cho các trang quản trị. */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam UTC+7, không có giờ mùa hè.

/** ISO → giá trị cho `<input type="datetime-local" step="1">` theo giờ VN ('YYYY-MM-DDTHH:mm:ss'). */
export function toVnInputValue(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  // Cộng 7 giờ rồi cắt lấy 'YYYY-MM-DDTHH:mm:ss'.
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 19);
}

/** Giá trị datetime-local (giờ VN) → chuỗi ISO UTC. Trả '' nếu rỗng/không hợp lệ. */
export function fromVnInputValue(v: string): string {
  if (!v) return "";
  // Thiếu giây thì thêm ':00', rồi đọc như giờ VN (+07:00).
  const withSeconds = v.length === 16 ? `${v}:00` : v;
  const d = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Cộng/trừ ngày cho khóa 'YYYY-MM-DD'. */
export function shiftDateKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  // Cộng số ngày (số âm = lùi lại).
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Chuẩn hóa để tìm kiếm không dấu, không phân biệt hoa thường. */
export function normalizeText(v: unknown): string {
  // Bỏ dấu tiếng Việt, đổi đ→d, chuyển chữ thường.
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Kiểm tra `query` (đã chuẩn hóa) có nằm trong một trong các giá trị. */
export function matchesQuery(query: string, ...values: unknown[]): boolean {
  // Ô tìm kiếm trống → khớp hết.
  if (!query) return true;
  return values.some((v) => normalizeText(v).includes(query));
}

/** Rút gọn user agent: "Chrome 129 · Windows". */
export function shortUserAgent(ua: string | null | undefined): string {
  const s = String(ua || "");
  if (!s) return "—";
  const pick = (re: RegExp) => re.exec(s)?.[1]?.split(".")[0];
  let browser = "Trình duyệt khác";
  let v: string | undefined;
  // Dò tên trình duyệt; Edge/Opera/Cốc Cốc… phải dò trước Chrome vì cũng chứa chữ "Chrome".
  if ((v = pick(/Edg(?:e|A|iOS)?\/([\d.]+)/))) browser = `Edge ${v}`;
  else if ((v = pick(/(?:OPR|Opera)\/([\d.]+)/))) browser = `Opera ${v}`;
  else if ((v = pick(/Zalo(?:App|Theme)?\/([\d.]+)/i))) browser = `Zalo ${v}`;
  else if ((v = pick(/CocCoc\/([\d.]+)/i)) || (v = pick(/coc_coc_browser\/([\d.]+)/i))) browser = `Cốc Cốc ${v}`;
  else if ((v = pick(/SamsungBrowser\/([\d.]+)/))) browser = `Samsung Internet ${v}`;
  else if ((v = pick(/(?:Firefox|FxiOS)\/([\d.]+)/))) browser = `Firefox ${v}`;
  else if ((v = pick(/(?:Chrome|CriOS)\/([\d.]+)/))) browser = `Chrome ${v}`;
  else if (/Safari\//.test(s) && (v = pick(/Version\/([\d.]+)/))) browser = `Safari ${v}`;
  else if (/curl|PostmanRuntime|node|axios|okhttp/i.test(s)) browser = s.split(/[\s/]/)[0];

  // Dò hệ điều hành.
  let os = "";
  if (/Windows NT/.test(s)) os = "Windows";
  else if (/iPhone/.test(s)) os = "iPhone";
  else if (/iPad/.test(s)) os = "iPad";
  else if (/Android/.test(s)) os = /Mobile/.test(s) ? "Android" : "Android (tablet)";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/.test(s)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

/** Chữ cái đầu cho avatar mặc định. */
export function initials(name: string): string {
  // Nhiều từ → chữ đầu từ đầu + từ cuối; một từ → 2 ký tự đầu.
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const last = parts[parts.length - 1];
  return (parts.length > 1 ? parts[0][0] + last[0] : last.slice(0, 2)).toUpperCase();
}

/** Sao chép văn bản (có phương án dự phòng cho HTTP/không cấp quyền clipboard). */
export async function copyText(text: string): Promise<boolean> {
  try {
    // Cách 1: dùng clipboard của trình duyệt.
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Cách 2 (dự phòng): ô chữ ẩn → bôi đen → lệnh "copy".
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
