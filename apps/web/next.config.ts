import type { NextConfig } from "next";

/** URL của project API NestJS (Vercel) – mặc định API chạy local ở cổng 4000. */
const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /** Proxy /api/* sang NestJS: trình duyệt chỉ thấy 1 domain nên cookie đăng nhập hoạt động bình thường. */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  /** Giữ các đường dẫn cũ của server Express (bookmark của công nhân). */
  async redirects() {
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
    return Object.entries(map).map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
