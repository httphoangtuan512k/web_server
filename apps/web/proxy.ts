import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "superwhite.sid";

/**
 * Kiểm tra lạc quan: chưa có cookie phiên -> về trang đăng nhập.
 * Phân quyền thật sự do API NestJS kiểm tra ở mỗi request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua API (NestJS tự kiểm tra), file tĩnh và tài nguyên Next.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.jpg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
