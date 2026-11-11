/**
 * File này: cấu hình Next.js – tính năng bật, thư viện server không đóng gói, chuyển hướng link cũ.
 * Dùng ở: Next.js tự đọc khi dev/build/deploy.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bật cache theo component và prefetch từng phần (trang tải nhanh hơn).
  cacheComponents: true,
  partialPrefetching: true,
  // Không gửi header lộ công nghệ.
  poweredByHeader: false,
  // NestJS + thư viện server chạy dạng require bình thường (không bundle) để giữ decorator metadata & optional deps.
  serverExternalPackages: ["@nestjs/core", "@nestjs/common", "@nestjs/platform-express", "express", "reflect-metadata", "pg", "drizzle-orm", "exceljs", "bcryptjs", "cookie-parser", "@vercel/blob"],
  // File .css đi qua bộ xử lý Tailwind.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /** Giữ các đường dẫn cũ của server Express (bookmark của công nhân). */
  async redirects() {
    // Bảng "link cũ → link mới".
    const map: Record<string, string> = {
      "/Dangnhap.html": "/login",
      "/trangchu.html": "/",
      "/trangchu": "/",
      "/admin.html": "/quan-tri/nguoi-dung",
      "/admin": "/quan-tri/nguoi-dung",
      "/log.html": "/quan-tri/nhat-ky",
      "/superdata.html": "/quan-tri/du-lieu",
      "/quanlytailieu.html": "/tai-lieu",
      "/kehoach.html": "/ke-hoach",
      "/vanhanh.html": "/van-hanh",
      "/dataplc.html": "/plc",
      "/pages/dataplc.html": "/plc",
      "/kho.html": "/kho",
      "/baotri.html": "/bao-tri",
      "/kcs.html": "/kcs",
      "/xuathang.html": "/xuat-hang",
    };
    // Đổi bảng thành danh sách quy tắc chuyển hướng tạm thời (permanent: false).
    return Object.entries(map).map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
