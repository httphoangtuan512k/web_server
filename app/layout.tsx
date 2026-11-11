/**
 * File này: khung HTML gốc của mọi trang – phông Be Vietnam Pro, tiêu đề tab, icon logo, CSS chung.
 * Dùng ở: Next.js tự áp cho toàn bộ ứng dụng (kể cả trang đăng nhập).
 */
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Phông Be Vietnam Pro (có dấu tiếng Việt), gắn vào biến CSS --font-be-vietnam.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Tiêu đề tab: "<tên trang> · SUPER WHITE"; icon tab là logo.
export const metadata: Metadata = {
  title: { default: "SUPER WHITE", template: "%s · SUPER WHITE" },
  description: "Hệ thống quản lý sản xuất SUPER WHITE – Calcium Carbonate",
  icons: { icon: "/logo.jpg" },
};

// Hiển thị đúng cỡ trên điện thoại; thanh trình duyệt màu xanh đen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#172b3a",
};

/** Thẻ <html>/<body>; bọc trang trong ToastProvider để hiện thông báo nhỏ ở góc. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
