/**
 * Gọi API NestJS (cùng domain qua rewrite /api/*).
 *
 *   const orders = await api.get<Order[]>('/api/orders');
 *   await api.post('/api/orders', body);
 *   const blob = await api.download('/api/orders/export?…');  // tải file
 *
 * Lỗi HTTP ném `ApiError` với message tiếng Việt từ server (`{ error }`).
 * 401 -> tự chuyển về /login.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown> | unknown[] | null;

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
}

async function request<T>(method: string, url: string, body?: Json | FormData, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, credentials: "same-origin", cache: "no-store", ...init, headers, body: payload });
  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
  }
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "");
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) || `Lỗi ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

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
    const cd = res.headers.get("content-disposition") || "";
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1] || m[2]) : fallbackName;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};

/** Lấy message lỗi để hiển thị toast. */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra.");
