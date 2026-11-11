/**
 * File này: trang chủ "/" sau khi đăng nhập.
 * Dùng ở: mọi người dùng; giao diện nằm trong home-parts/dashboard.tsx.
 */
import type { Metadata } from "next";
import { Dashboard } from "./home-parts/dashboard";

// Tiêu đề tab trình duyệt.
export const metadata: Metadata = { title: "Tổng quan" };

/** Hiển thị trang chủ (lưới thẻ chức năng). */
export default function HomePage() {
  return <Dashboard />;
}
