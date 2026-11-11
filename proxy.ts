/**
 * File này: "bảo vệ cổng" của giao diện – chưa có cookie phiên thì đưa về trang đăng nhập.
 * Dùng ở: Next.js tự chạy trước mỗi trang khớp config.matcher.
 */
import { NextResponse, type NextRequest } from "next/server";

// Tên cookie phiên – phải trùng với tên API NestJS đặt khi đăng nhập.
const SESSION_COOKIE = "superwhite.sid";

/**
 * Kiểm tra lạc quan: chưa có cookie phiên -> về trang đăng nhập.
 * Phân quyền thật sự do API NestJS kiểm tra ở mỗi request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Ở trang đăng nhập: đã đăng nhập thì về trang chủ.
  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  // Chưa đăng nhập: về /login, nhớ trang đang muốn vào (?next=) để quay lại.
  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // Có phiên: cho đi tiếp.
  return NextResponse.next();
}

export const config = {
  // Bỏ qua API (NestJS tự kiểm tra), file tĩnh và tài nguyên Next.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.jpg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
