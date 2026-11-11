/**
 * File này: công cụ gọi API máy chủ (NestJS, cùng domain qua /api/*). Dùng ở: mọi trang cần dữ liệu.
 *
 *   const orders = await api.get<Order[]>('/api/orders');
 *   await api.post('/api/orders', body);
 *   const blob = await api.download('/api/orders/export?…');  // tải file
 *
 * Lỗi HTTP ném `ApiError` với message tiếng Việt từ server (`{ error }`).
 * 401 -> tự chuyển về /login.
 */
/** Lỗi khi gọi API: có mã HTTP (status), câu lỗi và dữ liệu lỗi. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

// Dữ liệu JSON gửi lên: đối tượng, mảng hoặc null.
type Json = Record<string, unknown> | unknown[] | null;

/** Chuyển về /login, kèm ?next= để đăng nhập xong quay lại trang đang xem. */
function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  const next = window.location.pathname + window.location.search;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
}

/** Gửi 1 yêu cầu tới máy chủ (fetch), trả dữ liệu hoặc ném ApiError. */
async function request<T>(method: string, url: string, body?: Json | FormData, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // Gửi file (FormData) giữ nguyên; dữ liệu thường thì đổi sang JSON.
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }
  // Gửi yêu cầu kèm cookie đăng nhập, luôn lấy dữ liệu mới.
  const res = await fetch(url, { method, credentials: "same-origin", cache: "no-store", ...init, headers, body: payload });
  // 401 = hết phiên đăng nhập → về trang đăng nhập.
  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
  }
  // Đọc kết quả: JSON hoặc chữ thường.
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "");
  // Lỗi: lấy câu báo lỗi tiếng Việt máy chủ gửi trong trường "error".
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) || `Lỗi ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

/** Các hàm gọi API: get (lấy), post (tạo), put/patch (sửa), delete (xóa). */
export const api = {
  get: <T = unknown>(url: string, init?: RequestInit) => request<T>("GET", url, undefined, init),
  post: <T = unknown>(url: string, body?: Json | FormData, init?: RequestInit) => request<T>("POST", url, body ?? {}, init),
  put: <T = unknown>(url: string, body?: Json | FormData, init?: RequestInit) => request<T>("PUT", url, body ?? {}, init),
  patch: <T = unknown>(url: string, body?: Json | FormData, init?: RequestInit) => request<T>("PATCH", url, body ?? {}, init),
  delete: <T = unknown>(url: string, body?: Json, init?: RequestInit) => request<T>("DELETE", url, body, init),

  /** Tải file (Excel…) và lưu xuống máy. Tên file lấy từ Content-Disposition nếu có. */
  async download(url: string, fallbackName = "download") {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (res.status === 401) {
      redirectToLogin();
      throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, (data && data.error) || `Lỗi ${res.status}`);
    }
    // Lấy tên file từ header máy chủ gửi về.
    const cd = res.headers.get("content-disposition") || "";
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1] || m[2]) : fallbackName;
    // Tạo link ẩn trỏ tới file rồi tự bấm để trình duyệt lưu file.
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Giải phóng bộ nhớ sau 1 giây.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};

/** Lấy message lỗi để hiển thị toast. */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra.");
